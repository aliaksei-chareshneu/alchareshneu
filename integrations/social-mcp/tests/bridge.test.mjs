import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const code = fs.readFileSync(new URL('../bridge/MCPBridge.gs',import.meta.url),'utf8');
const jobHeaders=['Duplicate_Checked','Job_ID','Event_ID','Channel','Scheduled_At','Status','Caption','Media_URL','Video_Drive_ID','Post_ID','Post_URL','Attempted_At','Error','Entity','Grant_Funded','Grant_Text','Rights_OK','Approved_At','Visibility','Made_For_Kids'];
const eventHeaders=['Event_ID','Status','Community','Category','Title','Start_DateTime','End_DateTime','Location_Name','Location_Address','Price_CZK','Description','Tally_Form_URL','Telegram_Post_ID'];
const jobId='PUB-HEMA-20261114:telegram';
const eventId='PUB-HEMA-20261114';
function sheet(headers, records){
  const rows=[headers, ...records.map(x=>headers.map(k=>x[k]??''))];
  return {
    rows,
    getLastRow(){return this.rows.length;}, getLastColumn(){return this.rows[0].length;},
    getRange(r,c,rCount=1,cCount=1){
      return {getValues:()=>rows.slice(r-1,r-1+rCount).map(row=>row.slice(c-1,c-1+cCount)),
        setValue:v=>{rows[r-1][c-1]=v;return this;}};
    },
    get(k){return rows[1][headers.indexOf(k)];}
  };
}
function fixture(overrides={}, evOverrides={}, telegramImpl){
  const caption='Approved public training, with equipment and safety briefing.';
  const job=sheet(jobHeaders,[{Duplicate_Checked:'YES',Job_ID:jobId,Event_ID:eventId,Channel:'telegram',Status:'APPROVED',Caption:caption,Entity:'Družina Moravy z.s.',Grant_Funded:'NO',Rights_OK:'YES',Approved_At:'2026-10-25',Visibility:'PUBLIC',...overrides}]);
  const event=sheet(eventHeaders,[{Event_ID:eventId,Status:'Active',Community:'Družina Moravy',Start_DateTime:new Date(Date.now()+86400000),Telegram_Post_ID:'',...evOverrides}]);
  let telegramCalls=0;
  const ctxt={
    ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({body:s,setMimeType(){return this;}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=> k==='MCP_BRIDGE_SECRET'?'a'.repeat(40):''})},
    SpreadsheetApp:{openById:()=>({getSheetByName:k=>k==='Events'?event:k==='SocialPublishing'?job:null}),flush:()=>{}},
    CacheService:{getScriptCache:()=>({get:k=>null,put:(k,v,ttl)=>{}})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(s,key)=>Array.from(crypto.createHmac('sha256',key).update(s).digest()).map(n=>n>127?n-256:n)},
    TELEGRAM_BOT_TOKEN:'TEST_ONLY_DUMMY', TELEGRAM_CHANNEL_DRUZINA:'@druzinamoravy_news', TELEGRAM_CHANNEL_BRNOWALKERS:'@pochody_brno_news', SPREADSHEET_ID:'synthetic',
    UrlFetchApp:{fetch:(url,opt)=>{telegramCalls++; if(telegramImpl)return telegramImpl(url,opt);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,result:{message_id:731}})};}},
    console:{error:()=>{}}, Date, Math, Number, String, Boolean, RegExp, JSON
  };
  vm.createContext(ctxt);vm.runInContext(code,ctxt);
  const call=(action='publish_telegram',sigOverride)=>{
    const ts=Date.now(),nonce='f'.repeat(32),raw=['v1',action,jobId,String(ts),nonce].join('\n');
    const sig=sigOverride||crypto.createHmac('sha256','a'.repeat(40)).update(raw).digest('hex');
    return JSON.parse(ctxt.imperionMcpHandle_({postData:{contents:JSON.stringify({version:'v1',action,job_id:jobId,ts,nonce,sig})}}).body);
  };
  return {call,job,event,calls:()=>telegramCalls};
}

test('Apps Script bridge accepts a signed approved job and records both receipts',()=>{
  const f=fixture();
  const preview=f.call('preview_telegram');assert.equal(preview.ready,true);
  assert.equal(f.calls(),0);
  const r=f.call();assert.equal(r.ok,true);
  assert.equal(r.status,'PUBLISHED_VERIFIED');
  assert.equal(f.job.get('Post_ID'),'731');
  assert.equal(f.event.get('Telegram_Post_ID'),'731');
  assert.equal(r.url,'https://t.me/druzinamoravy_news/731');
  assert.equal(f.calls(),1);
});

test('DRAFT job blocks; no Telegram call even when HMAC is correct',()=>{
  const f=fixture({Status:'DRAFT'});
  const r=f.call();assert.equal(r.code,'APPROVAL_GATES_BLOCKED');
  assert.equal(f.calls(),0);
});

test('event was already announced: no duplicate send',()=>{
  const f=fixture({},{Telegram_Post_ID:'649'});
  const r=f.call();assert.equal(r.code,'APPROVAL_GATES_BLOCKED');
  assert.equal(f.calls(),0);
});

test('invalid HMAC rejects before sheet reads or sending',()=>{
  const f=fixture();const r=f.call('publish_telegram','0'.repeat(64));
  assert.equal(r.code,'AUTH_OR_REQUEST_DENIED');assert.equal(f.calls(),0);
});

test('uncertain Telegram API outcome requires reconciliation, with no retry',()=>{
  const f=fixture({}, {}, ()=>{throw Error('network timeout');});
  const r=f.call();assert.equal(r.code,'RECONCILIATION_REQUIRED');
  assert.equal(f.calls(),1);assert.equal(f.job.get('Status'),'RECONCILIATION_REQUIRED');
});

test('WhatsApp group preview never sends anything',()=>{
  const f=fixture({Job_ID:jobId,Channel:'whatsapp'});
  const r=f.call('preview_whatsapp');
  assert.equal(r.ok,true);assert.equal(r.ready,true);assert.equal(f.calls(),0);
});