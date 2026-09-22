import assert from 'node:assert/strict';
import {renderBuild} from '../lib/spark/generation.ts';
import {callOpenAI} from '../lib/spark/core.ts';

const script={name:'Build.server.luau',title:'Build',type:'Script',location:'ServerScriptService',source:'print("Ready")'};
const build={summary:'Build ready for review',models:[],scripts:[script],steps:['Enable and check the output.'],limitation:'Not run in Studio.'};
for(const source of ['-- implement later','--[[ only documentation ]]','--[=[ documentation ]=]','-- Spark file: Build.server.luau']) {
  assert.throws(()=>renderBuild(JSON.stringify({...build,scripts:[{...script,source}]})),/no implementation/);
}
assert.throws(()=>renderBuild(JSON.stringify({...build,scripts:[script,{...script,name:'Build.lua'}]})),/collide/);
for(const location of ['ServerScriptService','ReplicatedStorage > UI','game.ServerStorage']) {
  assert.throws(()=>renderBuild(JSON.stringify({...build,scripts:[{...script,type:'LocalScript',location}]})),/cannot run/);
}
assert.ok(renderBuild(JSON.stringify({...build,scripts:[{...script,type:'LocalScript',location:'StarterPlayer > StarterPlayerScripts'}]})));

let requests=[],settlements=0;
const messages=[{role:'user',content:'Build a house'}];
const result=await callOpenAI({},messages,{},async(_,options)=>{
  const request=JSON.parse(options.body);requests.push(request);
  return Response.json({status:'completed',output_text:requests.length===1?JSON.stringify({...build,scripts:[{...script,source:'-- TODO'}]}):JSON.stringify(build)});
},()=>settlements++);
assert.ok(result.includes('print("Ready")'));
assert.equal(requests.length,2);
assert.equal(settlements,1);
assert.ok(requests[1].instructions.includes('Script has no implementation'));
assert.deepEqual(requests[1].input,messages);
assert.ok(requests[0].instructions.includes('source-level walkthrough'));
let calls=0;
await assert.rejects(()=>callOpenAI({},messages,{},async()=>{
  calls++;return Response.json({status:'completed',output_text:'invalid'});
}),{code:'INVALID_BUILD'});
assert.equal(calls,2);
calls=0;
await assert.rejects(()=>callOpenAI({},messages,{},async()=>{
  calls++;return Response.json({status:'incomplete',output_text:'invalid'});
}),{code:'INCOMPLETE_RESPONSE'});
assert.equal(calls,1);
console.log('Generation validation, bounded repair, original context and honest verification checks passed.');
