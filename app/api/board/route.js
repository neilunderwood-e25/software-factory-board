import {keys,cookie,ownerSession,equal,db,listing,enqueue,claim,finish} from '../../../lib/hosted.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...headers}});
export async function GET(req) {
  const k=keys();
  if(!k || !ownerSession(req,k.owner)) return json({error:'Owner sign-in required'},401);
  try{return json(await listing(db()));}catch{return json({error:'Database unavailable'},503);}
}
export async function POST(req) {
  const k=keys();
  if(!k) return json({error:'Server configuration required'},503);
  if(!req.headers.get('content-type')?.startsWith('application/json')) return json({error:'JSON required'},415);
  let body;
  try {const raw=await req.text(); if(raw.length>1024) return json({},413);body=JSON.parse(raw);}
  catch{return json({},400);}
  if(!body || typeof body!=='object') return json({},400);
  const worker=['claim','finish'].includes(body.action);
  if(worker) {
    if(!equal(req.headers.get('authorization'),'Bearer '+k.worker)) return json({},401);
  } else {
    if(req.headers.get('origin')!==new URL(req.url).origin) return json({},403);
    if(body.action==='login') {
      if(!equal(body.key,k.owner)) return json({error:'Sign-in failed'},401);
      return json({ok:true},200,{'Set-Cookie':'factory_session='+cookie(k.owner,Date.now()+8*3600000)+'; Path=/; Max-Age=28800; Secure; HttpOnly; SameSite=Strict'});
    }
    if(!ownerSession(req,k.owner)) return json({},401);
    if(body.action==='logout') return json({ok:true},200,{'Set-Cookie':'factory_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict'});
  }
  try {
    const sql=db();
    if(body.action==='claim') return json({job:(await claim(sql))[0]??null});
    if(body.action==='finish' && typeof body.passed==='boolean' && /^[a-f0-9-]{36}$/i.test(body.lease)) return (await finish(sql,body.lease,body.passed)).length?json({ok:true}):json({},409);
    if(body.action==='enqueue' && Number.isSafeInteger(body.version)) return (await enqueue(sql,body.version)).length?json({ok:true}):json({},409);
    return json({},400);
  }catch{return json({error:'Database unavailable'},503);}
}
