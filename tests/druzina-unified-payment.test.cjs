'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const edge=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261109_druzina_training_payments.sql','utf8');
const browser=fs.readFileSync('register/training-payment.js','utf8');
const bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const crm=fs.readFileSync('imperion-intake-sync.gs','utf8');
const clean=fs.readFileSync('supabase/functions/imperion-training-proof-retention/index.ts','utf8');
const paths=['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html'];

function loadQuote(){
 const start=edge.indexOf('function trainingQuote(');
 const end=edge.indexOf('\nasync function readSmallMultipart',start);
 assert.ok(start>0&&end>start,'server quote function must exist');
 const body=edge.slice(start,end)
  .replace('function trainingQuote(e:TrainingEvent,now=Date.now())','function trainingQuote(e,now=Date.now())')
  .replaceAll('(n as number)','n').replaceAll('(surcharge as number)','surcharge');
 return new Function('const LATE_WINDOW_MS=48*60*60*1000;\n'+body+'\nreturn trainingQuote;')();
}
const trainingQuote=loadQuote();
const e={
  event_id:'PUB-HEMA-20261116',community:'Družina Moravy',category:'HEMA Training',
  begins_at:'2026-11-16T17:00:00Z',is_open:true,source_active:true,price_verified:true,
  end_time_verified:true,registration_mode:'FORM',training_price_scheme:'GROUP_SHARED',
  training_confirmed_count:3,training_payment_open:true,
  training_quote_locked_at:'2026-11-15T09:00:00Z',
  training_operational_go_at:'2026-11-15T09:00:00Z',
  training_payment_recipient:'Druzina Moravy z.s.',training_payment_account:'BANK-VERIFIED-PLACEHOLDER'
};
const start=Date.parse(e.begins_at);
test('group pricing follows 7 November public model with Czech-crown rounding',()=>{
  for(const [n,amount] of [[3,440],[5,328],[10,244],[15,216],[20,202]]){
    const q=trainingQuote({...e,training_confirmed_count:n},start-72*3600000);
    assert.equal(q.status,'PAYMENT_OPEN');
    assert.equal(q.baseCzk,amount);
    assert.equal(q.surchargeCzk,0);
    assert.equal(q.totalCzk,amount);
  }
});
test('48-hour boundary uses actual UTC timestamp; <48 h adds 25%',()=>{
  const onBoundary=trainingQuote(e,start-48*3600000);
  assert.equal(onBoundary.late48h,false);
  assert.equal(onBoundary.totalCzk,440);
  for(const [n,base,charged] of [[3,440,550],[5,328,410],[10,244,305]]){
    const q=trainingQuote({...e,training_confirmed_count:n},start-48*3600000+1);
    assert.equal(q.late48h,true);
    assert.equal(q.totalCzk,charged);
    assert.equal(q.surchargeCzk,charged-base);
  }
});
test('never quote unavailable/unapproved sessions, workshops or legacy commitments',()=>{
 const cases=[
   {...e,training_confirmed_count:null},{...e,training_confirmed_count:2},
   {...e,training_payment_open:false},{...e,training_operational_go_at:null},
   {...e,training_quote_locked_at:null},{...e,is_open:false},
   {...e,source_active:false},{...e,training_payment_account:null},
   {...e,price_verified:false}
 ];
 for(const item of cases)assert.equal(trainingQuote(item,start-72*3600000).status,'AWAITING_VERIFIED_GROUP');
 assert.equal(trainingQuote({...e,category:'FREE Workshop',event_id:'PUB-OREL-20261114'},start-72*3600000),null);
 assert.equal(trainingQuote({...e,training_price_scheme:'LEGACY',event_id:'PUB-HEMA-20261109'},start-72*3600000),null);
});
test('server requires private one-time code, PDF signature, quote snapshot, prevents duplicate receipt',()=>{
 for(const needle of [
   "payment_resume_token_hash","crypto.getRandomValues","await tokenHash(resumeToken)",
   ".eq('payment_resume_token_hash',hashed)","'PROOF_RECEIVED'",
   "body.quotedTotalCzk!==quote!.totalCzk","body.quoteLockedAt!==quote!.quoteLockedAt",
   "pdfInfo(proof)","new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'",
   ".is('payment_pdf_path',null)","payment_crm_synced_at:null",
   "bankVerified:false"
 ])assert.ok(edge.includes(needle),needle);
 assert.ok(!edge.includes("bank_verified_at:new Date()"),'upload cannot mean cleared money');
 assert.ok(sql.includes('public boolean')===false);
 assert.ok(sql.includes("'imperion-training-payment-proofs',false"));
});
test('only main form displays optional private code and conditional PDF across four locales',()=>{
 new Function(browser);
 for(const path of paths){
   const html=fs.readFileSync(path,'utf8');
   for(const id of ['trainingPayment','paymentResumeToken','paymentProof','eventId','rsvpForm'])
     assert.ok(html.includes('id="'+id+'"'),path+' '+id);
   assert.match(html,/training-payment\.js/);
   assert.match(html,/paymentProofField/);
   assert.match(html,/payload\.resumeToken/);
   const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/ig;
   let m,parsed=0;
   while((m=re.exec(html))!==null){
     if(/\b(src|type=['"]application\/ld\+json)/i.test(m[1])||!m[2].trim())continue;
     assert.doesNotThrow(()=>new Function(m[2]),path+' inline JS syntax error');
     parsed++;
   }
   assert.ok(parsed>0,path+' inline JS not checked');
 }
});
test('CRM bridge updates same RSVP, never duplicates record or claims bank verification',()=>{
 for(const needle of [
   'payment_crm_synced_at.is.null','payment_evidence_status.eq.PROOF_RECEIVED',
   'impUpdateExistingRsvpProof_','Quoted_Total_CZK','Payment_Evidence_Status',
   "Payment_Proof_Received_At"
 ])assert.ok((bridge+crm).includes(needle),needle);
 assert.ok(!bridge.includes('payment_pdf_path')&&!bridge.includes('payment_pdf_sha256'));
 assert.ok(crm.includes("Payment_Status:paymentStatus"),'existing payment state retained');
});
test('private Storage cleanup uses Storage API and does not expose URLs',()=>{
 assert.ok(clean.includes(".storage.from(BUCKET).list("));
 assert.ok(clean.includes(".storage.from(BUCKET).remove("));
 assert.ok(clean.includes("verify_imperion_intake_bridge_token"));
 assert.ok(!clean.includes("api.schema('storage')"));
 assert.ok(!clean.includes("download(")&&!clean.includes("getPublicUrl("));
});
