'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const gs=fs.readFileSync('imperion-intake-sync.gs','utf8');
const edge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');

function fakeLeads(){
 const headers=['Lead_ID','Created_At','Full_Name','Email','Source','Service','Subject_Goal',
 'Language','Format','Stage','Product_ID','Expected_Value_CZK','Next_Action_At',
 'Followup_Count','Paid_CZK','Owner','Notes','Submission_ID','Retention_Until',
 'Last_Automation_At','Action_Status','Priority','Receipt_Status','Receipt_Attempts','Receipt_Locale'];
 const rows=[];
 const sheet={
  getLastColumn:()=>headers.length,getLastRow:()=>rows.length+1,getSheetId:()=>945016744,
  getRange(row,col,count=1,width=1){return {
    getDisplayValues:()=>{
      const matrix=[headers,...rows];
      return matrix.slice(row-1,row-1+count).map(v=>v.slice(col-1,col-1+width).map(v=>v instanceof Date?v.toISOString():String(v??'')));
    },
    setValues(v){rows[row-2]=v[0];},
    getDisplayValue:()=>String(rows[row-2]?.[col-1]??''),
    setNumberFormat:()=>{},
    clearContent(){rows[row-2][col-1]='';},
    setValue(v){rows[row-2][col-1]=v;}
  }}
 };
 return {headers,rows,ss:{getSheetByName:n=>n==='Leads'?sheet:null}};
}
test('Academy stays behind authorized private opt-in and legacy bridge is stable',()=>{
 assert.match(edge,/verify_imperion_intake_bridge_token/);
 assert.match(edge,/x-imperion-intake-academy/);
 assert.match(edge,/academyProtocolV1\?validIds/);
 assert.match(edge,/academy_protocol_required/);
 assert.match(edge,/academyProtocolV1\?\{academy:academy\?\.data\|\|\[\]\}/);
 assert.match(edge,/from\("imperion_academy_inquiries"\)/);
 assert.match(edge,/\.is\("crm_synced_at",null\)/);
 assert.match(edge,/academy ack/);
 assert.doesNotMatch(edge,/access-control-allow-origin/i);
 assert.match(gs,/x-imperion-intake-academy':'v1'/);
 assert.match(gs,/Acknowledge only AFTER/);
 assert.match(gs,/academy:d\.ids/);
 assert.match(gs,/REVIEW_NO_EMAIL/);
 assert.doesNotThrow(()=>new Function(gs));
});
test('Academy uses existing OSVC Leads, never claims bookings, money or email receipt',()=>{
 const {headers,rows,ss}=fakeLeads();
 const fn=new Function(gs+';return {impWriteAcademy_};')();
 const id='12345678-1234-4123-8123-123456789012';
 const row={id,first_name:'Synthetic QA',email:'qa@example.invalid',
  product_code:'LESSON',goal:'Pass Czech exam',deadline:'Preferred Tue 19:00 | Alternatives Sat 11:00',
  locale:'ru',utm_source:'homepage',source:'academy_standard_20261113',
  created_at:'2026-11-13T11:00:00Z',retention_until:'2027-05-12T11:00:00Z'};
 assert.deepEqual(fn.impWriteAcademy_(ss,[row]),{ids:[id],added:1});
 assert.deepEqual(fn.impWriteAcademy_(ss,[row]),{ids:[id],added:0});
 assert.equal(rows.length,1);
 const saved=Object.fromEntries(headers.map((k,i)=>[k,rows[0][i]]));
 assert.equal(saved.Submission_ID,'OSVC-ACADEMY-'+id);
 assert.equal(saved.Stage,'New');
 assert.equal(saved.Paid_CZK,0);
 assert.equal(saved.Expected_Value_CZK,'');
 assert.equal(saved.Receipt_Status,'REVIEW_NO_EMAIL');
 assert.match(saved.Action_Status,/NO_BOOKING_NO_PAYMENT/);
 assert.match(saved.Notes,/Vernety|Preferred Tue 19:00|not NGO/i);
 assert.ok(saved.Retention_Until instanceof Date);
 assert.throws(()=>fn.impWriteAcademy_(ss,[{...row,product_code:'BOGUS'}]),/Invalid Academy/);
});
test('owner-only digest adds Academy counter but not private student name or email',()=>{
 const {ss}=fakeLeads(),kv=new Map(),mails=[];
 const PropertiesService={getScriptProperties:()=>({
   getProperty:k=>kv.get(k)||null,setProperty:(k,v)=>kv.set(k,v),
   deleteProperty:k=>kv.delete(k)
 })};
 const MailApp={sendEmail:(...args)=>mails.push(args)};
 const h=new Function('PropertiesService','MailApp',gs+
   ';return {impQueueOwnerDigest_,impFlushOwnerDigest_,impWriteAcademy_};')(PropertiesService,MailApp);
 const id='12345678-1234-4123-8123-123456789012';
 h.impWriteAcademy_(ss,[{id,first_name:'Private Student Name',email:'private@example.invalid',
  product_code:'LESSON',goal:'Private tuition',deadline:'Sat 13:00',locale:'en',
  created_at:'2026-11-13T11:00:00Z',retention_until:'2027-05-12T11:00:00Z'}]);
 h.impQueueOwnerDigest_(0,0,0,ss,1);
 assert.equal(JSON.parse(kv.get('IMPERION_INTAKE_NOTIFY_PENDING')).academy,1);
 const x=h.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'sheet123'},ss,{});
 assert.deepEqual(x,{sent:true,pending:false});
 assert.match(mails[0][1],/Academy/);
 assert.match(mails[0][2],/Leads/);
 assert.doesNotMatch(mails[0][2],/Private Student Name|private@example\.invalid|Private tuition/);
 assert.equal(kv.size,0);
});
