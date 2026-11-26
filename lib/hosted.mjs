import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const ticket = 'northstar-glossary-v1';
const hash = s => createHash('sha256').update(s).digest();
export function equal(a,b) { return typeof a==='string' && typeof b==='string' && timingSafeEqual(hash(a),hash(b)); }
export function keys() {
  const owner=process.env.FACTORY_OWNER_KEY,worker=process.env.FACTORY_WORKER_KEY;
  return owner?.length>=32 && worker?.length>=32 && !equal(owner,worker) ? {owner,worker} : null;
}
export function cookie(key,until) {
  return until+'.'+createHmac('sha256',key).update('owner-session:'+until).digest('base64url');
}
export function ownerSession(req,key) {
  const value=req.headers.get('cookie')?.match(/(?:^|; )factory_session=([^;]+)/)?.[1];
  const time=Number(value?.split('.')[0]);
  return Number.isSafeInteger(time) && time>Date.now() && equal(value,cookie(key,time));
}
export function db() { return neon(process.env.DATABASE_URL); }
export async function listing(sql) {
  const [row]=await sql`SELECT id,state,version,attempts,result,updated_at FROM factory_ticket WHERE id=${ticket}`;
  if(!row) throw new Error('Schema unavailable');
  return row;
}
// Single conditional statements make the state and version changes atomic.
export async function enqueue(sql, version) {
  return sql`UPDATE factory_ticket SET state='queued',version=version+1,result=NULL,updated_at=now()
    WHERE id=${ticket} AND version=${version} AND state IN ('backlog','failed') RETURNING id`;
}
export async function claim(sql) {
  return sql`UPDATE factory_ticket SET state='running',attempts=attempts+1,version=version+1,lease=gen_random_uuid(),
    expires_at=now()+interval '3 minutes',updated_at=now()
    WHERE id=${ticket} AND (state='queued' OR (state='running' AND expires_at<=now())) RETURNING id,lease`;
}
export async function finish(sql, lease, passed) {
  return sql`UPDATE factory_ticket SET state=${passed?'review':'failed'},result=${passed?'Fixed glossary generated and verified locally.':'Local glossary verification failed.'},
    version=version+1,lease=NULL,expires_at=NULL,updated_at=now()
    WHERE id=${ticket} AND state='running' AND lease=${lease}::uuid AND expires_at>now() RETURNING id`;
}
