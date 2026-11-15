'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../ImperionAgent4CrmPull.gs'),'utf8');
const key='IMP4-TG-'+'a'.repeat(24);
function fixture({data=[],ackFails=false,kill=false,readbackFails=false}={}){
 let sent=[], appended=[], existing=new Map(),runs=0;
 const host={
  Date,Math,JSON,Number,String,Object,Array,Error,isFinite,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='IMP_AGENT4_CRM_KILL_SWITCH'&&kill?'true':null})},
  UrlFetchApp:{fetch:(url,opt)=>{sent.push({url,opt});
   const p=JSON.parse(opt.payload);let result;
   if(p.action==='pull')result={ok:true,protocol:'imperion-agent4-transport-v1',rows:data};
   else if(p.action==='ack')result=ackFails?{ok:false}:{ok:true,status:'REMOTE_CRM_ACK_VERIFIED',
     source_key:p.source_key,case_id:p.case_id};
   else throw Error('unreviewed');
   return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(result)};
  }},
  console:{log:()=>{}},
  impAg4Validate_:(p)=>{if(p.source_key!==key||p.owner_selftest!==false||
    p.legal_entity!=='OSVC')throw Error('bad-source');return {key,entity:'OSVC',job_id:42,inboundIso:'2026-11-15T06:00:00Z'}},
  impAg4Check_:()=>{runs++;return readbackFails?{exists:false}:
    existing.has(key)?{exists:true,case_id:existing.get(key)}:{exists:false}},
  impAg4Append_:()=>{appended.push(key);existing.set(key,'LEAD-AG4-'+'a'.repeat(24));return {case_id:existing.get(key)}}
 };
 vm.createContext(host);vm.runInContext(source,host);
 return {host,sent,appended,runs:()=>runs};
}
const rec={source_key:key,legal_entity:'OSVC',owner_selftest:false};
const cfg={key:'f'.repeat(64)};
test('disabled owner kill switch does not call Supabase or sheets',()=>{
 const f=fixture({data:[rec],kill:true}),r=f.host.impAgent4CrmPull_(cfg,{});
 assert.equal(r.status,'DISABLED');assert.equal(f.sent.length,0);assert.equal(f.appended.length,0);
});
test('empty pending transport is zero writes, zero acks',()=>{
 const f=fixture(),r=f.host.impAgent4CrmPull_(cfg,{});
 assert.equal(r.status,'OK');assert.equal(r.acked,0);assert.equal(f.sent.length,1);
});
test('source is appended once and acked only after second readback',()=>{
 const f=fixture({data:[rec]});const r=f.host.impAgent4CrmPull_(cfg,{});
 assert.equal(r.imported,1);assert.equal(r.acked,1);assert.equal(r.held,0);assert.equal(f.appended.length,1);
 assert.equal(f.sent.length,2);assert.equal(JSON.parse(f.sent[1].opt.payload).action,'ack');
 assert.ok(f.runs()>=2);assert.equal(f.sent[1].opt.headers.Authorization,'Bearer '+cfg.key);
});
test('transport ACK failure leaves case for next deduped retry',()=>{
 const f=fixture({data:[rec],ackFails:true});const r=f.host.impAgent4CrmPull_(cfg,{});
 assert.equal(r.status,'PARTIAL_HELD');assert.equal(r.acked,0);assert.equal(f.appended.length,1);
});
test('failed CRM readback cannot ACK the source',()=>{
 const f=fixture({data:[rec],readbackFails:true});const r=f.host.impAgent4CrmPull_(cfg,{});
 assert.equal(r.held,1);assert.equal(f.sent.length,1);
});
test('untrusted synthetic owner test is rejected before write',()=>{
 const f=fixture({data:[{...rec,owner_selftest:true}]});const r=f.host.impAgent4CrmPull_(cfg,{});
 assert.equal(r.held,1);assert.equal(f.appended.length,0);assert.equal(f.sent.length,1);
});
test('private missing bearer fails closed',()=>{
 const f=fixture({data:[rec]});assert.throws(()=>f.host.impAgent4CrmPull_({key:'bad'},{}),/PRIVATE_TOKEN_MISSING/);
});
