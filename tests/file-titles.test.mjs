import assert from 'node:assert/strict';
import {fileTitle,scriptFile,modelFile,extractFiles} from '../lib/spark/artifacts.ts';
import {renderBuild,isBuildRequest} from '../lib/spark/generation.ts';
assert.equal(fileTitle(scriptFile('-- Spark file: CatJumpButton.client.luau\n-- Spark type: LocalScript\nprint(1)')),'Cat Jump Button');
assert.equal(fileTitle(scriptFile('print(1)'), 'Checkpoint respawn helper.\n```luau\nprint(1)\n```'),'Checkpoint respawn helper.');
const model={name:'LavaCourse',title:'Beginner lava obstacle course',parts:[{name:'Start',shape:'Block',size:[8,1,8],position:[0,2,0],color:[80,150,200]}]};
assert.equal(fileTitle(modelFile(JSON.stringify(model))),model.title);
const result={summary:'A lava course.',models:[model],scripts:[{name:'LavaKill',title:'Lava that resets players',type:'Script',location:'ServerScriptService',source:'print("fixture")'}],steps:['Press Play.'],limitation:'Fixture only.'};
const files=extractFiles(renderBuild(JSON.stringify(result)));
assert.equal(fileTitle(files[1]),'Lava that resets players');
assert.equal(files[1].name,'LavaKill.server.luau');
assert.throws(()=>renderBuild(JSON.stringify({...result,models:[{...model,parts:[model.parts[0],model.parts[0]]}]})),/Duplicate part/);
assert.throws(()=>renderBuild(JSON.stringify({...result,scripts:[result.scripts[0],result.scripts[0]]})),/Duplicate/);
assert.throws(()=>renderBuild(JSON.stringify({...result,scripts:[{...result.scripts[0],title:'Unsafe\nmetadata'}]})),/Invalid file title/);
console.log('Descriptive titles, legacy fallback, stable filenames and duplicate-name checks passed.');

for(const prompt of ["Create a coin shop","Make an NPC","Build a GUI button","Add a teleporter"])assert.ok(isBuildRequest(prompt),prompt);
assert.equal(isBuildRequest("Explain what an NPC is"),false);
