import assert from 'node:assert/strict';
import {buildFormat,renderBuild,generationQualityInstructions} from '../lib/spark/generation.ts';
import {callOpenAI} from '../lib/spark/core.ts';
const script={name:'Build.server.luau',title:'Complete build',type:'Script',location:'ServerScriptService',source:'print("Ready")'};
const answer={summary:'Complete build',splitReason:'',models:[],scripts:[script],steps:['Press Play.'],limitation:'Not run in Studio.'};
const split={...answer,scripts:[script,{...script,name:'Helper.luau',type:'ModuleScript',source:'return {}'}]};
for(const request of ['Build a house','Create a moving platform','Make a castle obby','Make an NPC patrol script']) {
  assert.ok(renderBuild(JSON.stringify(answer),request));
  assert.throws(()=>renderBuild(JSON.stringify(split),request),/splitReason/);
}
assert.ok(renderBuild(JSON.stringify({...split,splitReason:'The user requested a separate reusable module and its server caller.'}),'Create a script with a separate module'));
assert.ok(buildFormat.schema.required.includes('splitReason'));
assert.ok(generationQualityInstructions.includes('For purely local UI or camera behavior'));
let calls=0;
await callOpenAI({},[{role:'user',content:'Create a moving platform'}],{},async(_,options)=>{
  const body=JSON.parse(options.body);
  calls++;
  if(calls===2) assert.ok(body.instructions.includes('Multiple files require splitReason'));
  return Response.json({status:'completed',output_text:JSON.stringify(calls===1?split:answer)});
});
assert.equal(calls,2);
console.log('Single-install defaults, justified multi-file exceptions and automatic repair passed.');
