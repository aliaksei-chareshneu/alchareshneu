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


test('event logistics WhatsApp link is sourced from canonical Events, RSVP only and adult only',()=>{
 const link='https://chat.whatsapp.com/'+'A'.repeat(22),evId='PUB-HIKE-20261101';
 const headers=['Event_ID','Updates_Group_URL'],entries=[[evId,link]];
 const sheet={
  getLastColumn:()=>2,
  getLastRow:()=>2,
  getRange:(r,c,n,w)=>({getDisplayValues:()=>r===1?[headers]:entries})
 };
 const ss={getSheetByName:name=>name==='Events'?sheet:null};
 const h=new Function(gs+';return {impReceiptAttachEventGroups_,impReceiptMessage_};')();
 const events=h.impReceiptAttachEventGroups_(ss,{[evId]:{title:'BrnoWalkers hike',category:'Hike'}});
 assert.equal(events[evId].updates_group_url,link);
 const uuid='12345678-1234-4123-8123-123456789012';
 const m={Submission_ID:0,Source_Channel:1,Event_ID:2,Email:3,Age:4,
  RSVP_Status:5,Receipt_Locale:6,Data_Controller:7};
 const row=[uuid,'WEBSITE_RSVP_SUPABASE_UNCONFIRMED',evId,
  'registrant@example.invalid','adult','REGISTERED','en','Družina Moravy, z. s.'];
 const receipt=h.impReceiptMessage_('RSVP',row,m,events);
 assert.ok(receipt);
 assert.match(receipt.body,/WhatsApp group for updates about this event/);
 assert.ok(receipt.body.includes(link));
 assert.match(receipt.body,/Joining is optional/);
 assert.match(receipt.body,/not confirmed yet/);
 assert.ok(!h.impReceiptMessage_('RSVP',[...row.slice(0,4),'under18',...row.slice(5)],m,events).body.includes(link));
 assert.ok(!h.impReceiptMessage_('RSVP',[...row.slice(0,5),'DECLINED',...row.slice(6)],m,events).body.includes(link));
 assert.ok(!h.impReceiptMessage_('RSVP',row,m,{[evId]:{title:'Other event'}}).body.includes(link));
 assert.match(gs,/events=impReceiptAttachEventGroups_\(ss,events\|\|impReceiptCatalog_\(\)\)/);
});

test('owner digest summarizes the precise new event without disclosing applicant PII',()=>{
 const kv=new Map(),mails=[];
 const PropertiesService={getScriptProperties:()=>({
   getProperty:k=>kv.get(k)||null,
   setProperty:(k,v)=>kv.set(k,v),
   deleteProperty:k=>kv.delete(k)
 })};
 const MailApp={sendEmail:(...args)=>mails.push(args)};
 function sheet(headers,rows,id){
   return {
     getLastColumn:()=>headers.length,
     getLastRow:()=>rows.length+1,
     getSheetId:()=>id,
     getRange:(r,c,n=1,w=1)=>({
       getDisplayValues:()=>r===1?[headers.slice(c-1,c-1+w)]:
         rows.slice(r-2,r-2+n).map(x=>x.slice(c-1,c-1+w))
     })
   };
 }
 const id='12345678-1234-4123-8123-123456789012';
 const reg=sheet(
   ['Submission_ID','Source_Channel','Event_ID','RSVP_Status','Full_Name','Email'],
   [[id,'WEBSITE_RSVP_SUPABASE_UNCONFIRMED','PUB-HIKE-20261101','REGISTERED',
     'Private Test Person','private@example.invalid']],560816289);
 const ctrl=sheet(['Datum / Date','Мероприятие / Event','Event_ID'],
   [['2026-11-01 12:45','Hády → Růženin lom → Obřany','PUB-HIKE-20261101']],2026101802);
 const ss={getSheetByName:name=>name==='Registrations'?reg:
   name==='RSVP_Control'?ctrl:null};
 const fn=new Function('PropertiesService','MailApp',gs+
   ';return {impQueueOwnerDigest_,impFlushOwnerDigest_};')(PropertiesService,MailApp);
 fn.impQueueOwnerDigest_(1,0,0,ss);
 assert.equal(JSON.parse(kv.get('IMPERION_INTAKE_NOTIFY_PENDING')).items.length,1);
 const outcome=fn.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'sheet123'},ss,{});
 assert.deepEqual(outcome,{sent:true,pending:false});
 assert.equal(mails.length,1);
 assert.match(mails[0][1],/Hády/);
 assert.match(mails[0][2],/01.11.2026|2026-11-01/);
 assert.match(mails[0][2],/chce přijít: 1/);
 assert.match(mails[0][2],/ne potvrzené místo/);
 assert.match(mails[0][2],/gid=560816289&range=A2/);
 assert.doesNotMatch(mails[0][2],/Private Test Person|private@example.invalid/);
 assert.doesNotMatch(mails[0][2],/FIREMNÍ OSVČ POPTÁVKY/);
 assert.equal(kv.size,0);
});

test('owner digest persists counts even without optional CRM details',()=>{
 const kv=new Map(),mails=[];
 const PropertiesService={getScriptProperties:()=>({
   getProperty:k=>kv.get(k)||null,
   setProperty:(k,v)=>kv.set(k,v),
   deleteProperty:k=>kv.delete(k)
 })};
 const MailApp={sendEmail:(...args)=>mails.push(args)};
 const fn=new Function('PropertiesService','MailApp',gs+
   ';return {impQueueOwnerDigest_,impFlushOwnerDigest_};')(PropertiesService,MailApp);
 fn.impQueueOwnerDigest_(0,0,2);
 assert.deepEqual(fn.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'sheet123'}),
   {sent:true,pending:false});
 assert.match(mails[0][2],/FIREMNÍ OSVČ POPTÁVKY/);
 assert.doesNotMatch(mails[0][2],/DRUŽINA MORAVY — zájem/);
 assert.doesNotMatch(mails[0][2],/REGISTRACE NA AKCE — nové/);
});
