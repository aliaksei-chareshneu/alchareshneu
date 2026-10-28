const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const gs=fs.readFileSync('imperion-intake-sync.gs','utf8');
const edge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261026_imperion_private_intake.sql','utf8');
test('Google Apps Script helper parses, deduplicates and has a safe receipt order',()=>{
 assert.doesNotThrow(()=>new Function(gs));
 assert.match(gs,/getSheetByName\('Registrations'\)/);
 assert.match(gs,/getSheetByName\('Druzina_Requests'\)/);
 assert.match(gs,/impExisting_/);
 assert.match(gs,/Acknowledge only AFTER/);
 assert.match(gs,/imperionCleanupPrivateIntake/);
 assert.match(gs,/everyMinutes\(5\)/);
 assert.match(gs,/impSendReceiptQueue_/);
 assert.match(gs,/SENT_TO_PROVIDER/);
 assert.match(gs,/REVIEW_NO_EMAIL/);
 assert.match(gs,/REQUESTED_UNCONFIRMED/);
});
test('private bridge rejects access before source rows are selected',()=>{
 assert.match(edge,/verify_imperion_intake_bridge_token/);
 assert.match(edge,/error:"unauthorized"/);
 assert.match(edge,/error:"forbidden"/);
 assert.match(edge,/is\("crm_synced_at",null\)/);
 assert.match(edge,/invalid_ack/);
 assert.doesNotMatch(edge,/access-control-allow-origin/i);
});
test('SQL migration is idempotent and service-role-only',()=>{
 assert.match(sql,/consecutive_empty_feeds/);
 assert.match(sql,/v_empty>=2/);
 assert.match(sql,/vault\.create_secret/);
 assert.match(sql,/add column if not exists crm_synced_at/);
 assert.match(sql,/revoke all on function public\.verify_imperion_intake_bridge_token/);
 assert.match(sql,/to service_role/);
});


test('rejects duplicate headers and verifies persisted CRM row receipt',()=>{
 const helpers=new Function(gs+'; return {impHeader_,impAppend_};')();
 const dup={getLastColumn:()=>3,getRange:()=>({getDisplayValues:()=>[['Reg_ID','Submission_ID','Submission_ID']]})};
 assert.throws(()=>helpers.impHeader_(dup),/Duplicate CRM header/);
 assert.match(gs,/CRM append readback failed/);
});
test('owner digest survives a MailApp failure and retries with zero new registrations',()=>{
 const kv=new Map(),mails=[];
 const PropertiesService={getScriptProperties:()=>({
   getProperty:k=>kv.get(k)||null,
   setProperty:(k,v)=>kv.set(k,v),
   deleteProperty:k=>kv.delete(k),
 })};
 let fail=true;
 const MailApp={sendEmail:(...args)=>{if(fail){fail=false;throw Error('mail outage')}mails.push(args)}};
 const fn=new Function('PropertiesService','MailApp',gs+';return {impQueueOwnerDigest_,impFlushOwnerDigest_};')(PropertiesService,MailApp);
 fn.impQueueOwnerDigest_(2,1);
 assert.deepEqual(fn.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'sheet'}),{sent:false,pending:true});
 assert.equal(mails.length,0);
 assert.deepEqual(fn.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'sheet'}),{sent:true,pending:false});
 assert.equal(mails.length,1);
 assert.match(mails[0][1],/3/);
 assert.equal(kv.size,0);
 assert.deepEqual(fn.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'sheet'}),{sent:false,pending:false});
});

test('private B2B inquiry intake maps to canonical Leads tab with strict no-cash status',()=>{
 assert.match(gs,/getSheetByName\('Leads'\)/);
 assert.match(gs,/OSVC-B2B-/);
 assert.match(gs,/OSVC_B2B_INBOUND_REVIEW_NO_ORDER_NO_CASH/);
 assert.match(gs,/pending\.b2b/);
 assert.match(gs,/newB2B:addedB/);
 assert.match(gs,/OSVC_B2B_EXPIRED_ANONYMIZED/);
 assert.match(edge,/from\("imperion_b2b_inquiries"\)/);
 assert.match(edge,/b2b:b2b\.data/);
 assert.match(edge,/b2b:ba/);
 assert.doesNotMatch(edge,/access-control-allow-origin/i);
});


test('public RSVP safety acknowledgement cannot become a waiver, and timestamps retain hours',()=>{
 const {impWriteRsvps_}=new Function(gs+';return {impWriteRsvps_};')();
 const headers=['Reg_ID','Event_ID','Timestamp','Full_Name','Waiver_Accepted',
  'Safety_Acknowledged','Retention_Until','Submission_ID','RSVP_Status',
  'RSVP_Status_At','Consent_Recorded_At','Payment_Status'];
 const records=[], formats=[];
 const sheet={
  getLastColumn:()=>headers.length,
  getLastRow:()=>records.length+1,
  getRange(row,col,count=1,width=1){
   return {
    getDisplayValues:()=>row===1?[headers]:records.slice(row-2,row-2+count).map(r=>[String(r[col-1]??'')]),
    setValues(values){assert.equal(width,headers.length);records[row-2]=values[0];},
    getDisplayValue:()=>String(records[row-2]?.[col-1]??''),
    setNumberFormat(format){formats.push({row,col,format});}
   };
  }
 };
 const id='12345678-1234-4123-8123-123456789012';
 const applicant={
  id,event_id:'QA-FREE-HIKE',rsvp_status:'YES',first_name:'Synthetic',
  last_name:'Visitor',safety_acknowledged:true,safety_version:'qa-v1',
  photo_choice:'NO',marketing_requested:false,
  created_at:'2026-10-28T07:31:49.151Z',
  retention_until:'2027-01-30T15:15:00.000Z'
 };
 const ss={getSheetByName:name=>name==='Registrations'?sheet:null};
 const events={'QA-FREE-HIKE':{price_verified:true,price_czk:0}};
 assert.deepEqual(impWriteRsvps_(ss,[applicant],events),{ids:[id],added:1});
 const saved=records[0];
 assert.equal(saved[headers.indexOf('Waiver_Accepted')],'',
  'safety confirmation must not create a legal waiver');
 assert.equal(saved[headers.indexOf('Safety_Acknowledged')],'YES');
 assert.equal(saved[headers.indexOf('Payment_Status')],'NOT_REQUIRED');
 for(const field of ['Timestamp','Retention_Until','RSVP_Status_At','Consent_Recorded_At']){
  const col=headers.indexOf(field)+1;
  assert.ok(saved[col-1] instanceof Date,field+' must remain a native datetime');
  assert.ok(formats.some(f=>f.row===2&&f.col===col&&f.format==='dd.mm.yyyy hh:mm'),
   field+' must be displayed with hours and minutes');
 }
 assert.deepEqual(impWriteRsvps_(ss,[applicant],events),{ids:[id],added:0},
  'existing submission ID must be idempotent');
 assert.equal(records.length,1);
});
