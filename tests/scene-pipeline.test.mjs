import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle } from '../lib/spark/core.ts';
import { LEGAL_VERSION } from '../lib/spark/legal.ts';
import { planScene, sceneQuote, searchProjectAssets } from '../lib/spark/scene-planner.ts';
import { shouldUseAssetStudio } from '../lib/spark/scene-intent.ts';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
const DB = {
  prepare(sql) { return { args: [], bind(...args) {this.args=args;return this;}, async first() {return sqlite.prepare(sql).get(...this.args)||null;}, async all() {return {results:sqlite.prepare(sql).all(...this.args)};}, async run() {return sqlite.prepare(sql).run(...this.args);} }; },
  async batch(statements) {sqlite.exec('BEGIN');try {const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},
};
const env={DB,OPENAI_API_KEY:'test-fixture-not-a-real-key'};
let providerCalls=0;
const deniedFetch=async()=>{throw new Error('Unexpected external request in isolated test');};
async function request(path,method='GET',body,cookie='',fetcher=deniedFetch,origin='https://spark.test') {
  const r=await handle(new Request('https://spark.test/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,fetcher);
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function account(number) {
  const a=await request('auth/signup','POST',{email:`scene${number}@example.test`,username:`scene_builder_${number}`,password:'test-fixture-password-123',acceptedLegal:true,legalVersion:LEGAL_VERSION});
  assert.equal(a.status,200);
  sqlite.prepare("INSERT INTO credit_buckets(id,user_id,remaining,source) VALUES (?,?,100000,'test-fixture')").run('fixture'+number,a.data.user.id);
  const p=await request('projects','POST',{name:'Blacksmith scene '+number,description:'Consistent weathered medieval style'},a.cookie);
  assert.equal(p.status,201);
  return {cookie:a.cookie,userId:a.data.user.id,pid:p.data.id};
}
const a=await account(1),b=await account(2),base=`projects/${a.pid}`;
assert.equal((await request(base+'/assets')).status,401);
assert.equal((await request(base+'/assets','GET',undefined,b.cookie)).status,404);
const assetSpec={name:'Anvil',kind:'mesh',robloxId:'123456',sourceUrl:'',license:'Test fixture rights attestation; not an actual asset.',tags:['anvil','blacksmith'],size:[4,2,2],material:{material:'Metal',pbr:{normalMap:'987654'}}};
assert.equal((await request(base+'/assets','POST',assetSpec,a.cookie,deniedFetch,'https://evil.test')).status,403);
assert.equal((await request(base+'/assets','POST',{...assetSpec,robloxId:'https://evil.test'},a.cookie)).status,400);
const assetResponse=await request(base+'/assets','POST',assetSpec,a.cookie);
assert.equal(assetResponse.status,201);const asset=assetResponse.data.asset;
assert.equal((await request(base+'/assets','GET',undefined,a.cookie)).data.assets.length,1);
const node={id:'anvil-1',name:'Anvil',assetId:asset.id,size:[4,2,2],position:[0,2,0],rotation:[0,35,0]};
const scene={version:1,name:'Blacksmith preview',style:'Weathered timber, dark iron and warm lighting. Static scene requiring manual Studio review.',nodes:[node],missingAssets:[]};
function toolResponse(name,args,index=0) {
  return Response.json({id:'resp_fixture_'+index,status:'completed',usage:{input_tokens:500,output_tokens:200},output:[
    {type:'reasoning',id:'rs_fixture_'+index,summary:[],encrypted_content:'fixture-encrypted-content'},
    {type:'function_call',name,call_id:'call_fixture_'+index,arguments:JSON.stringify(args)},
  ]});
}
function plannerFake(plan=scene) {
  let n=0;
  return async(url,options)=>{
    providerCalls++;assert.equal(url,'https://api.openai.com/v1/responses');
    const payload=JSON.parse(options.body);
    assert.equal(payload.store,false);assert.equal(payload.parallel_tool_calls,false);assert.equal(payload.model,'gpt-5.6-terra');
    assert.deepEqual(payload.include,['reasoning.encrypted_content']);
    assert.ok(payload.tools.every(t=>['search_project_assets','submit_scene'].includes(t.name)));
    if(n++===0) {assert.equal(payload.tool_choice.name,'search_project_assets');return toolResponse('search_project_assets',{query:'blacksmith'},0);}
    assert.ok(payload.input.some(i=>i.type==='reasoning'&&i.encrypted_content==='fixture-encrypted-content'));
    assert.ok(payload.input.some(i=>i.type==='function_call_output'&&JSON.parse(i.output).totalInLibrary>=0));
    return toolResponse('submit_scene',{plan},1);
  };
}
async function save(prompt='Create a detailed blacksmith shop.') {
  const id=crypto.randomUUID();const r=await request(base+'/scene-jobs','POST',{id,prompt},a.cookie);
  assert.equal(r.status,201);assert.equal(r.data.job.status,'queued');return {id,prompt,path:base+'/scene-jobs/'+id};
}
const job=await save();
assert.equal((await request(base+'/scene-jobs','POST',{id:job.id,prompt:job.prompt},a.cookie)).data.job.id,job.id);
assert.equal((await request(base+'/scene-jobs','POST',{id:job.id,prompt:'different'},a.cookie)).status,409);
assert.equal((await request(`projects/${b.pid}/scene-jobs`,'POST',{id:job.id,prompt:job.prompt},b.cookie)).status,409);
assert.equal((await request(job.path,'GET',undefined,b.cookie)).status,404);
const estimate=await request(job.path+'/estimate','POST',{},a.cookie);
assert.equal(estimate.status,200);assert.ok(estimate.data.maxCredits>=estimate.data.estimatedCredits);assert.equal(providerCalls,0);
assert.equal((await request(job.path+'/run','POST',{},a.cookie)).data.code,'QUOTE_CHANGED');
delete env.OPENAI_API_KEY;
assert.equal((await request(job.path+'/run','POST',estimate.data,a.cookie)).data.code,'AI_SETUP_REQUIRED');
env.OPENAI_API_KEY='test-fixture-not-a-real-key';
assert.equal((await request(job.path,'GET',undefined,a.cookie)).data.job.status,'queued');
const before=sqlite.prepare('SELECT remaining FROM credit_buckets WHERE id=?').get('fixture1').remaining;
const complete=await request(job.path+'/run','POST',estimate.data,a.cookie,plannerFake());
assert.equal(complete.status,200,JSON.stringify(complete.data));assert.equal(complete.data.job.status,'complete');assert.equal(providerCalls,2);
assert.equal(complete.data.job.assets,undefined);assert.equal(complete.data.job.leaseToken,undefined);
assert.ok(complete.data.credits>0&&complete.data.credits<estimate.data.maxCredits);
assert.equal(sqlite.prepare('SELECT remaining FROM credit_buckets WHERE id=?').get('fixture1').remaining,before-complete.data.credits);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM credit_locks').get().n,0);
assert.equal((await request(job.path+'/run','POST',estimate.data,a.cookie)).data.duplicate,true);assert.equal(providerCalls,2);
assert.equal((await request(`projects/${b.pid}/assets/${asset.id}`,'DELETE',undefined,b.cookie)).status,404);
assert.equal((await request(base+'/assets/'+asset.id,'DELETE',undefined,a.cookie)).status,200);
const exported=await request(job.path+'/export','GET',undefined,a.cookie);
assert.equal(exported.status,200);assert.match(exported.data.source,/CreateMeshPartAsync/);assert.match(exported.data.source,/123456/);
assert.ok(exported.data.filename.endsWith('.studio.luau'));
// Unresolved assets remain a useful saved plan, but cannot be misrepresented as ready.
const missing=await save('Create a detailed dog.');
const mq=(await request(missing.path+'/estimate','POST',{},a.cookie)).data;
const missingScene={...scene,nodes:[],missingAssets:[{name:'Dog',description:'Source a UV-mapped dog mesh with smooth ears, paws and tail.'}]};
assert.equal((await request(missing.path+'/run','POST',mq,a.cookie,plannerFake(missingScene))).data.job.status,'complete');
assert.equal((await request(missing.path+'/export','GET',undefined,a.cookie)).data.code,'MISSING_ASSETS');
// Tool injection is rejected without execution, charge or automatic paid retry.
const failed=await save('Create a detailed car.');const fq=(await request(failed.path+'/estimate','POST',{},a.cookie)).data;
const balanceBeforeFailure=sqlite.prepare('SELECT remaining FROM credit_buckets WHERE id=?').get('fixture1').remaining;
let badCalls=0;
const failResult=await request(failed.path+'/run','POST',fq,a.cookie,async()=>{badCalls++;return toolResponse('execute_luau',{source:'dangerous'},0);});
assert.equal(failResult.data.code,'UNSUPPORTED_TOOL');assert.equal(badCalls,1);
assert.equal((await request(failed.path,'GET',undefined,a.cookie)).data.job.status,'failed');
assert.equal(sqlite.prepare('SELECT remaining FROM credit_buckets WHERE id=?').get('fixture1').remaining,balanceBeforeFailure);
assert.equal(sqlite.prepare('SELECT busy_until FROM projects WHERE id=?').get(a.pid).busy_until,0);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM credit_locks').get().n,0);
// Bounded validation repair can select only real library references.
let repairs=0;
const repaired=await planScene(env,{name:'Fixture'},'Place the anvil',[asset],async()=>{
  if(repairs++===0)return toolResponse('search_project_assets',{query:''});
  return toolResponse('submit_scene',{plan:repairs===2?{...scene,nodes:[{...node,assetId:'invented'}]}:scene},repairs);
});
assert.equal(repairs,3);assert.equal(repaired.plan.nodes[0].assetId,asset.id);
let networkCalls=0;
await assert.rejects(()=>planScene(env,{},'Place an anvil',[asset],async()=>{networkCalls++;throw new Error('ambiguous timeout');}),e=>e.code==='NETWORK_ERROR');
assert.equal(networkCalls,1);
// The model cannot reference an entry it never retrieved, even if it exists in
// the same project. This also grounds map overrides in observed tool results.
const unseen={...asset,id:'not-retrieved',name:'Unrelated fixture',tags:['unrelated'],material:{pbr:{normalMap:'777777'}}};
for(const proposal of [
  {...scene,nodes:[{...node,assetId:unseen.id}]},
  {...scene,nodes:[{...node,material:{pbr:{normalMap:'777777'}}}]},
]) {
  let calls=0;
  await assert.rejects(()=>planScene(env,{},'Place the anvil',[asset,unseen],async()=>++calls===1?toolResponse('search_project_assets',{query:'blacksmith'}):toolResponse('submit_scene',{plan:proposal})),e=>e.code==='INVALID_SCENE');
  assert.equal(calls,3);
}
// Concurrent clicks share the project/credit lock and never start two providers.
const concurrent=await save('Plan a scene needing assets');
const cq=(await request(concurrent.path+'/estimate','POST',{},a.cookie)).data;
let begin,release,concurrentCalls=0;
const started=new Promise(resolve=>{begin=resolve;});
const pending=new Promise(resolve=>{release=resolve;});
const firstRun=request(concurrent.path+'/run','POST',cq,a.cookie,async()=>{
  if(concurrentCalls++===0){begin();await pending;return toolResponse('search_project_assets',{query:''});}
  return toolResponse('submit_scene',{plan:missingScene});
});
await started;
assert.equal((await request(concurrent.path+'/run','POST',cq,a.cookie)).data.code,'BUSY');
release();
assert.equal((await firstRun).status,200);assert.equal(concurrentCalls,2);
let primitiveCalls=0;
const primitiveScene={...scene,nodes:[{...node,assetId:undefined,primitive:'Block'}]};
await assert.rejects(()=>planScene(env,{},'Create a detailed dog',[],async()=>++primitiveCalls===1?toolResponse('search_project_assets',{query:''}):toolResponse('submit_scene',{plan:primitiveScene})),e=>e.code==='INVALID_SCENE');
assert.equal(primitiveCalls,3);
assert.equal(searchProjectAssets([asset],'unrelated').assets.length,0);
assert.equal(searchProjectAssets([asset],'').assets.length,1);
assert.equal(sceneQuote({}, {}, 'small scene').model,'gpt-5.6-terra');
assert.throws(()=>sceneQuote({OPENAI_MODEL:'unpriced'}, {}, 'scene'));
for(const p of ['Create a dog','Make a sports car','Create a detailed medieval blacksmith shop','Build a furnished interior'])assert.equal(shouldUseAssetStudio(p),true,p);
for(const p of ['Create a blocky dog','Write a car controller script','Explain mesh parts','Research a detailed blacksmith shop','Create an obby'])assert.equal(shouldUseAssetStudio(p),false,p);
assert.equal((await request(base+'/estimate','POST',{content:'Create a detailed dog'},a.cookie)).data.workflow,'assets');
assert.equal((await request(base+'/messages','POST',{content:'Create a detailed dog',requestId:crypto.randomUUID()},a.cookie)).data.code,'ASSET_STUDIO_REQUIRED');
console.log('Scene API ownership, quotes, billing, idempotency, snapshots, missing assets, tool boundaries, repair and routing checks passed.');
sqlite.close();

for (const prompt of ['Make a chicken','Create a telescope','Build a helicopter','Make a chandelier','Create a pirate ship','Make a dog not out of bricks','Make a palm tree for my game']) assert.equal(shouldUseAssetStudio(prompt),true,prompt);
for (const prompt of ['Make a detailed obby','Make a platform','Create a UI menu','Make it jump','Create a story','Make a blocky telescope']) assert.equal(shouldUseAssetStudio(prompt),false,prompt);
