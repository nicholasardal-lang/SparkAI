// Explicit paid evaluation: run only with an authorized private OPENAI_API_KEY.
import fs from 'node:fs';
import {callOpenAI,creditQuote} from '../lib/spark/core.ts';
import {extractFiles,fileTitle} from '../lib/spark/artifacts.ts';
import {usageMetrics} from '../lib/spark/models.ts';
const key=process.env.OPENAI_API_KEY;
if(!key)throw new Error('Set OPENAI_API_KEY privately.');
const prompts=[
 'Make a small beginner obby with lava that kills the player. Include a working checkpoint. Keep it small and easy to import.',
 'Update this obby so the lava deals 25 damage per second instead of instantly killing the player. Keep the existing course and working checkpoint. Give complete replacement files only for what changes.',
];
const messages=[],report=[];
for(const content of prompts){
 messages.push({role:'user',content});let usage;const started=Date.now();
 try{
  const quote=creditQuote({},messages,{name:'Follow-up quality evaluation'});
  const reply=await callOpenAI({OPENAI_API_KEY:key},messages,{name:'Follow-up quality evaluation'},fetch,u=>usage=u);
  const files=extractFiles(reply);
  const scripts=files.filter(f=>f.kind==='script').map(f=>f.source).join('\n');
  const checks={downloadable:files.length>0,checkpointUsesSpawnLocation:/RespawnLocation\s*=/.test(scripts),neutralSpawns:/\.Neutral\s*=\s*true/.test(scripts)&&!/\.Neutral\s*=\s*false/.test(scripts),titles:files.every(f=>f.title&&fileTitle(f)!==f.name),stableReplacement:report.length===0||files.every(f=>report[0].files.some(old=>old.name===f.name))};
  const pass=Object.values(checks).every(Boolean)&&files.some(f=>f.kind==='script')&&files.every(f=>f.title&&fileTitle(f)!==f.name);
  report.push({prompt:content,pass,checks,files:files.map(f=>({name:f.name,title:fileTitle(f),location:f.location})),elapsedMs:Date.now()-started,...usageMetrics(quote.selection.model,usage),reply});
  messages.push({role:'assistant',content:reply});
 }catch(e){report.push({prompt:content,pass:false,error:e.code||e.message});break;}
}
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/followup-evaluation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.map(({reply,...r})=>r),null,2));
if(report.some(r=>!r.pass))process.exitCode=1;
