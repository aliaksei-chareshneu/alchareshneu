import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createGateway, createHttpServer, PROTOCOL} from '../server.mjs';

const cfg = {MCP_BRIDGE_WEBAPP_URL:'https://script.google.com/macros/s/mock/exec', MCP_BRIDGE_SECRET:'a'.repeat(40), PUBLISH_ENABLED:'0'};
const JOB = 'PUB-HIKE-20261101:telegram';
const rpc = (method, params={}, id=1) => ({jsonrpc:'2.0', id, method, params});
const body = x => JSON.parse(x.content[0].text);

const mock = async (url,options) => {
  assert.equal(new URL(url).searchParams.get('mcp'),'1');
  const message=JSON.parse(options.body);
  const expected=crypto.createHmac('sha256',cfg.MCP_BRIDGE_SECRET).update(['v1',message.action,message.job_id,String(message.ts),message.nonce].join('\n')).digest('hex');
  assert.equal(message.sig,expected);
  return {ok:true,json:async()=>({ok:true,job_id:JOB,caption:'An approved public training event',publicApproved:true,ready:true})};
};

test('legacy MCP initialize, tool list and notification framing',async()=>{
  const g=createGateway({env:cfg,fetchFn:mock,now:()=>1234567890000,nonce:()=> 'a'.repeat(32)});
  const init=await g.handle(rpc('initialize',{protocolVersion:PROTOCOL,capabilities:{},clientInfo:{name:'test',version:'1'}}));
  assert.equal(init.result.protocolVersion,PROTOCOL);
  const list=await g.handle(rpc('tools/list'));
  assert.deepEqual(list.result.tools.map(x=>x.name),['publication_status','telegram_preview','telegram_publish_approved','whatsapp_group_share_preview']);
  assert.equal(await g.handle({jsonrpc:'2.0',method:'notifications/initialized'}),null);
  assert.equal((await g.handle(rpc('other'))).error.code,-32601);
});

test('disabled writes are blocked before any bridge fetch',async()=>{
  let calls=0;
  const g=createGateway({env:cfg,fetchFn:async()=>{calls++;throw Error('should not call');}});
  const result=body(await g.callTool('telegram_publish_approved',{job_id:JOB,confirm:true}));
  assert.equal(result.code,'PUBLISH_DISABLED');
  assert.equal(calls,0);
});

test('only existing Job_ID accepted; preview body HMAC authenticated',async()=>{
  const g=createGateway({env:cfg,fetchFn:mock,now:()=>1234567890000,nonce:()=> 'a'.repeat(32)});
  assert.equal(body(await g.callTool('telegram_preview',{job_id:'../bad'})).code,'BAD_JOB_ID');
  assert.equal(body(await g.callTool('telegram_preview',{job_id:JOB})).ready,true);
});

test('whatsapp tool does not send, only returns human share link',async()=>{
  let action='';
  const g=createGateway({env:cfg,fetchFn:async(url,o)=>{action=JSON.parse(o.body).action;return mock(url,o);}});
  const value=body(await g.callTool('whatsapp_group_share_preview',{job_id:'PUB-HIKE-20261101:whatsapp'}));
  assert.equal(action,'preview_whatsapp');
  assert.equal(value.automaticallySent,false);
  assert.equal(value.action,'MANUAL_SHARE_REQUIRED');
  assert.match(value.url,/^https:\/\/wa\.me\/\?text=/);
});

test('publish only with explicit server enable; no auto retry on uncertain network result',async()=>{
  let calls=0;
  const g=createGateway({env:{...cfg,PUBLISH_ENABLED:'1'},fetchFn:async()=>{calls++;throw Error('timeout');}});
  const result=body(await g.callTool('telegram_publish_approved',{job_id:JOB,confirm:true}));
  assert.equal(result.code,'DELIVERY_OUTCOME_UNCERTAIN');
  assert.equal(calls,1);
});

test('not publicly hosted without both access token and Host allowlist',()=>{
  assert.throws(()=>createHttpServer({env:{MCP_HOST:'0.0.0.0',MCP_PORT:'0'}}),/requires MCP_CLIENT_TOKEN/);
});

test('HTTP MCP JSON request, Origin denial, and read-only health',async(t)=>{
  const {server}=createHttpServer({env:{MCP_HOST:'127.0.0.1',MCP_PORT:'0',PUBLISH_ENABLED:'0'}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const port=server.address().port;
  const base=`http://127.0.0.1:${port}`;
  const health=await fetch(base+'/health');assert.equal(health.status,200);
  const list=await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json','accept':'application/json,text/event-stream'},body:JSON.stringify(rpc('tools/list'))});
  assert.equal(list.status,200);assert.equal((await list.json()).result.tools.length,4);
  const forbidden=await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json','origin':'https://evil.example'},body:JSON.stringify(rpc('ping'))});
  assert.equal(forbidden.status,403);
  const blocked=await fetch(base+'/mcp',{method:'GET'});assert.equal(blocked.status,405);
  const note=await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});
  assert.equal(note.status,202);
});