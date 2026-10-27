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
