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
