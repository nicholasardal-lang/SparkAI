import type { DB } from './core.ts';
import { extractFiles, fileTitle } from './artifacts.ts';
import { readModelOptions } from './model-options.ts';

export class StudioError extends Error {
  status:number;code:string;
  constructor(status:number, code:string, message:string){super(message);this.status=status;this.code=code;}
}
function error(status:number,message:string):never{throw new StudioError(status,'STUDIO',message);}
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
const secret=()=>crypto.randomUUID()+crypto.randomUUID();
const reply=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'no-store'}});
async function input(req:Request){
  const text=await req.text();
  if(text.length>2048)error(413,'Request too large.');
  try {const b=JSON.parse(text);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;return b;} catch {return error(400,'Invalid request.');}
}
export function studioPayload(content:string){
  const options=readModelOptions(content);
  if(options){
    const model=options.models.find(m=>m.id===options.selectedId);
    if(!model)error(400,'Choose a model first.');
    const assetId=Number(model.id);
    if(!Number.isSafeInteger(assetId)||assetId<=0)error(400,'Invalid model reference.');
    return {version:1,items:[{kind:'catalog',name:model.name.replace(/[/\\\x00-\x1f]/g,'_').slice(0,80)||'SparkModel',title:model.name,location:'Workspace',assetId}]};
  }
  const files=extractFiles(content);
  if(!files.length||files.length>12)error(400,'Choose a complete response with 1–12 downloadable files.');
  const items=files.map(file=>{
    const location=file.location.replace(/^game\./,'').split(/\s*>\s*|\//).map(p=>p.trim()).join('/');
    if(!/^(Workspace|ServerScriptService|ServerStorage|ReplicatedStorage|ReplicatedFirst|StarterGui|StarterPack|StarterPlayer)(\/[\w .-]{1,80}){0,8}$/.test(location))error(400,`Ask Spark to give ${fileTitle(file)} an exact Studio Explorer destination before sending it.`);
    if(file.source.length>100000)error(400,'This file is too large for Studio transfer. Use its download instead.');
    return {kind:file.kind,name:file.name.replace(/\.(?:server\.|client\.)?(?:luau|rbxmx)$/,''),title:fileTitle(file),location,...(file.kind==='model'?{model:JSON.parse(file.source)}:{scriptType:file.scriptType,source:file.source})};
  });
  const keys=items.map(item=>item.location+'/'+item.name);
  if(new Set(keys).size!==keys.length)error(400,'Two files have the same destination. Ask Spark to give them unique names.');
  const payload={version:1,items};
  if(JSON.stringify(payload).length>240000)error(400,'This build is too large for one transfer. Send smaller responses.');
  return payload;
}

// Browser routes are called only after the existing session, CSRF, paid-access and project-owner checks.
export async function studioWeb(req:Request,db:DB,projectId:string,action:string|undefined){
  if(!action&&req.method==='GET'){
    const connection=await db.prepare('SELECT token_expires,code_expires,last_seen,place_id FROM studio_connections WHERE project_id=?').bind(projectId).first();
    const transfers=(await db.prepare('SELECT id,status,created,expires FROM studio_transfers WHERE project_id=? ORDER BY created DESC LIMIT 10').bind(projectId).all()).results;
    return reply({connection,transfers});
  }
  if(action==='pair'&&req.method==='POST'){
    const code=secret(),expires=Date.now()+300000;
    await db.prepare('INSERT INTO studio_connections(project_id,code_hash,code_expires) VALUES (?,?,?) ON CONFLICT(project_id) DO UPDATE SET code_hash=excluded.code_hash,code_expires=excluded.code_expires,token_hash=NULL,token_expires=0,place_id=NULL,last_seen=NULL').bind(projectId,await digest(code),expires).run();
    return reply({code,expires});
  }
  if(!action&&req.method==='DELETE'){
    await db.prepare('DELETE FROM studio_connections WHERE project_id=?').bind(projectId).run();
    return reply({ok:true});
  }
  if(action==='transfers'&&req.method==='POST'){
    const b=await input(req);
    if(typeof b.messageId!=='string'||b.messageId.length>120)error(400,'Choose a response.');
    const message=await db.prepare("SELECT content FROM messages WHERE id=? AND project_id=? AND role='assistant'").bind(b.messageId,projectId).first();
    if(!message)error(404,'Response not found.');
    const payload=JSON.stringify(studioPayload(message.content)),fingerprint=await digest(payload),now=Date.now();
    // The same immutable build is never automatically requeued, even after its receipt expires.
    const existing=await db.prepare('SELECT id,status,expires FROM studio_transfers WHERE project_id=? AND fingerprint=?').bind(projectId,fingerprint).first();
    if(existing)return reply(existing);
    const count=await db.prepare("SELECT COUNT(*) AS n FROM studio_transfers WHERE project_id=? AND status='pending' AND expires>?").bind(projectId,now).first();
    if(count.n>=10)error(429,'Review the pending transfers in Studio before sending more.');
    const id=crypto.randomUUID();
    await db.prepare('INSERT INTO studio_transfers(id,project_id,fingerprint,payload,created,expires) VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,fingerprint) DO NOTHING').bind(id,projectId,fingerprint,payload,now,now+86400000).run();
    return reply(await db.prepare('SELECT id,status,expires FROM studio_transfers WHERE project_id=? AND fingerprint=?').bind(projectId,fingerprint).first());
  }
  return error(404,'Studio route not found.');
}

// Plugin routes deliberately do not use cookies. A single-use pairing code exchanges for a
// short-lived, project-only token. It cannot create prompts, spend credits or access other projects.
export async function studioPlugin(req:Request,db:DB,path:string[]){
  if(path.length===2&&path[1]==='pair'&&req.method==='POST'){
    const b=await input(req);
    if(typeof b.code!=='string'||!/^[a-f0-9-]{72}$/.test(b.code)||typeof b.placeId!=='string'||!/^\d{1,20}$/.test(b.placeId))error(400,'Enter a valid pairing code.');
    const token=secret(),now=Date.now();
    const row=await db.prepare('UPDATE studio_connections SET code_hash=NULL,code_expires=0,token_hash=?,token_expires=?,place_id=?,last_seen=? WHERE code_hash=? AND code_expires>? RETURNING project_id').bind(await digest(token),now+86400000,b.placeId,now,await digest(b.code),now).first();
    if(!row)error(401,'Pairing code expired or already used. Generate a new code in Spark.');
    const project=await db.prepare('SELECT name FROM projects WHERE id=?').bind(row.project_id).first();
    return reply({token,project:project.name,expires:now+86400000});
  }
  const token=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9-]{72})$/)?.[1];
  if(!token)error(401,'Connect Studio to Spark first.');
  const now=Date.now(),connection=await db.prepare('SELECT project_id,place_id FROM studio_connections WHERE token_hash=? AND token_expires>?').bind(await digest(token),now).first();
  if(!connection)error(401,'Connection expired or revoked. Reconnect in Spark.');
  if(req.headers.get('x-spark-place-id')!==connection.place_id)error(403,'This connection belongs to a different Studio place. Reconnect this place.');
  if(path.length===2&&path[1]==='transfers'&&req.method==='GET'){
    await db.prepare('UPDATE studio_connections SET last_seen=? WHERE project_id=?').bind(now,connection.project_id).run();
    const jobs=(await db.prepare("SELECT id,payload FROM studio_transfers WHERE project_id=? AND status='pending' AND expires>? ORDER BY created LIMIT 10").bind(connection.project_id,now).all()).results;
    return reply({transfers:jobs.map((j:any)=>({id:j.id,...JSON.parse(j.payload)}))});
  }
  if(path.length===3&&path[1]==='transfers'&&req.method==='POST'){
    const b=await input(req);
    if(!['applied','rejected'].includes(b.status))error(400,'Invalid transfer result.');
    const row=await db.prepare("UPDATE studio_transfers SET status=? WHERE id=? AND project_id=? AND (status='pending' OR status=?) RETURNING id").bind(b.status,path[2],connection.project_id,b.status).first();
    if(!row)error(409,'Transfer is unavailable or already completed.');
    return reply({ok:true});
  }
  return error(404,'Studio route not found.');
}
