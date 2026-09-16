// Explicit opt-in: this uses API credits. Run with OPENAI_API_KEY set privately.
import fs from 'node:fs';
import {callOpenAI} from '../lib/spark/core.ts';
import {extractFiles} from '../lib/spark/artifacts.ts';
import {GENERATION_VERSION} from '../lib/spark/generation.ts';
const key=process.env.OPENAI_API_KEY;
if(!key)throw new Error('Set OPENAI_API_KEY privately before running live evaluations.');
const cases=['Generate me an obby course','Make a small bench model','Write a script that spins a part slowly'];
const report=[];
for(const prompt of cases) {
 const started=Date.now();
 try {
  const text=await callOpenAI({OPENAI_API_KEY:key},[{role:'user',content:prompt}],{name:'Quality evaluation'});
  const files=extractFiles(text);
  const pass=files.length>0 && (prompt.includes('script')?files.some(f=>f.kind==='script'):files.some(f=>f.kind==='model'));
  report.push({prompt,pass,elapsedMs:Date.now()-started,files:files.map(f=>f.name),reply:text});
 }catch(e){report.push({prompt,pass:false,error:e.code||e.message});}
}
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/generation-evaluation.json',JSON.stringify({version:GENERATION_VERSION,at:new Date().toISOString(),report},null,2));
console.log(JSON.stringify(report.map(({reply,...summary})=>summary),null,2));
if(report.some(r=>!r.pass))process.exitCode=1;
