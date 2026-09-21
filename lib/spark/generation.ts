import {modelFile,scriptFile} from './artifacts.ts';
export const GENERATION_VERSION='adaptive-chat-v1';
export function isBuildRequest(prompt:string) {
  if(/\b(idea|ideas|plan|explain|what is|how do|how to)\b/i.test(prompt)&& !/\b(download|file|script|code)\b/i.test(prompt)) return false;
  return /\b(generate|make|build|create|write|add|fix|change|update)\b/i.test(prompt)&&/\b(obby|course|platform|floor|water|splash|bench|house|tree|prop|model|script|code|checkpoint|lava|door|coins?|game|npc|enemy|enemies|shop|gui|ui|button|weapon|gun|sword|pet|cat|dog|vehicle|car|leaderboard|round|timer|teleporter|it|this|that)\b/i.test(prompt);
}
const obj=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str={type:'string'};
const triple=(min:number,max:number)=>({type:'array',items:{type:'number',minimum:min,maximum:max},minItems:3,maxItems:3});
export const buildFormat={type:'json_schema',name:'spark_build',strict:true,schema:obj({
  summary:str,
  models:{type:'array',maxItems:4,items:obj({name:str,title:str,parts:{type:'array',minItems:1,maxItems:30,items:obj({name:str,shape:{type:'string',enum:['Block','Ball','Cylinder','Wedge']},size:triple(.05,2048),position:triple(-10000,10000),color:triple(0,255)})}})},
  scripts:{type:'array',maxItems:8,items:obj({name:str,title:str,type:{type:'string',enum:['Script','LocalScript','ModuleScript']},location:str,source:str})},
  steps:{type:'array',maxItems:12,items:str},
  limitation:str,
})};
export const beginnerInstructions=`Use approachable language by default and adapt depth to the request and conversation. For code requests, lead with complete readable code and keep prose to essential placement and one test unless the user asks for an explanation. Honor requests for code only. Use consistent indentation, descriptive names, and short useful comments; avoid narrating every line. Prefer the fewest scripts needed for the requested behavior, and do not add unsolicited sounds, spawns, or systems. Never substitute empty asset properties or placeholder behavior for a requested effect; use a self-contained implementation where possible, otherwise identify the required dependency clearly. Explain technical choices, architecture, tradeoffs and debugging evidence in detail when useful or requested. Choose sensible defaults for underspecified simple requests, but do not reduce explicit complex requirements to a toy example. Do not ask a list of design questions for a simple build request. Match explanation length to the task. Provide complete usable code and enough setup and testing detail; technical explanations may appear in prose as well as useful source comments. Never say a static part moves, kills, saves progress or gives rewards unless you also supply the necessary working script. Do not claim runtime testing occurred. No made-up asset IDs or external require/loadstring calls. For an obby, prefer a compact easy course with wide anchored platforms, small edge-to-edge gaps (2–4 studs), modest height changes, a start and finish. If no behavior script is supplied, explicitly call it a static practice course without checkpoints or hazards. Place the course above the baseplate. Keep model data out of prose. Match script references exactly to generated model and part names. For an unspecified simple playable obby, a few platforms, one hazard and a checkpoint are reasonable defaults; honor larger explicit requirements. Prefer a single ServerScriptService builder script that creates the small course, real SpawnLocations and behavior together; use loops for repeated platforms. Use as much code as correctness requires; use modules or separate client/server scripts when the task benefits from them. Do not output the same geometry both as a model and as construction code. For small interactive builds, a self-contained server script can simplify setup. For larger tasks, use appropriately separated scripts with clear interfaces and client/server boundaries. Create required folders, remotes, tools and UI in code when feasible instead of asking beginners to assemble dependencies by hand. Never recreate an existing build when the user requests a focused change: use its exact names and preserve unrelated behavior. Keep authority for damage, rewards and saved progress on the server; validate client arguments, distances and cooldowns. Handle players already in the server, respawning and duplicate event connections where relevant. Checkpoint rule: for a team-free obby, explicitly set spawn.Neutral=true and AllowTeamChangeOnTouch=false; Player.RespawnLocation only accepts a Workspace SpawnLocation that is neutral or matches the player TeamColor. Assign each player.RespawnLocation to the start SpawnLocation on join, then to the checkpoint SpawnLocation on valid touch; never rely on random selection between multiple neutral spawns or teleport-only checkpoint bookkeeping. Damage-over-time rule: use one server damage loop with a cooldown per humanoid and track individual touching body parts (a set), or a server overlap query; one limb leaving must not stop damage while another still touches, and leaving/re-entering must not spawn duplicate damage loops. Remove departed players from tracking tables. Deliver the requested scope with concrete manual tests. If scope exceeds the available budget, explain the boundary clearly and provide a coherent complete portion rather than silently omitting requirements. Give each file a short descriptive title such as "Lava that resets players" or "Cat jump button", separate from its technical filename. Do not add decorative checkpoints or rewards that look functional but do nothing. Only include a checkpoint when it actually respawns the player, otherwise omit it. For a follow-up edit, provide complete replacement files with the same technical names, not fragments, and tell the user to replace the old scripts so duplicate event handlers do not run. Do not duplicate download-card import instructions; steps should cover only build-specific setup and one concrete gameplay test. Check the output for completeness, reachable geometry, correct script placement and missing dependencies before responding.`;
export function renderBuild(raw:string):string {
  const result=JSON.parse(raw);
  if(!result||typeof result.summary!=='string'||!Array.isArray(result.models)||!Array.isArray(result.scripts)||!Array.isArray(result.steps)||typeof result.limitation!=='string'||result.models.length>4||result.scripts.length>8||result.steps.length>12) throw new Error('Invalid build');
  if(!result.models.length&&!result.scripts.length) throw new Error('No downloadable file');
  const prose=(s:unknown)=>{if(typeof s!=='string'||s.length>12000||s.includes('```'))throw new Error('Invalid build text');return s;};
  const names=new Set<string>();
  for(const asset of [...result.models,...result.scripts]) {
    if(typeof asset.name!=="string"||names.has(asset.name.toLowerCase()))throw new Error('Duplicate or missing file name');
    names.add(asset.name.toLowerCase());
    if(asset.title!==undefined && (typeof asset.title!=="string"||!asset.title.trim()||asset.title.length>90||/[\r\n]/.test(asset.title)))throw new Error('Invalid file title');
  }
  for(const model of result.models) {
    if(!Array.isArray(model.parts)||new Set(model.parts.map((part:any)=>part.name)).size!==model.parts.length)throw new Error('Duplicate part names');
  }
  const files=result.models.map((model:any)=>{modelFile(JSON.stringify(model));return '```spark-model\n'+JSON.stringify(model)+'\n```';});
  for(const script of result.scripts) {
    if(!['Script','LocalScript','ModuleScript'].includes(script.type)||typeof script.source!=='string'||!script.source.trim()||script.source.includes('```'))throw new Error('Invalid script');
    const name=prose(script.name);
    // The destination is a parent folder/part, never the script file itself.
    const location=prose(script.location).replace(/\s*>\s*[^>]+\.lua[u]?\s*$/i,"");
    if(/[\r\n]/.test(name+location)||!location.trim()||!/^[\w.-]+$/.test(name))throw new Error('Invalid script metadata');
    const cleanSource=script.source.replace(/^--\s*Spark (?:file|title|type|location):[^\n]*\n?/gm,"").trim();
    const source=`-- Spark file: ${name}\n${script.title?"-- Spark title: "+script.title+"\n":""}-- Spark type: ${script.type}\n-- Spark location: ${location}\n${cleanSource}`;
    scriptFile(source);files.push('```luau\n'+source+'\n```');
  }
  return [prose(result.summary),...files,result.steps.map((s:unknown,i:number)=>`${i+1}. ${prose(s)}`).join('\n'),prose(result.limitation)].filter(Boolean).join('\n\n');
}
