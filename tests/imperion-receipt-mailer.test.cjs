const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('imperion-intake-sync.gs','utf8');
const ref='11111111-1111-4111-8111-111111111111';
function harness(){
 const record={
   Submission_ID:ref,Event_ID:'PUB-HIKE-20261101',
   Source_Channel:'WEBSITE_RSVP_SUPABASE_UNCONFIRMED',
   Email:'applicant@example.invalid',Data_Controller:'Družina Moravy, z. s.',
   Receipt_Status:'PENDING',Receipt_Attempts:'0',Receipt_Sent_At:'',Receipt_Locale:'ru'
 };
 const keys=Object.keys(record),rows=[keys,keys.map(k=>record[k])];
 const sheet={
  getLastRow:()=>rows.length,getLastColumn:()=>keys.length,
  getRange:(r,c,n=1,width=1)=>({
    getDisplayValues:()=>rows.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+width).map(String)),
    setValue:v=>{rows[r-1][c-1]=v;},
    clearContent:()=>{rows[r-1][c-1]='';}
  })
 };
 const db={getSheetByName:n=>n==='Registrations'?sheet:null};
 let failFirst=true;const dispatched=[];
 const MailApp={
  getRemainingDailyQuota:()=>50,
  sendEmail:msg=>{if(failFirst){failFirst=false;throw Error('temporary delivery outage');}dispatched.push(msg);}
 };
 const UrlFetchApp={fetch:()=>({
  getResponseCode:()=>200,
  getContentText:()=>JSON.stringify({events:[{
   event_id:'PUB-HIKE-20261101',title:'A verified walk',
   begins_at:'2026-11-01T11:45:00Z',
   venue:'Velká Klajdovka, Brno',price_czk:0,price_verified:true
  }]})
 })};
 const Utilities={formatDate:()=> '01.11.2026 12:45'};
 const api=new Function('MailApp','UrlFetchApp','Utilities',source+
  ';return {impSendReceiptQueue_,impReceiptMessage_,impReceiptWords_};')(MailApp,UrlFetchApp,Utilities);
 return {api,rows,keys,db,dispatched};
}
test('retries mail outage without creating a second CRM or a confirmed booking',()=>{
 const h=harness(),state=()=>h.rows[1][h.keys.indexOf('Receipt_Status')];
 assert.deepEqual(h.api.impSendReceiptQueue_(h.db,{email:'owner@example.invalid'}),{sent:0,failed:1});
 assert.equal(state(),'RETRY');
 assert.deepEqual(h.api.impSendReceiptQueue_(h.db,{email:'owner@example.invalid'}),{sent:1,failed:0});
 assert.equal(state(),'SENT_TO_PROVIDER');
 assert.equal(h.api.impSendReceiptQueue_(h.db,{email:'owner@example.invalid'}).sent,0);
 assert.equal(h.dispatched.length,1);
 const msg=h.dispatched[0];
 assert.equal(msg.to,'applicant@example.invalid');
 assert.match(msg.body,/A verified walk/);
 assert.match(msg.body,/Velká Klajdovka/);
 assert.match(msg.body,/Не приезжайте и не платите до подтверждения/);
 assert.doesNotMatch(msg.body,/confirmed booking|оплата получена/i);
 assert.equal(msg.replyTo,'owner@example.invalid');
});
test('rejects stale/wrong-source and non-email rows, including business rows outside New',()=>{
 const h=harness(), m=Object.fromEntries(h.keys.map((k,i)=>[k,i])),row=h.rows[1].slice();
 assert.ok(h.api.impReceiptMessage_('RSVP',row,m,{}));
 row[m.Source_Channel]='IMPORTED_LEGACY';assert.equal(h.api.impReceiptMessage_('RSVP',row,m,{}),null);
 row[m.Source_Channel]='WEBSITE_RSVP_SUPABASE_UNCONFIRMED';
 row[m.Email]='not-a-valid-email';assert.equal(h.api.impReceiptMessage_('RSVP',row,m,{}),null);
});
test('source contains GDPR-safe dispatch, retry and 5-minute trigger not a marketing campaign',()=>{
 assert.doesNotThrow(()=>new Function(source));
 assert.match(source,/everyMinutes\(5\)/);
 assert.match(source,/impEnsureReceiptCols_/);
 assert.match(source,/MailApp.sendEmail\(\{to:msg.to/);
 assert.match(source,/REVIEW_NO_EMAIL/);
 assert.match(source,/SENT_TO_PROVIDER/);
 assert.doesNotMatch(source,/sendBroadcast|sendCampaign|newsletterSubscribe/);
});
