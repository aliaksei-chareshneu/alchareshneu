import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStageRequest} from '../supabase-edge/handler.mjs';
const base='https://example.supabase.co/functions/v1/imperion-social-mcp-stage';
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',id,method,params});
const post=(obj)=>handleStageRequest(new Request(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(obj)}));
test('staging health states that posting is disabled',async()=>{
 const r=await handleStageRequest(new Request(base+'/health'));
 assert.equal(r.status,200);const x=await r.json();assert.equal(x.publishing,false);
});
test('MCP discoverable with only read-only public tools',async()=>{
 const init=await post(rpc('initialize',{protocolVersion:'2025-11-25'}));
 assert.equal((await init.json()).result.serverInfo.name,'imperion-social-mcp-stage');
 const list=await post(rpc('tools/list'));
 const tools=(await list.json()).result.tools;
 assert.deepEqual(tools.map(x=>x.name),['publication_status','whatsapp_group_capabilities']);
 assert.ok(tools.every(x=>x.annotations.readOnlyHint));
});
test('write action cannot be invoked by protocol even with confirmation',async()=>{
 const r=await post(rpc('tools/call',{name:'telegram_publish_approved',arguments:{confirm:true,job_id:'PUB-20261101:telegram'}}));
 assert.equal((await r.json()).error.code,-32601);
});
test('staging status contains no private CRM and does not publish',async()=>{
 const r=await post(rpc('tools/call',{name:'publication_status',arguments:{}}));
 const x=JSON.parse((await r.json()).result.content[0].text);
 assert.equal(x.telegramPublishing,false);assert.equal(x.networkCalls,0);assert.equal(x.crmAccess,false);
});
test('notification, malformed JSON and media type are handled safely',async()=>{
 assert.equal((await post({jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
 const bad=await handleStageRequest(new Request(base,{method:'POST',headers:{'content-type':'application/json'},body:'not json'}));
 assert.equal(bad.status,400);
 const wrong=await handleStageRequest(new Request(base,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'}));
 assert.equal(wrong.status,415);
});
