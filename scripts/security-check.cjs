const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {load}=require('./dom-check.cjs');
function webhook(secret='test-only-secret',duplicate=false) {
 const rows=[];let released=0;
 const headers=['Submission_ID','Full_Name','Payment_Reference','Waiver_Accepted'];
 const sheet={getLastColumn:()=>headers.length,getLastRow:()=>duplicate?2:1,getRange:(row)=>({getValues:()=>row===1?[headers]:[[duplicate?'submission-1':'']]}),appendRow:row=>rows.push(row)};
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='TALLY_WEBHOOK_SECRET'?secret:''})},ContentService:{createTextOutput:body=>({body,setMimeType(){return this}}),MimeType:{TEXT:'text',JSON:'json'}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},console:{error(){}},Utilities:{getUuid:()=> 'test-uuid'}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('Code.gs','utf8'),context);context.lookupEventDate=()=>null;
 return {call:data=>context.doPost(data),rows,released:()=>released};
}
(async()=>{
 const req={parameter:{secret:'test-only-secret'},postData:{contents:JSON.stringify({data:{submissionId:'submission-1',fields:[{label:'Full_Name',value:'=HYPERLINK("https://example.com")'},{label:'Waiver_Accepted',value:[]}]}})}};
 const empty=webhook('');assert.equal(empty.call({parameter:{secret:''}}).body,'forbidden');assert.equal(empty.rows.length,0);
 const missing=webhook();assert.equal(missing.call({}).body,'forbidden');assert.equal(missing.call({parameter:{secret:'wrong'}}).body,'forbidden');
 const valid=webhook();assert.equal(JSON.parse(valid.call(req).body).ok,true);assert.equal(valid.rows.length,1);assert.ok(valid.rows[0][1].startsWith("'="));assert.equal(valid.rows[0][3],'no');assert.equal(valid.released(),1);
 const duplicate=webhook(undefined,true);assert.equal(JSON.parse(duplicate.call(req).body).duplicate,true);assert.equal(duplicate.rows.length,0);assert.equal(duplicate.released(),1);
 const malformed=webhook();assert.equal(JSON.parse(malformed.call({parameter:req.parameter,postData:{contents:'{"data":{"fields":[]}}'}}).body).error,'invalid_request');assert.equal(malformed.rows.length,0);assert.equal(malformed.released(),1);
 console.log('PASS webhook authentication, validation, duplicate suppression, formula escaping, checkbox state and lock release');
 for(const lang of ['en','ru','cs','uk']){
  const {dom,w,d,errors}=await load('calendar/index.html',lang);
  try{
   const script=d.querySelector('script[src*="script.google.com"]');const cb=new URL(script.src).searchParams.get('callback');
   const event={title:'<img src=x onerror=alert(1)>',description:'<script>throw 1</script>',startISO:'2099-10-01T16:00:00Z',priceCzk:null,registerUrl:'javascript:alert(1)',community:'__proto__',category:'constructor',imageOverride:'../../bad.png'};
   w[cb]({events:[null,{},event,{...event,startISO:'2000-01-01T00:00:00Z'}]});
   assert.equal(d.querySelectorAll('.event-upcoming-card').length,1);assert.equal(d.querySelector('.eu-title').textContent,event.title);assert.equal(d.querySelectorAll('.eu-title img,.eu-desc script').length,0);assert.ok(d.querySelector('.eu-ctas a').href.startsWith('https://docs.google.com/forms/'));assert.ok(!d.querySelector('.eu-price').textContent.includes('0 Kč'));assert.ok(d.querySelector('.eu-img img').src.endsWith('main_hero.webp'));assert.ok(d.querySelector('.eu-date').textContent.includes('18:00'));assert.deepEqual(errors,[]);
   const emptyDom=await load('calendar/index.html',lang);const emptyScript=emptyDom.d.querySelector('script[src*="script.google.com"]');const emptyCb=new URL(emptyScript.src).searchParams.get('callback');emptyDom.w[emptyCb]({events:[]});assert.equal(emptyDom.d.querySelector('#calEventsBody').dataset.eventStatus,'ready');assert.equal(emptyDom.d.querySelectorAll('.events-empty-message a').length,3);emptyDom.dom.window.close();
   const failed=await load('calendar/index.html',lang);failed.d.querySelector('script[src*="script.google.com"]').dispatchEvent(new failed.w.Event('error'));assert.equal(failed.d.querySelector('#calEventsBody').dataset.eventStatus,'error');assert.ok(failed.d.querySelector('.calendar-cta-btn'));failed.dom.window.close();
   console.log('PASS event sanitization, missing price, malformed records, empty state and error fallback',lang);
  }finally{dom.window.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
