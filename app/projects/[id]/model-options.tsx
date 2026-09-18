"use client";
import {useState} from 'react';
import {api} from '../../auth-form';
import type {ModelOptions} from '@/lib/spark/model-options';
export default function ModelChoices({options,projectId,messageId}:{options:ModelOptions;projectId:string;messageId:string}){
 const [selected,setSelected]=useState(options.selectedId);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const choice=options.models.find(m=>m.id===selected);
 return <div className="model-choices">
  <p>{options.models.length?'Here are a few free Roblox models we can use. Which one do you like?':'I couldn’t find a free model matching that description. Try describing the object more simply, such as “make a dog”.'}</p>
  <div className="creator-results">{options.models.map(model=><div className="creator-result" key={model.id}>
   {model.thumbnail&&<img src={model.thumbnail} alt={model.name} loading="lazy" referrerPolicy="no-referrer"/>}
   <h4>{model.name}</h4><p>{model.scriptCount===null?'Scripts not checked':model.scriptCount===0?'No scripts reported':`${model.scriptCount} scripts reported`}</p>
   <button className="asset-secondary" disabled={busy} aria-pressed={selected===model.id} onClick={async()=>{setBusy(true);setError('');try{await api(`projects/${projectId}/model-options`,'PATCH',{messageId,assetId:model.id});setSelected(model.id);}catch(e){setError(e instanceof Error?e.message:'Could not save selection.');}finally{setBusy(false);}}}>{selected===model.id?'Selected':'Choose this one'}</button>
  </div>)}</div>
  {error&&<p className="error" role="alert">{error}</p>}
  {choice&&<div className="notice" role="status"><strong>{choice.name} selected.</strong><p><button className="asset-secondary" disabled={busy} onClick={async()=>{
    setBusy(true);setError('');try{
      const response=await fetch(`/api/projects/${projectId}/model-download`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId,assetId:choice.id})});
      if(!response.ok){const result=await response.json() as {error?:string};throw Error(result.error||'Download unavailable.');}
      const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'Spark-model.rbxm';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setError(e instanceof Error?e.message:'Download unavailable.');}finally{setBusy(false);}
  }}>{busy?'Preparing download…':'Download for Roblox'}</button></p><p>In Studio, right-click Workspace → Insert from File and select the downloaded model. Review included scripts before running it.</p></div>}
 </div>;
}
