"use client";
import {useRef,useState,type FormEvent} from 'react';
import {api} from '../../auth-form';
import type {StoreModel} from '@/lib/spark/creator-store';
export default function CreatorStore({projectId,onChoose}:{projectId:string;onChoose:(model:StoreModel)=>void}){
 const [query,setQuery]=useState('');const [models,setModels]=useState<StoreModel[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);const [searched,setSearched]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [selected,setSelected]=useState<StoreModel|null>(null);
 const request=useRef(0);
 async function search(event?:FormEvent,more=false){
  event?.preventDefault();const term=more?searched:query.trim();if(!term||busy)return;
  const version=++request.current;setBusy(true);setError('');
  if(!more){setModels([]);setCursor(null);setSelected(null);setSearched('');}
  try{const result=await api(`projects/${projectId}/creator-store?q=${encodeURIComponent(term)}${more&&cursor?'&cursor='+encodeURIComponent(cursor):''}`);
   if(version!==request.current)return;
   setModels(old=>more?[...old,...result.models.filter((m:StoreModel)=>!old.some(o=>o.id===m.id))]:result.models);
   setCursor(result.nextPageToken);setSearched(term);
  }catch(e){setError(e instanceof Error?e.message:'Search could not load.');}
  finally{if(version===request.current)setBusy(false);}
 }
 return <section className="creator-search" aria-label="Find free Roblox models">
  <h3>Find free Roblox models</h3><p>No assets of your own? Search Roblox’s Creator Store. Searching costs no Spark Credits.</p>
  <form onSubmit={search}><label htmlFor="store-query">What do you need?</label><div className="creator-search-row"><input id="store-query" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Dog, medieval house, trees…" required/><button className="button" disabled={busy||!query.trim()}>{busy?'Searching…':'Search free models'}</button></div></form>
  {error&&<p className="error" role="alert">{error} <a href="https://create.roblox.com/store/models" target="_blank" rel="noopener noreferrer">Open Creator Store ↗</a></p>}
  {searched&&<p role="status">{models.length?`${models.length} free models for “${searched}”`:'No free models found on this page. Try a broader search or the next page.'}</p>}
  <div className="creator-results">{models.map(model=><article key={model.id} className="creator-result">
   {model.thumbnail?<img src={model.thumbnail} alt={model.name} loading="lazy" referrerPolicy="no-referrer"/>:<div className="creator-no-image">Preview unavailable</div>}
   <h4>{model.name}</h4><p>By {model.creator}{model.verified?' · Verified creator':''}</p>
   <p><strong>Free</strong> · {model.scriptCount===null?'Script count unknown':model.scriptCount===0?'No scripts reported':`${model.scriptCount} scripts reported`}</p>
   <button className="asset-secondary" onClick={()=>setSelected(model)}>Use this model</button> <a href={model.url} target="_blank" rel="noopener noreferrer">View on Roblox ↗</a>
  </article>)}</div>
  {cursor&&<button className="asset-secondary" disabled={busy} onClick={()=>void search(undefined,true)}>{busy?'Loading…':'Load more free models'}</button>}
  {selected&&<div className="creator-selection" role="region" aria-label="Use selected Roblox model">
   <h4>Use {selected.name}</h4><ol><li><a href={selected.url} target="_blank" rel="noopener noreferrer">Open this model on Roblox ↗</a> and get it with your Roblox account. Check that it is still free.</li><li>In Studio, open Toolbox → Inventory → My Models and insert the model into your game.</li><li>Inspect any included scripts before pressing Play. Spark has not tested this model.</li></ol>
   <p>That’s all you need to use the model itself. To let Spark arrange it in a scene, register its dimensions after importing it.</p>
   <button className="asset-secondary" onClick={()=>onChoose(selected)}>Add reference for scene planning</button>
  </div>}
 </section>;
}
