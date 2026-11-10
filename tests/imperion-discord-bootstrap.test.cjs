'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {plan,reconcile,main,MANIFEST,ROLES,JOB_ID} = require('./imperion-discord-bootstrap.cjs');
const GID='1234567890123456789';
function mockInventory(channels=[],roles=[]) {
 const calls=[]; let serial=100; const request=async (url, opts) => {
   calls.push({url,method:opts.method,body:opts.body&&JSON.parse(opts.body)});
   if(opts.method==='GET')return {ok:true,status:200,json:async()=>url.endsWith('/channels')?channels:roles};
   const body=JSON.parse(opts.body); const item={...body,id:String(serial++),parent_id:body.parent_id||null};
   return {ok:true,status:201,json:async()=>item};
 };
 return {request,calls};
}
test('dry plan has eight channels, no external actions',()=>{
 const p=plan(); assert.equal(p.categories.flatMap(c=>c.channels).length,8);
 assert.equal(p.publication,'NONE'); assert.equal(p.budget_kc,0);
 assert.equal(MANIFEST.length,3);assert.equal(ROLES.length,4);
});
test('write mode refuses absent explicit GO with no network',async()=>{
 let called=0;
 await assert.rejects(main(['--apply'],{DISCORD_GUILD_ID:GID,DISCORD_BOT_TOKEN:'fake'},async()=>{called++;}),/write GO marker absent/);
 assert.equal(called,0);
});
test('empty guild adds only intended channels and interest roles',async()=>{
 const m=mockInventory(); const result=await reconcile({guildId:GID,token:'test',request:m.request});
 assert.equal(result.posts_sent,0);assert.equal(result.invites_created,0);
 assert.equal(m.calls.filter(x=>x.method==='POST'&&x.url.endsWith('/channels')).length,11);
 assert.equal(m.calls.filter(x=>x.method==='POST'&&x.url.endsWith('/roles')).length,4);
 assert.ok(m.calls.filter(x=>x.method==='POST').every(x=>!x.url.includes('messages')));
 const readOnly=m.calls.filter(c=>c.body&&c.body.name==='announcements')[0];
 assert.equal(readOnly.body.permission_overwrites[0].deny,'2048');
});
test('idempotent existing guild produces zero writes',async()=>{
 const cats=MANIFEST.map((c,i)=>({name:c.name,id:String(i+1),type:4}));
 const channels=[...cats,...MANIFEST.flatMap((c,i)=>c.channels.map(v=>({name:v[0],id:String(i)+v[0],type:0,parent_id:String(i+1)})))];
 const roles=ROLES.map(name=>({name,id:name})); const m=mockInventory(channels,roles);
 const r=await reconcile({guildId:GID,token:'test',request:m.request});
 assert.deepEqual(r.operations,[]);assert.equal(m.calls.filter(x=>x.method==='POST').length,0);
});
test('incorrect parent or duplicate name fails closed',async()=>{
 const m=mockInventory([{name:'START HERE',id:'12',type:4},{name:'welcome',id:'15',type:0,parent_id:'999'}],[]);
 await assert.rejects(reconcile({guildId:GID,token:'test',request:m.request}),/Channel name\/parent conflict/);
 assert.equal(m.calls.filter(x=>x.method==='POST').length,0);
});
test('no bot token or invalid guild id never contacts Discord',async()=>{
 let called=0;const request=async()=>{called++;throw Error('never');};
 await assert.rejects(reconcile({guildId:'fake',token:'test',request}),/guild ID/);
 await assert.rejects(reconcile({guildId:GID,token:'',request}),/bot token/);
 assert.equal(called,0);
});
