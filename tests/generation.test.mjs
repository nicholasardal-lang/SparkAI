import assert from 'node:assert/strict';
import {normalizeArtifactMarkdown,extractFiles} from '../lib/spark/artifacts.ts';
import {isBuildRequest,renderBuild} from '../lib/spark/generation.ts';
import {selectModel} from '../lib/spark/models.ts';
import {callOpenAI} from '../lib/spark/core.ts';
const model={name:'StarterObby',parts:[{name:'Start',shape:'Block',size:[8,1,8],position:[0,3,0],color:[100,200,255]}]};
const raw=JSON.stringify(model);
for(const text of [raw,'Here is your build.\n'+raw+'\nImport it below.','```json\n'+raw+'\n```','```\n'+raw+'\n```','```spark-model\n'+raw+'\n```']) {
 assert.equal(extractFiles(text).length,1);
 assert.equal((normalizeArtifactMarkdown(text).match(/```spark-model/g)||[]).length,1);
}
assert.equal(normalizeArtifactMarkdown('```luau\nlocal x = {name="a"}\n```'),'```luau\nlocal x = {name="a"}\n```');
assert.equal(normalizeArtifactMarkdown('An ordinary {example} stays here.'),'An ordinary {example} stays here.');
assert.ok(isBuildRequest('Generate me an obby course'));
assert.equal(selectModel('Generate me an obby course').model,'gpt-5.6-terra');
assert.equal(isBuildRequest('Give me an obby idea'),false);
const answer={summary:'A small practice course.',models:[model],scripts:[],steps:['Import into Workspace.','Press Play.'],limitation:'Static platforms only.'};
assert.equal(extractFiles(renderBuild(JSON.stringify(answer))).length,1);
assert.throws(()=>renderBuild(JSON.stringify({...answer,models:[]})));
assert.throws(()=>renderBuild(JSON.stringify({...answer,models:[{...model,parts:[{...model.parts[0],size:[-2,1,1]}]}]})));
let charged=false;
const env={OPENAI_API_KEY:'fixture'};
const messages=[{role:'user',content:'Generate me an obby course'}];
const reply=await callOpenAI(env,messages,{},async(_,options)=>{
 const payload=JSON.parse(options.body);assert.equal(payload.text.format.strict,true);assert.equal(payload.model,'gpt-5.6-terra');
 return Response.json({status:'completed',output_text:JSON.stringify(answer)});
},()=>{charged=true;});
assert.ok(charged);assert.equal(extractFiles(reply).length,1);
for(const output of [{status:'completed',output_text:'bad JSON'},{status:'incomplete',output_text:'{"models":['}]) {
 charged=false;await assert.rejects(()=>callOpenAI(env,messages,{},async()=>Response.json(output),()=>{charged=true;}));assert.equal(charged,false);
}
console.log('Legacy model recovery, beginner routing, structured generation and rejection without usage settlement passed.');
