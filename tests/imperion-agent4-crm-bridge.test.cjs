'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const SOURCE=fs.readFileSync(path.join(__dirname,'../ImperionAgent4CrmBridge.gs'),'utf8');
const leadHeaders=['Lead_ID','Created_At','Full_Name','Email','Telegram_Handle','Phone_Number','Source','Service','Subject_Goal','Language','Format','Stage','Product_ID','Expected_Value_CZK','Next_Action_At','Last_Contact_At','Followup_Count','Trial_At','Paid_CZK','Sessions_Remaining','Renewal_At','Owner','Notes','Submission_ID','Retention_Until','Last_Automation_At','Action_Status','Priority','Receipt_Status'];
const dmHeaders=['Lead_ID','Person','Relationship','Channel','Stage','Cash_Status','Dates','Offer','Ask_CZK','Close_Prob','Weighted_30d_CZK','Next_Action','Due_Date','Responsible','Consent_Context','Evidence','Verified_As_Of','Risk_or_Notes','Outcome'];
const key='IMP4-TG-'+'a'.repeat(24);
function fixture(){
 let allow=true,locked=false,posted=0,release=0,reads=0;
 const props={};
 const tabs={Leads:mkSheet(leadHeaders),Druzina_Enrollment_Pipeline:mkSheet(dmHeaders)};
 function mkSheet(headers){
  const rows=[headers.slice()];
  return {rows,getLastColumn:()=>headers.length,getLastRow:()=>rows.length,
    getRange:(row,col,countRows=1,countCols=1)=>({
      getValues:()=>rows.slice(row-1,row-1+countRows).map(r=>r.slice(col-1,col-1+countCols)),
      getDisplayValues:()=>rows.slice(row-1,row-1+countRows).map(r=>r.slice(col-1,col-1+countCols).map(v=>String(v??'')))
    }),appendRow:(v)=>{posted++;rows.push(v)}};
 }
 const context={Object,Date,Number,String,JSON,Math,isFinite,Error,
  ocOwner_:()=>{if(!allow)throw Error('Owner sign-in required')},ocId_:()=>('canonical_hub_id'),
  SpreadsheetApp:{openById:(id)=>{assert.equal(id,'canonical_hub_id');return {getSheetByName:(n)=>tabs[n]}},flush:()=>{reads++}},
  LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true},releaseLock:()=>{release++;locked=false}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:(k)=>props[k],setProperty:(k,v)=>{props[k]=v}})}
 };
 vm.createContext(context);vm.runInContext(SOURCE,context);
 return {context,tabs,props,posted:()=>posted,release:()=>release,reads:()=>reads,
  allow:(v)=>{allow=v}, enable:()=>JSON.parse(context.impAgent4CrmEnable('GO-AG4-CRM-20261115-OWNER',true))};
}
const payload=(over={})=>({source_key:key,source:'telegram-agent4',legal_entity:'OSVC',local_job_id:7,
 inbound_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),stage:'INBOUND_UNQUALIFIED',identity_match:'NOT_VERIFIED',
 crm_person_id:null,provider_send_status:'NO_CONFIRMED_SEND',privacy:'NO_MESSAGE_TEXT_NO_PHONE_NO_NAME',owner_selftest:false,...over});
const parse=(str)=>JSON.parse(str);
test('read-only authorized ping has two tabs and importer defaults disabled',()=>{
 const f=fixture();const p=parse(f.context.impAgent4CrmPing());assert.equal(p.ok,true);assert.equal(p.enabled,false);assert.equal(f.posted(),0);
});
test('owner check prevents calls to ping/import/verify/enable',()=>{
 const f=fixture();f.allow(false);
 for(const fn of [()=>f.context.impAgent4CrmPing(),()=>f.context.impAgent4CrmImport(payload()),()=>f.context.impAgent4CrmVerify(key,'OSVC'),()=>f.context.impAgent4CrmEnable('GO-AG4-CRM-20261115-OWNER',true)])
  assert.throws(fn,/Owner sign-in required/);
 assert.equal(f.posted(),0);
});
test('flag and kill switch deny writes, explicit owner GO required',()=>{
 const f=fixture();assert.throws(()=>f.context.impAgent4CrmImport(payload()),/DISABLED/);
 assert.throws(()=>f.context.impAgent4CrmEnable('owner','true'),/APPROVAL/);
 f.enable();f.props.IMP_AGENT4_CRM_KILL_SWITCH='true';
 assert.throws(()=>f.context.impAgent4CrmImport(payload()),/DISABLED/);
 assert.equal(f.posted(),0);
});
test('OSVC inbound creates exactly one metadata-only unqualified lead and one independent readback',()=>{
 const f=fixture();f.enable();const r=parse(f.context.impAgent4CrmImport(payload()));
 assert.equal(r.ok,true);assert.equal(r.state,'CREATED_REMOTE_READBACK_VERIFIED');assert.equal(r.payment_verified,false);
 assert.equal(r.provider_sent,false);assert.equal(f.posted(),1);assert.equal(f.release(),1);
 const h=leadHeaders,row=f.tabs.Leads.rows[1]; const val=(col)=>row[h.indexOf(col)];
 assert.equal(val('Submission_ID'),key);assert.equal(val('Source'),'telegram-agent4');assert.equal(val('Action_Status'),'HOLD_IDENTITY_HISTORY_CONSENT_REVIEW');
 assert.equal(val('Paid_CZK'),'');assert.equal(val('Email'),'');assert.equal(val('Phone_Number'),'');assert.equal(val('Full_Name'),'');
 assert.equal(val('Stage'),'New');assert.match(val('Lead_ID'),/^LEAD-AG4-/);assert.match(val('Notes'),/No identity/);
 assert.ok(f.reads()>0);
 const verify=parse(f.context.impAgent4CrmVerify(key,'OSVC'));assert.equal(verify.case_id,r.case_id);assert.equal(verify.found,true);
});
test('repeating same Agent4 source never creates two CRM rows',()=>{
 const f=fixture();f.enable();const first=parse(f.context.impAgent4CrmImport(payload()));
 const second=parse(f.context.impAgent4CrmImport(payload({local_job_id:123})));
 assert.equal(second.state,'EXISTING_SOURCE_VERIFIED');assert.equal(second.case_id,first.case_id);
 assert.equal(f.posted(),1);
});
test('Druzina separate controller, ID scheme, no payment, no phantom member',()=>{
 const f=fixture();f.enable();const r=parse(f.context.impAgent4CrmImport(payload({legal_entity:'DRUZINA_MORAVY_ZS'})));
 assert.equal(f.tabs.Leads.rows.length,1);assert.equal(f.tabs.Druzina_Enrollment_Pipeline.rows.length,2);
 assert.match(r.case_id,/^DM-\d{3}$/);assert.equal(r.payment_verified,false);
 const row=f.tabs.Druzina_Enrollment_Pipeline.rows[1];const val=n=>row[dmHeaders.indexOf(n)];
 assert.equal(val('Evidence'),key);assert.equal(val('Person'),'');assert.equal(val('Ask_CZK'),'');
 assert.equal(val('Cash_Status'),'NOT_BANK_VERIFIED');assert.equal(val('Outcome'),'PENDING_OWNER_REVIEW');
});
test('DM IDs allocated without clobbering existing DM cases',()=>{
 const f=fixture();f.tabs.Druzina_Enrollment_Pipeline.rows.push(dmHeaders.map(h=>h==='Lead_ID'?'DM-199':'x'));
 f.enable();const r=parse(f.context.impAgent4CrmImport(payload({legal_entity:'DRUZINA_MORAVY_ZS'})));
 assert.equal(r.case_id,'DM-200');
});
test('untrusted input text, arbitrary URI, formula injection and malformed source IDs rejected',()=>{
 for(const field of [{source_key:'=IMP4-TG-'+'a'.repeat(24)}, {source_key:'IMP4-TG-'+'A'.repeat(24)},
  {raw_message:'Private customer text'}, {email:'private@example.com'}, {legal_entity:'OSVC_OTHER'},
  {local_job_id:'7'}, {owner_selftest:true}, {identity_match:'VERIFIED'},
  {crm_person_id:'John'}, {stage:'PAID'}, {provider_send_status:'DELIVERED'},
  {privacy:'FULL_MESSAGE_TEXT'}, {inbound_at:'2000-01-01T00:00:00Z'}]){
  const f=fixture();f.enable();assert.throws(()=>f.context.impAgent4CrmImport(payload(field)),Error,JSON.stringify(field));assert.equal(f.posted(),0);
 }
});
test('source-key mismatch across legal controllers does not cross-link OSVC lead',()=>{
 const f=fixture();f.enable();const x=parse(f.context.impAgent4CrmImport(payload()));
 const y=parse(f.context.impAgent4CrmVerify(key,'DRUZINA_MORAVY_ZS'));
 assert.equal(y.found,false);assert.equal(y.case_id,null);assert.equal(x.controller,'OSVC');
});

test('persisted case ID must match both source key and controller before verification',()=>{
 for(const badId of ['DM-001','LEAD-AG4-'+'b'.repeat(24)]){
  const f=fixture();f.enable();f.context.impAgent4CrmImport(payload());
  f.tabs.Leads.rows[1][leadHeaders.indexOf('Lead_ID')]=badId;
  assert.throws(()=>f.context.impAgent4CrmVerify(key,'OSVC'),/EXISTING_CRM_ID_UNEXPECTED/);
  assert.throws(()=>f.context.impAgent4CrmImport(payload()),/EXISTING_CRM_ID_UNEXPECTED/);
  assert.equal(f.posted(),1);
 }
 const f=fixture();f.enable();f.context.impAgent4CrmImport(payload({legal_entity:'DRUZINA_MORAVY_ZS'}));
 f.tabs.Druzina_Enrollment_Pipeline.rows[1][dmHeaders.indexOf('Lead_ID')]='LEAD-AG4-'+'a'.repeat(24);
 assert.throws(()=>f.context.impAgent4CrmVerify(key,'DRUZINA_MORAVY_ZS'),/EXISTING_CRM_ID_UNEXPECTED/);
});
test('duplicate source key in remote sheet raises review rather than choosing arbitrary case',()=>{
 const f=fixture();f.enable();f.context.impAgent4CrmImport(payload());
 f.tabs.Leads.rows.push([...f.tabs.Leads.rows[1]]);
 assert.throws(()=>f.context.impAgent4CrmVerify(key,'OSVC'),/DUPLICATE_REMOTE_SOURCE_KEY/);
});
test('missing canonical columns fail closed rather than creating a new CRM',()=>{
 const f=fixture();f.enable();f.tabs.Leads.rows[0][leadHeaders.indexOf('Submission_ID')]='BAD_HEADER';
 assert.throws(()=>f.context.impAgent4CrmImport(payload()),/CRM_HEADER_MISSING_Submission_ID/);
 assert.equal(f.posted(),0);
});
test('script lock busy never writes a lead',()=>{
 const f=fixture();f.enable();f.context.LockService.getScriptLock().tryLock();
 assert.throws(()=>f.context.impAgent4CrmImport(payload()),/CRM_LOCK_BUSY/);
 assert.equal(f.posted(),0);
});
test('clasp proof tokens cannot report payment or external send',()=>{
 const f=fixture();assert.equal(f.context.impAgent4CrmPingToken(),'IMPAG4_PING_DISABLED_READY_V1');
 f.enable();assert.equal(f.context.impAgent4CrmPingToken(),'IMPAG4_PING_ENABLED_READY_V1');
 const missing=f.context.impAgent4CrmVerifyToken(key,'OSVC');assert.equal(missing,'IMPAG4_VERIFY_MISSING_'+key+'_NONE');
 const imp=f.context.impAgent4CrmImportToken(payload());assert.match(imp,/^IMPAG4_IMPORT_CREATED_REMOTE_READBACK_VERIFIED_IMP4-TG-[a-f0-9]{24}_LEAD-AG4-/);
 const tok=f.context.impAgent4CrmVerifyToken(key,'OSVC');assert.match(tok,/^IMPAG4_VERIFY_FOUND_IMP4-TG-[a-f0-9]{24}_LEAD-AG4-/);
});

// Integration: real pull + validation + mapping + dedup + readback functions.
// Only provider transport and Sheets storage are in-memory adapters.
function integrated({ackOutage=false}={}){
 const f=fixture();let outage=ackOutage;const requests=[];
 f.context.console={log:()=>{}};
 f.context.UrlFetchApp={fetch:(_url,opt)=>{
  const body=JSON.parse(opt.payload);requests.push(body);
  if(body.action==='ack'&&outage)throw Error('synthetic connection lost after CRM commit');
  const result=body.action==='pull'?{ok:true,protocol:'imperion-agent4-transport-v1',rows:[payload()]}:
   {ok:true,status:'REMOTE_CRM_ACK_VERIFIED',source_key:body.source_key,case_id:body.case_id};
  return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(result)};
 }};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ImperionAgent4CrmPull.gs'),'utf8'),f.context);
 return {...f,requests,recover:()=>{outage=false},run:()=>f.context.impAgent4CrmPull_(
  {key:'f'.repeat(64)},{getSheetByName:n=>f.tabs[n]})};
}
test('integrated scheduled import requires explicit enable; false and missing flags never touch providers',()=>{
 for(const flag of [undefined,'false','TRUE',true]){
  const f=integrated();f.props.IMP_AGENT4_CRM_ENABLED=flag;
  assert.equal(f.run().status,'DISABLED');assert.equal(f.requests.length,0);assert.equal(f.posted(),0);
 }
});
test('integrated CRM persistence survives ACK outage and repeated delivery without duplicate rows',()=>{
 const f=integrated({ackOutage:true});f.enable();
 const first=f.run();assert.equal(first.imported,1);assert.equal(first.acked,0);assert.equal(first.held,1);
 assert.equal(f.posted(),1);f.recover();
 for(let i=0;i<2;i++){
  const next=f.run();assert.equal(next.imported,0);assert.equal(next.acked,1);assert.equal(next.held,0);
 }
 assert.equal(f.posted(),1);assert.equal(f.tabs.Druzina_Enrollment_Pipeline.rows.length,1);
 const row=f.tabs.Leads.rows[1];
 assert.equal(row[leadHeaders.indexOf('Action_Status')],'HOLD_IDENTITY_HISTORY_CONSENT_REVIEW');
 assert.equal(row[leadHeaders.indexOf('Paid_CZK')],'');
 assert.ok(f.requests.filter(r=>r.action==='ack').every(r=>r.case_id==='LEAD-AG4-'+'a'.repeat(24)));
});
test('integrated corrupted controller ID is held without ACK or second insert',()=>{
 const f=integrated();f.enable();f.run();
 f.tabs.Leads.rows[1][leadHeaders.indexOf('Lead_ID')]='DM-001';
 f.requests.length=0;
 const r=f.run();assert.equal(r.held,1);assert.equal(r.acked,0);assert.equal(f.posted(),1);
 assert.deepEqual(f.requests.map(r=>r.action),['pull']);
});

function integratedTick(f){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../imperion-intake-sync.gs'),'utf8'),f.context);
 const website=[];const c=f.context;c.console.warn=()=>{};
 c.impPrivateConfig_=()=>({sheetId:'canonical_hub_id',key:'f'.repeat(64)});
 c.impEnsureReceiptCols_=()=>{};c.impReceiptCatalog_=()=>({});
 c.impPrivateFetch_=()=>{website.push('pull');return {protocol:'imperion-intake-bridge-v1',rsvps:[],enquiries:[],b2b:[],academy:[]}};
 // These outbound adapters are deliberately never connected in a synthetic test.
 for(const name of ['impFlushOwnerDigest_','impSendProofReviewAlerts_','impSendReceiptQueue_',
  'impSendAttendedFollowups_','impSendApprovedChatInvites_'])c[name]=()=>({sent:0,failed:0});
 return {run:()=>c.imperionSyncPrivateIntake(),website};
}
test('existing intake tick runs actual Agent4 bridge once, preserves Academy path and releases lock',()=>{
 const f=integrated();f.enable();const t=integratedTick(f);const r=t.run();
 assert.equal(r.agent4.acked,1);assert.equal(r.newAcademy,0);assert.equal(f.posted(),1);
 assert.deepEqual(t.website,['pull']);assert.equal(f.release(),1);
});
test('Agent4 transport outage does not stop website intake and existing lock is released',()=>{
 const f=integrated();f.enable();const t=integratedTick(f);
 f.context.UrlFetchApp.fetch=()=>{throw Error('synthetic transport down')};
 const r=t.run();assert.equal(r.agent4.status,'HELD');assert.equal(f.posted(),0);
 assert.deepEqual(t.website,['pull']);assert.equal(f.release(),1);
});
