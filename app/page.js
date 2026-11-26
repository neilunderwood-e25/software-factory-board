'use client';
import {useEffect,useState} from 'react';
const lanes=[['backlog','Backlog'],['queued','To Do'],['running','In Progress'],['review','Review'],['failed','Failed']];
export default function Board(){
  const [card,setCard]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){
    try{const r=await fetch('/api/board',{cache:'no-store'});if(r.status===401){setCard(null);return;}if(!r.ok)throw Error('Database unavailable');setCard(await r.json());setMessage('');}catch(e){setMessage(e.message);}
  }
  useEffect(()=>{refresh();const t=setInterval(refresh,5000);return()=>clearInterval(t);},[]);
  async function action(body){
    setBusy(true);
    try{const r=await fetch('/api/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(r.status===409?'The ticket changed. Refresh and try again.':r.status===503?'Server configuration or database unavailable.':'Request denied.');await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}
  }
  return <><header><span className="brand">SOFTWARE FACTORY</span>{card&&<button onClick={()=>action({action:'logout'})}>Sign out</button>}</header><main><h1>Factory board</h1>{!card?<form className="form" onSubmit={e=>{e.preventDefault();const key=e.currentTarget.elements.key.value;e.currentTarget.reset();action({action:'login',key});}}><label>Owner key<input type="password" name="key" required autoComplete="current-password"/></label><button className="primary" disabled={busy}>Sign in</button></form>:<div className="board">{lanes.map(([state,label])=><section className="lane" key={state}><h2>{label}</h2>{card.state===state&&<article className="card"><h3>Northstar security glossary</h3><p>Generate and check three plain-language definitions in the dedicated local workspace.</p><p>Attempts: {card.attempts}</p>{card.result&&<p>{card.result}</p>}{['backlog','failed'].includes(state)&&<button disabled={busy} onClick={()=>action({action:'enqueue',version:card.version})}>{state==='failed'?'Retry':'Move to To Do'}</button>}</article>}</section>)}</div>}<p role="status">{message}</p></main></>;
}
