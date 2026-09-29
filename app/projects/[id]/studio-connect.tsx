"use client";
import {useState} from 'react';
import {api} from '../../auth-form';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';

export function StudioSend({projectId,messageId}:{projectId:string;messageId:string}){
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  return <div style={{marginTop:12}}><button className="button secondary" disabled={busy} onClick={async()=>{
    setBusy(true);try{const r=await api(`projects/${projectId}/studio/transfers`,'POST',{messageId});setStatus(r.status==='applied'?'Already inserted in Studio.':r.status==='rejected'?'This transfer was declined. Generate a revised build to send again.':r.expires<Date.now()?'This transfer has expired. Use the file download, or send a revised build.':'Ready for review. Open the Spark plugin in Studio and click Refresh.');}catch(e){setStatus(e instanceof Error?e.message:'Could not send to Studio.');}finally{setBusy(false);}
  }}>{busy?'Sending…':'Send to Studio'}</button>{status&&<p role="status" className="muted">{status}</p>}</div>;
}

export default function StudioConnect({projectId}:{projectId:string}){
  const [open,setOpen]=useState(false),[info,setInfo]=useState<any>(null),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){try{setInfo(await api(`projects/${projectId}/studio`));}catch(e){setError(e instanceof Error?e.message:'Could not load connection.');}}
  async function action(kind:'pair'|'disconnect'){
    setBusy(true);setError('');try{const r=await api(`projects/${projectId}/studio${kind==='pair'?'/pair':''}`,kind==='pair'?'POST':'DELETE');setCode(r.code||'');await refresh();}catch(e){setError(e instanceof Error?e.message:'Connection failed.');}finally{setBusy(false);}
  }
  return <><button className="button secondary" onClick={()=>{setOpen(true);void refresh();}}>Connect Roblox Studio</button><Sheet open={open} onOpenChange={setOpen}><SheetContent className="overflow-y-auto" style={{padding:24}}><SheetTitle>Roblox Studio · Preview</SheetTitle><SheetDescription>Review a build, approve it, and insert it into your open place.</SheetDescription>
    <p style={{marginTop:20}}>This first version adds new scripts and models. Existing objects are never replaced. Test in a copy of your place first.</p>
    <h3 style={{marginTop:24}}>1. Install the Spark plugin</h3>
    <p><a className="button" href="/spark-studio-plugin.lua" download>Download plugin</a></p>
    <ol style={{paddingLeft:20,listStyle:'decimal'}}><li>Open the downloaded file in a text editor and copy its contents.</li><li>In Studio, create a Script in ServerStorage and paste the contents into it.</li><li>Select that script and choose <strong>Plugins → Save as Local Plugin</strong>. Save it, then delete the temporary Script from ServerStorage.</li><li>Open <strong>Plugins → Spark → Open Spark</strong>. Allow the plugin to connect to Spark when Studio asks.</li></ol>
    <h3 style={{marginTop:24}}>2. Connect this project</h3><p>Open the intended place in Studio before pairing. The code expires in five minutes. Creating a new code disconnects the previous plugin.</p>
    <button className="button" disabled={busy} onClick={()=>void action('pair')}>Create pairing code</button>
    {code&&<div className="notice" style={{marginTop:12}}><label htmlFor="studio-code">Paste this code into the plugin</label><input id="studio-code" readOnly value={code} onFocus={e=>e.target.select()} style={{width:'100%',marginTop:8}}/><p>Keep this code private. The connection lasts 24 hours or until you close Studio.</p></div>}
    <h3 style={{marginTop:24}}>3. Send a build</h3><p>Use <strong>Send to Studio</strong> below a response with files, or after selecting a model. In the plugin, press <strong>Refresh</strong>, review the files and destinations, then <strong>Approve and insert</strong>.</p>
    <p>Scripts arrive disabled for review. Enable trusted scripts in Studio’s Properties when ready to test. You can undo an insertion with Studio’s Undo.</p>
    <p className="muted">For library models, Studio may require “Allow Loading Third Party Assets” in Experience Settings. Spark does not change this setting or remove Roblox’s model sandbox.</p>
    {info&&<div className="notice"><p>{info.connection?.token_expires>Date.now()?`Connected to place ${info.connection.place_id==='0'?'(unsaved place)':info.connection.place_id}`:'Not connected'}</p>{info.transfers?.length>0&&<p>{info.transfers.filter((t:any)=>t.status==='pending'&&t.expires>Date.now()).length} awaiting review · {info.transfers.filter((t:any)=>t.status==='applied').length} recently inserted</p>}<button onClick={()=>void refresh()}>Refresh status</button>{' · '}<button disabled={busy} onClick={()=>void action('disconnect')}>Disconnect</button></div>}
    {error&&<p role="alert" className="error">{error}</p>}
  </SheetContent></Sheet></>;
}
