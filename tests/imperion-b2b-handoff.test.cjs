'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
const {sales}=require('../ops/imperion-agent-team.cjs');
const sync=fs.readFileSync('imperion-intake-sync.gs','utf8');
const edge=fs.readFileSync('supabase/functions/imperion-b2b-intake/index.ts','utf8');
const id='00000000-0000-4000-8000-000000000123';
const headers=['Lead_ID','Created_At','Full_Name','Email','Phone_Number','Source','Service',
 'Subject_Goal','Stage','Expected_Value_CZK','Next_Action_At','Last_Contact_At','Followup_Count',
 'Paid_CZK','Owner','Notes','Submission_ID','Retention_Until','Last_Automation_At','Action_Status',
 'Priority','Receipt_Status','Receipt_Attempts','Receipt_Locale'];
function harness(){
 const rows=[headers.slice()],kv=new Map();let corrupt=false;
 const sheet={getLastColumn:()=>headers.length,getLastRow:()=>rows.length,
  getRange:(r,c,n=1,w=1)=>({
   getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),
   getDisplayValue:()=>String(rows[r-1]?.[c-1]??''),
   setValues:v=>{rows[r-1]=v[0].slice();if(corrupt)rows[r-1][headers.indexOf('Owner')]='';},
   setNumberFormat:()=>{}
  })};
 const book={getSheetByName:name=>{assert.equal(name,'Leads','OSVC cannot write NGO tabs');return sheet;}};
 const c=vm.createContext({Date,console:{error:()=>{}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>kv.get(k)||null,
   setProperty:(k,v)=>kv.set(k,v),deleteProperty:k=>kv.delete(k)})}});
 vm.runInContext(sync,c);
 return {c,book,rows,kv,setCorrupt:()=>{corrupt=true;}};
}
function rowObject(row){return Object.fromEntries(headers.map((k,i)=>[k,row[i]]));}
test('offline E2E: real endpoint handler → one private lead → owner action → persisted receipt queue; retry deduplicates',async()=>{
 const inserted=new Map();let handler;
 const js=stripTypeScriptTypes(edge.replace(/^import .*from 'npm:[^']+';\s*$/m,''),{mode:'strip'});
 vm.runInNewContext(js,{Request,Response,Headers,TextEncoder,crypto:webcrypto,console:{error:()=>{}},
  Deno:{env:{get:k=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic'})[k]},serve:f=>{handler=f;}},
  createClient:()=>({rpc:async()=>({data:true,error:null}),from:()=>({insert:r=>({select:()=>({single:async()=>{
   if(inserted.has(r.idempotency_key))return {data:null,error:{code:'23505'}};
   inserted.set(r.idempotency_key,{...r,id,created_at:new Date().toISOString(),retention_until:'2027-01-01T00:00:00Z'});return {data:{id},error:null};
  }})})})})
 });
 const payload={company:'Synthetic Example',contactName:'Test Contact',email:'nobody@example.invalid',
  offer:'DATA_PILOT',summary:'Offline test of data quality and reporting pipeline.',
  budgetBand:'15000-30000',timeframe:'November 2026',privacyAcknowledged:true,source:'offline_qa',website:''};
 const submit=()=>handler(new Request('https://offline.test/',{method:'POST',headers:{
  origin:'https://aliaksei-chareshneu.github.io','content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(payload)}));
 const first=await submit(),duplicate=await submit();
 assert.equal(first.status,200);assert.equal(duplicate.status,200);assert.equal(inserted.size,1);
 assert.equal((await first.json()).status,'RECEIVED_UNCONFIRMED');
 const h=harness(),source=[...inserted.values()];
 const result=h.c.impWriteB2B_(h.book,source);
 // The importer persists the owner notification before returning ACK IDs.
 assert.equal(result.added,1);
 assert.equal(h.c.impWriteB2B_(h.book,source).added,0);
 // Independent persisted-state reads (no trust in import return value).
 const saved=rowObject(h.rows[1]),pending=JSON.parse(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING'));
 assert.equal(h.rows.length,2);assert.equal(saved.Submission_ID,'OSVC-B2B-'+id);
 assert.equal(saved.Owner,'Aliaksei');assert.equal(saved.Stage,'New');assert.equal(Number(saved.Paid_CZK),0);
 assert.equal(saved.Action_Status,'OSVC_B2B_INBOUND_REVIEW_NO_ORDER_NO_CASH');
 assert.ok(new Date(saved.Next_Action_At)>new Date());
 assert.equal(saved.Receipt_Status,'PENDING');assert.equal(pending.b2b,1);
 assert.equal(pending.items[0].kind,'B2B');assert.equal(pending.items[0].row,2);
 const action=sales({captured_at:new Date().toISOString(),data:{Leads:[saved]}});
 assert.equal(action.candidates[0].next,'VERIFY_HISTORY_AND_STOP_LIST');
 assert.equal(action.outbound_sent,0);
 assert.doesNotMatch(JSON.stringify(pending),/nobody@|Test Contact|Synthetic Example/);
});
test('partial persisted owner handoff blocks initial import AND retry ACK',()=>{
 const h=harness();h.setCorrupt();
 const source={id,offer:'DATA_PILOT',created_at:new Date().toISOString(),retention_until:'2027-01-01T00:00:00Z'};
 assert.throws(()=>h.c.impWriteB2B_(h.book,[source]),/B2B_HANDOFF_READBACK_FAILED/);
 assert.throws(()=>h.c.impWriteB2B_(h.book,[source]),/B2B_HANDOFF_READBACK_FAILED/);
 assert.equal(h.rows.length,2);
});
test('duplicate canonical source IDs block ACK; invalid source never appends',()=>{
 const h=harness(),source={id,offer:'DATA_PILOT',created_at:new Date().toISOString(),retention_until:'2027-01-01T00:00:00Z'};
 h.c.impWriteB2B_(h.book,[source]);h.rows.push(h.rows[1].slice());
 assert.throws(()=>h.c.impWriteB2B_(h.book,[source]),/B2B_DUPLICATE_SOURCE_CONFLICT/);
 assert.throws(()=>h.c.impWriteB2B_(h.book,[{...source,id:'invalid'}]),/Invalid B2B id/);
});
test('canonical opt-out overrides action queue and formula errors fall back to Leads',()=>{
 const snapshot={captured_at:new Date().toISOString(),data:{
  Leads:[{Lead_ID:'ONE',Stage:'Lost'},{Lead_ID:'TWO',Stage:'New'}],
  Revenue_Actions:[{Lead_ID:'ONE',Stage:'New'}]}};
 assert.equal(sales(snapshot).candidates_total,0);
 snapshot.data.Revenue_Actions=[{Lead_ID:'#REF!'}];
 const result=sales(snapshot);
 assert.equal(result.source,'EXISTING_IMPERION_HUB/Leads');
 assert.equal(result.candidates_total,1);assert.equal(result.candidates[0].id,'TWO');
});


test('action queue without email still respects opt-out on another canonical email alias',()=>{
 const result=sales({captured_at:new Date().toISOString(),data:{
  Revenue_Actions:[{Lead_ID:'ALIAS',Stage:'New'}],Leads:[
   {Lead_ID:'STOP',Stage:'Lost',Email:'Buyer@example.invalid'},
   {Lead_ID:'ALIAS',Stage:'New',Email:'buyer@example.invalid'}]}});
 assert.equal(result.candidates_total,0);assert.equal(result.closed_or_opted_out,1);
});


test('crash after row append recovers one owner notification and retry never increments it',()=>{
 const h=harness(),source={id,offer:'DATA_PILOT',created_at:new Date().toISOString(),retention_until:'2027-01-01T00:00:00Z'};
 const queue=h.c.impQueueB2BHandoff_;
 h.c.impQueueB2BHandoff_=()=>{throw Error('SIMULATED_PROPERTY_OUTAGE');};
 assert.throws(()=>h.c.impWriteB2B_(h.book,[source]),/SIMULATED_PROPERTY_OUTAGE/);
 assert.equal(h.rows.length,2);assert.equal(h.kv.size,0);
 h.c.impQueueB2BHandoff_=queue;
 assert.equal(h.c.impWriteB2B_(h.book,[source]).added,0);
 assert.equal(h.c.impWriteB2B_(h.book,[source]).added,0);
 const pending=JSON.parse(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING'));
 assert.equal(pending.b2b,1);assert.deepEqual(pending.b2b_keys,[id]);
 assert.equal(pending.items[0].row,2);
});
test('missing next-action schema is rejected before any CRM append',()=>{
 const h=harness();h.rows[0][headers.indexOf('Next_Action_At')]='Legacy_Date';
 assert.throws(()=>h.c.impWriteB2B_(h.book,[{id}]),/Missing Leads header: Next_Action_At/);
 assert.equal(h.rows.length,1);
});
test('ambiguous legacy digest and capacity fail closed without overwriting pending state',()=>{
 const h=harness();
 const legacy=JSON.stringify({rsvps:0,enquiries:0,b2b:1,items:[]});
 h.kv.set('IMPERION_INTAKE_NOTIFY_PENDING',legacy);
 assert.throws(()=>h.c.impQueueB2BHandoff_(id,2),/LEGACY_B2B_DIGEST_RECONCILIATION_REQUIRED/);
 assert.equal(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING'),legacy);
 const keys=Array.from({length:180},(_,i)=>'00000000-0000-4000-8000-'+String(i+1000).padStart(12,'0'));
 const full=JSON.stringify({rsvps:0,enquiries:0,b2b:180,b2b_keys:keys,items:[]});
 h.kv.set('IMPERION_INTAKE_NOTIFY_PENDING',full);
 assert.throws(()=>h.c.impQueueB2BHandoff_(id,2),/B2B_DIGEST_CAPACITY_REVIEW_REQUIRED/);
 assert.equal(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING'),full);
});

function privateBridge(source){
 const raw=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
 const js=stripTypeScriptTypes(raw.replace(/^import .*;\s*$/gm,''),{mode:'strip'});
 const records=source.map(r=>({...r,crm_synced_at:null}));let handler,reads=0,failAck=false;
 vm.runInNewContext(js,{Request,Response,Headers,console:{error:()=>{}},
  Deno:{env:{get:()=> 'synthetic'},serve:f=>{handler=f;}},
  createClient:()=>({rpc:async(_name,args)=>({data:args.p_token==='a'.repeat(64),error:null}),
   from:name=>{
    if(name!=='imperion_b2b_inquiries')return {select:()=>({is:()=>({order:()=>({limit:async()=>({data:[],error:null})})})})};
    return {
     select:()=>({is:()=>({order:()=>({limit:async()=>{reads++;return {data:records.filter(r=>!r.crm_synced_at),error:null};}})})}),
     update:value=>({in:(_field,ids)=>({is:()=>({select:async()=>{
      if(failAck){failAck=false;return {data:null,error:{code:'synthetic_outage'}};}
      const selected=records.filter(r=>ids.includes(r.id)&&!r.crm_synced_at);
      selected.forEach(r=>Object.assign(r,value));return {data:selected.map(r=>({id:r.id})),error:null};
     }})})})
    };
   }})
 });
 return {records,get reads(){return reads;},failNextAck:()=>{failAck=true;},
  request:async(method='GET',payload,token='a'.repeat(64))=>{
   const headers={'content-type':'application/json'};
   if(token!==null)headers.authorization='Bearer '+token;
   const response=await handler(new Request('https://offline.invalid/private-bridge',{
    method,headers,...(payload?{body:JSON.stringify(payload)}:{})}));
   return {status:response.status,body:await response.json()};
  }};
}
test('actual private bridge auth → importer/outbox → failed ACK → replay → ACK → independent empty-source readback',async()=>{
 const source={id,offer:'DATA_PILOT',created_at:new Date().toISOString(),retention_until:'2027-01-01T00:00:00Z'};
 const bridge=privateBridge([source]);
 assert.equal((await bridge.request('GET',undefined,null)).status,401);
 assert.equal((await bridge.request('GET',undefined,'b'.repeat(64))).status,403);
 assert.equal(bridge.reads,0,'unauthorized calls cannot read private rows');
 const first=await bridge.request();assert.equal(first.body.protocol,'imperion-intake-bridge-v1');
 const h=harness(),initial=h.c.impWriteB2B_(h.book,first.body.b2b);
 const ack={action:'ack',rsvps:[],enquiries:[],b2b:Array.from(initial.ids)};
 bridge.failNextAck();assert.equal((await bridge.request('POST',ack)).status,503);
 const retry=await bridge.request();assert.equal(retry.body.b2b.length,1);
 assert.equal(h.c.impWriteB2B_(h.book,retry.body.b2b).added,0);
 assert.equal(h.rows.length,2);
 assert.equal(JSON.parse(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING')).b2b,1);
 const accepted=await bridge.request('POST',ack);assert.equal(accepted.body.acked.b2b,1);
 assert.equal((await bridge.request('POST',ack)).body.acked.b2b,0,'ACK itself is idempotent');
 assert.equal((await bridge.request()).body.b2b.length,0);
 assert.ok(bridge.records[0].crm_synced_at);
 assert.equal(rowObject(h.rows[1]).Stage,'New');
 assert.equal(rowObject(h.rows[1]).Owner,'Aliaksei');
 assert.equal(JSON.parse(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING')).items[0].row,2);
});
test('partial batch failure keeps the first notification durable and retry adds only the remaining lead',()=>{
 const h=harness(),source={id,offer:'DATA_PILOT',created_at:new Date().toISOString(),retention_until:'2027-01-01T00:00:00Z'};
 const second={...source,id:'00000000-0000-4000-8000-000000000124',offer:'INVALID'};
 assert.throws(()=>h.c.impWriteB2B_(h.book,[source,second]),/Invalid B2B offer/);
 assert.equal(JSON.parse(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING')).b2b,1);
 second.offer='DATA_PILOT';h.c.impWriteB2B_(h.book,[source,second]);
 assert.equal(h.rows.length,3);
 assert.equal(JSON.parse(h.kv.get('IMPERION_INTAKE_NOTIFY_PENDING')).b2b,2);
});
