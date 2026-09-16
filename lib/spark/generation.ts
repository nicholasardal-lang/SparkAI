import {modelFile,scriptFile} from './artifacts.ts';
export const GENERATION_VERSION='beginner-build-v3';
export function isBuildRequest(prompt:string) {
  if(/\b(idea|ideas|plan|explain|what is|how do|how to)\b/i.test(prompt)&& !/\b(download|file|script|code)\b/i.test(prompt)) return false;
  return /\b(generate|make|build|create|write|add|fix|change|update)\b/i.test(prompt)&&/\b(obby|course|platform|bench|house|tree|prop|model|script|code|checkpoint|lava|door|coin|game|it|this|that)\b/i.test(prompt);
}
const obj=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str={type:'string'};
const triple=(min:number,max:number)=>({type:'array',items:{type:'number',minimum:min,maximum:max},minItems:3,maxItems:3});
export const buildFormat={type:'json_schema',name:'spark_build',strict:true,schema:obj({
  summary:str,
  models:{type:'array',maxItems:2,items:obj({name:str,parts:{type:'array',minItems:1,maxItems:30,items:obj({name:str,shape:{type:'string',enum:['Block','Ball','Cylinder','Wedge']},size:triple(.05,2048),position:triple(-10000,10000),color:triple(0,255)})}})},
  scripts:{type:'array',maxItems:3,items:obj({name:str,type:{type:'string',enum:['Script','LocalScript','ModuleScript']},location:str,source:str})},
  steps:{type:'array',maxItems:4,items:str},
  limitation:str,
})};
export const beginnerInstructions=`Spark is for beginners. Use everyday words, choose sensible defaults, and deliver a small usable result instead of an architecture lecture. Do not ask a list of design questions for a simple build request. Keep explanations short: one sentence describing the result, files, and at most four concrete steps. Technical detail belongs in source comments. Never say a static part moves, kills, saves progress or gives rewards unless you also supply the necessary working script. Do not claim runtime testing occurred. No made-up asset IDs or external require/loadstring calls. For an obby, prefer a compact easy course with wide anchored platforms, small edge-to-edge gaps (2–4 studs), modest height changes, a start and finish. If no behavior script is supplied, explicitly call it a static practice course without checkpoints or hazards. Place the course above the baseplate. Keep model data out of prose. Match script references exactly to generated model and part names. For interactive builds, prefer one self-contained server script that creates its required parts and connections, plus a LocalScript only when player input needs it. Create required folders, remotes, tools and UI in code when feasible instead of asking beginners to assemble dependencies by hand. Never recreate an existing build when the user requests a focused change: use its exact names and preserve unrelated behavior. Keep authority for damage, rewards and saved progress on the server; validate client arguments, distances and cooldowns. Handle players already in the server, respawning and duplicate event connections where relevant. Deliver a complete small playable slice with one short Play-test step, then offer a concrete next improvement. Check the output for completeness, reachable geometry, correct script placement and missing dependencies before responding.`;
export function renderBuild(raw:string):string {
  const result=JSON.parse(raw);
  if(!result||typeof result.summary!=='string'||!Array.isArray(result.models)||!Array.isArray(result.scripts)||!Array.isArray(result.steps)||typeof result.limitation!=='string'||result.models.length>2||result.scripts.length>3||result.steps.length>4) throw new Error('Invalid build');
  if(!result.models.length&&!result.scripts.length) throw new Error('No downloadable file');
  const prose=(s:unknown)=>{if(typeof s!=='string'||s.length>1500||s.includes('```'))throw new Error('Invalid build text');return s;};
  const files=result.models.map((model:any)=>{modelFile(JSON.stringify(model));return '```spark-model\n'+JSON.stringify(model)+'\n```';});
  for(const script of result.scripts) {
    if(!['Script','LocalScript','ModuleScript'].includes(script.type)||typeof script.source!=='string'||!script.source.trim()||script.source.includes('```'))throw new Error('Invalid script');
    const name=prose(script.name);
    // The destination is a parent folder/part, never the script file itself.
    const location=prose(script.location).replace(/\s*>\s*[^>]+\.lua[u]?\s*$/i,"");
    if(/[\r\n]/.test(name+location)||!location.trim()||!/^[\w.-]+$/.test(name))throw new Error('Invalid script metadata');
    const cleanSource=script.source.replace(/^--\s*Spark (?:file|type|location):[^\n]*\n?/gm,"").trim();
    const source=`-- Spark file: ${name}\n-- Spark type: ${script.type}\n-- Spark location: ${location}\n${cleanSource}`;
    scriptFile(source);files.push('```luau\n'+source+'\n```');
  }
  return [prose(result.summary),...files,result.steps.map((s:unknown,i:number)=>`${i+1}. ${prose(s)}`).join('\n'),prose(result.limitation)].filter(Boolean).join('\n\n');
}
