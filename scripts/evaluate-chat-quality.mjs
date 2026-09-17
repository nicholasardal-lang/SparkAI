// Small paid smoke evaluation; requires an explicitly configured private key.
import fs from 'node:fs';
import {callOpenAI,creditQuote} from '../lib/spark/core.ts';
import {usageMetrics} from '../lib/spark/models.ts';
import {extractFiles} from '../lib/spark/artifacts.ts';
import {compactConversation} from '../lib/spark/context.ts';
if(!process.env.OPENAI_API_KEY) throw Error('Set OPENAI_API_KEY privately.');
const env={OPENAI_API_KEY:process.env.OPENAI_API_KEY};
const cases=[
 {name:'simple',messages:[{role:'user',content:'What is a Roblox checkpoint? Explain in two sentences.'}]},
 {name:'coding',messages:[{role:'user',content:'Write a server script that rotates an anchored part named DisplayPart. Use RunService, delta time and safe missing-part handling. Include concise setup and a manual test.'}]},
 {name:'complex-followup',messages:[{role:'user',content:'Audit a Roblox DataStore inventory design for concurrent saves and security. We use UpdateAsync, server-owned item grants, and no client writes. Explain the three most important remaining failure risks, without code.'},{role:'assistant',content:'I can review the concurrency risks and recovery design.'},{role:'user',content:'Yes, do that.'}]},
];
const report=[];
for(const c of process.argv.includes('--summary-only')?[]:cases) {
 const quote=creditQuote({},c.messages,{name:'Phase 1 evaluation'});let usage;
 const started=Date.now();
 try {
  const reply=await callOpenAI(env,c.messages,{name:'Phase 1 evaluation'},fetch,u=>usage=u,quote);
  const pass=c.name==='coding'?extractFiles(reply).some(f=>f.kind==='script'&&/Heartbeat|Stepped/.test(f.source)):reply.length>30;
  report.push({name:c.name,pass,model:quote.selection.model,reasoning:quote.selection.reasoning,maxOutput:quote.maxOutput,elapsedMs:Date.now()-started,...usageMetrics(quote.selection.model,usage),reply});
 } catch(e) {report.push({name:c.name,pass:false,error:e.code||e.message});}
}
let summaryUsage;
try {
 const memory=await compactConversation({memory:undefined,batches:[[{id:'u1',created:1,role:'user',content:'Use mobile controls and save inventories under CoinsStore_v2. Never add trading.'},{id:'a1',created:2,role:'assistant',content:'Understood. I suggested a blue menu but the user has not approved it.'}]]},env.OPENAI_API_KEY,fetch,AbortSignal.timeout(60000),u=>summaryUsage=u);
 report.push({name:'durable-summary',pass:memory.summary.includes('CoinsStore_v2')&&/trading/i.test(memory.summary),...usageMetrics('gpt-5-mini',summaryUsage),reply:memory.summary});
}catch(e){report.push({name:'durable-summary',pass:false,error:e.code||e.message});}
fs.writeFileSync('work/chat-quality-evaluation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.map(({reply,...r})=>r),null,2));
if(report.some(r=>!r.pass))process.exitCode=1;
