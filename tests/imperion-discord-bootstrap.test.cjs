'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {plan,reconcile,main,MANIFEST,ROLES,JOB_ID}=require('../scripts/imperion-discord-bootstrap.cjs');
const GID='1234567890123456789';
const NAME='Družina Moravy';
function mockInventory({guildName=NAME,channels=[],roles=[],failPostAt=0}={}) {
 const calls=[];let serial=100;let writeCount=0;
 const state={channels:[...channels],roles:[...roles]};
 const request=async(url,opts)=>{
   const path=url.split('/api/v10')[1];
   const body=opts.body?JSON.parse(opts.body):null;
   calls.push({method:opts.method,path,body});
   if(opts.method==='GET'){
     const data=path===`/guilds/${GID}`?{name:guildName,id:GID}:
       path.endsWith('/channels')?state.channels:state.roles;
     return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(data))};
   }
   writeCount++;
   if(failPostAt===writeCount)return {ok:false,status:403};
   const item={...body,id:String(serial++),parent_id:body.parent_id||null};
   if(path.endsWith('/channels'))state.channels.push(item);
   else if(path.endsWith('/roles'))state.roles.push(item);
   else throw Error('Unexpected path '+path);
   return {ok:true,status:201,json:async()=>item};
 };
 return {request,calls,state};
}
function good(opts={}){return {guildId:GID,token:'stub',expectedName:NAME,...opts};}
test('offline plan contains 8 channels, 3 categories, 4 interest roles and no posts',()=>{
 const p=plan();assert.equal(p.categories.length,3);
 assert.equal(p.categories.flatMap(c=>c.channels).length,8);
 assert.equal(p.interest_roles.length,4);assert.equal(p.external_publications,0);
 assert.equal(p.budget_kc,0);
});
test('case-specific GO required before any network access',async()=>{
 let count=0;
 await assert.rejects(main(['--apply'],{DISCORD_GUILD_ID:GID,DISCORD_BOT_TOKEN:'stub',DISCORD_EXPECTED_GUILD_NAME:NAME},async()=>{count++;}),/GO/);
 assert.equal(count,0);
});
test('read-only inspect returns plan without writes',async()=>{
 const m=mockInventory();const r=await reconcile(good({request:m.request,dryRun:true}));
 assert.equal(r.mode,'INSPECT');assert.equal(r.verified_structure,false);
 assert.equal(r.planned_changes.length,15);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
});
test('empty guild creates only structure; second apply is idempotent',async()=>{
 const m=mockInventory();const r=await reconcile(good({request:m.request,dryRun:false}));
 assert.equal(r.mode,'APPLIED_READBACK_VERIFIED');assert.equal(r.created.length,15);
 assert.equal(r.posts_sent,0);assert.equal(r.invites_created,0);
 assert.equal(m.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/channels')).length,11);
 assert.equal(m.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/roles')).length,4);
 assert.equal(m.calls.filter(c=>c.method==='POST'&&c.path.includes('/messages')).length,0);
 const news=m.state.channels.find(c=>c.name==='announcements');
 assert.equal(news.permission_overwrites[0].deny,'2048');
 assert.equal(m.state.roles.every(c=>c.permissions==='0'),true);
 const again=await reconcile(good({request:m.request,dryRun:false}));
 assert.equal(again.created.length,0);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,15);
});
test('non-Druzina or unexpected server name blocks before any mutation',async()=>{
 const m=mockInventory({guildName:'Another Association'});
 await assert.rejects(reconcile(good({request:m.request,dryRun:false})),/Wrong guild name/);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
});
test('exact expected name is mandatory for auth inspection and writes',async()=>{
 const m=mockInventory();
 await assert.rejects(reconcile(good({expectedName:'',request:m.request,dryRun:false})),/expected guild name/);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
});
test('already existing unprotected announcement channel fails closed',async()=>{
 const m=mockInventory({channels:[{id:'10',name:'START HERE',type:4},{id:'11',name:'announcements',type:0,parent_id:'10',permission_overwrites:[]}]});
 await assert.rejects(reconcile(good({request:m.request,dryRun:false})),/Read-only policy missing/);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
});
test('existing channel in wrong category fails closed without touching anything',async()=>{
 const m=mockInventory({channels:[{id:'10',name:'START HERE',type:4},{id:'11',name:'welcome',type:0,parent_id:'wrong'}]});
 await assert.rejects(reconcile(good({request:m.request,dryRun:false})),/Channel conflict/);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
});
test('duplicate or privileged interest roles fail before any external writes',async()=>{
 for(const roles of [
   [{id:'1',name:'Newcomer',permissions:'0'},{id:'2',name:'Newcomer',permissions:'0'}],
   [{id:'1',name:'Newcomer',permissions:'8'}]
 ]){
  const m=mockInventory({roles});
  await assert.rejects(reconcile(good({request:m.request,dryRun:false})),/Preflight blocked/);
  assert.equal(m.calls.filter(c=>c.method==='POST').length,0);
 }
});
test('API denied response aborts immediately and never retries',async()=>{
 const m=mockInventory({failPostAt:1});
 await assert.rejects(reconcile(good({request:m.request,dryRun:false})),/HTTP 403/);
 assert.equal(m.calls.filter(c=>c.method==='POST').length,1);
});
test('invalid guild ID or missing bot token never calls external API',async()=>{
 let called=0;const request=async()=>{called++;throw Error('unexpected');};
 await assert.rejects(reconcile(good({guildId:'bad',request})),/guild ID/);
 await assert.rejects(reconcile(good({token:'',request})),/Bot token/);
 assert.equal(called,0);
});
test('unknown CLI mode and simultaneous flags are refused',async()=>{
 await assert.rejects(main(['--bogus']),/Invalid mode/);
 await assert.rejects(main(['--inspect','--apply']),/Invalid mode/);
});
