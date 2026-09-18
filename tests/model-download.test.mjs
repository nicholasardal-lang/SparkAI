import assert from 'node:assert/strict';
import {downloadModel} from '../lib/spark/model-download.ts';
let calls=0;
const result=await downloadModel('123','test-key',async(url,init)=>{
 calls++;
 if(calls===1){assert.equal(init.headers['x-api-key'],'test-key');assert.equal(init.redirect,'manual');return Response.json({location:'https://c0.rbxcdn.com/model'});}
 assert.equal(init.headers,undefined);return new Response('<roblox version="4"></roblox>');
});
assert.equal(result.extension,'rbxmx');assert.equal(calls,2);
await assert.rejects(()=>downloadModel('123',''),/not connected/);
await assert.rejects(()=>downloadModel('123','key',async()=>new Response('',{status:403})),/not authorized/);
await assert.rejects(()=>downloadModel('123','key',async()=>Response.json({location:'https://evil.example/file'})),/unsupported/);
let n=0;
await assert.rejects(()=>downloadModel('123','key',async()=>++n===1?Response.json({location:'https://c0.rbxcdn.com/model'}):new Response('<html>Error</html>')),/not return a model/);
console.log('Model delivery: authentication, CDN isolation, valid file and failure checks passed.');
for(const location of ['https://contentdelivery.roblox.com/v1/bytes/sc3/model','https://fts.rbxcdn.com/sc6/model']){
 let count=0;
 const file=await downloadModel('123','secret',async(url,init)=>{
  if(++count===1)return Response.json({location});
  assert.equal(url,location);assert.equal(init.headers,undefined);
  return new Response('<roblox!binary-fixture');
 });
 assert.equal(file.extension,'rbxm');
}
for(const location of ['https://contentdelivery.roblox.com.evil.example/file','https://evilroblox.com/file','http://contentdelivery.roblox.com/file','https://user:pass@contentdelivery.roblox.com/file','https://contentdelivery.roblox.com:8443/file']){
 let count=0;
 await assert.rejects(()=>downloadModel('123','secret',async()=>{count++;return Response.json({location});}),/unsupported/);
 assert.equal(count,1,'Rejected locations must never be fetched');
}
