'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const edge=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
const newSql=fs.readFileSync('supabase/migrations/20261109_druzina_restore_current_individual_rates.sql','utf8');
const oldSql=fs.readFileSync('supabase/migrations/20261109_druzina_training_payments.sql','utf8');
const browser=fs.readFileSync('register/training-payment.js','utf8');
const bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const crm=fs.readFileSync('imperion-intake-sync.gs','utf8');
const clean=fs.readFileSync('supabase/functions/imperion-training-proof-retention/index.ts','utf8');
const paths=['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html'];
function loadQuote(){
 const start=edge.indexOf('function trainingQuote('),end=edge.indexOf('async function readSmallMultipart',start);
 assert.ok(start>0&&end>start,'server quote function must exist');
 const rates=/const TRAINING_BASE_PRICES:Record<TrainingTier,number>=(\{[^;]*\});/.exec(edge);
 assert.ok(rates,'source of authoritative tariff rates');
 const code=edge.slice(start,end)
  .replace("function trainingQuote(e:TrainingEvent,now=Date.now(),tier:TrainingTier='STANDARD')",
    "function trainingQuote(e,now=Date.now(),tier='STANDARD')")
  .replace('const priceFor=(kind:TrainingTier)=>','const priceFor=(kind)=>');
 return new Function('const LATE_WINDOW_MS=48*60*60*1000;const TRAINING_BASE_PRICES='+rates[1]+';\n'
  +code+'\nreturn trainingQuote;')();
}
const quote=loadQuote();
const event={
 event_id:'PUB-HEMA-20261116',community:'Družina Moravy',category:'HEMA Training',
 price_czk:240,begins_at:'2026-11-16T17:00:00Z',
 is_open:true,source_active:true,price_verified:true,end_time_verified:true,registration_mode:'FORM',
 training_price_scheme:'INDIVIDUAL',training_payment_open:true,
 training_quote_locked_at:'2026-11-13T09:00:00Z',
 training_operational_go_at:'2026-11-13T09:00:00Z',
 training_payment_recipient:'Verified association for test',training_payment_account:'TEST-ACCOUNT-PLACEHOLDER'
};
const begins=Date.parse(event.begins_at);
test('9 November tariff replaces withdrawn group formula',()=>{
 const regular=quote(event,begins-72*3600000);
 assert.equal(regular.status,'PAYMENT_OPEN');
 assert.equal(regular.totalCzk,240);
 assert.equal(regular.tariffVersion,'DRU-20261109');
 assert.equal(quote(event,begins-72*3600000,'SENIOR').totalCzk,120);
 assert.equal(quote(event,begins-72*3600000,'STARTER4').totalCzk,800);
 assert.ok(!edge.includes('1000+160'),'withdrawn group formula must be gone');
 assert.match(newSql,/training_price_scheme='INDIVIDUAL'/);
});
test('under 48h adds 25 percent to single session but not to Starter 4',()=>{
 for(const [tier,normal,late] of [['STANDARD',240,300],['SENIOR',120,150]]){
  assert.equal(quote(event,begins-48*3600000,tier).totalCzk,normal);
  const q=quote(event,begins-48*3600000+1,tier);
  assert.equal(q.totalCzk,late);
  assert.equal(q.surchargeCzk,late-normal);
  assert.equal(q.late48h,true);
 }
 assert.equal(quote(event,begins-48*3600000,'STARTER4').totalCzk,800);
 const starter=quote(event,begins-48*3600000+1,'STARTER4');
 assert.equal(starter.status,'TIER_UNAVAILABLE');
 assert.equal(starter.totalCzk,null);
 assert.equal(starter.proofRequired,false);
});
test('fail-closed: no paid checkout unless organiser gates and written terms verified',()=>{
 for(const x of [
   {...event,training_payment_open:false},{...event,training_operational_go_at:null},
   {...event,training_quote_locked_at:null},{...event,price_verified:false},
   {...event,is_open:false},{...event,source_active:false},
   {...event,training_payment_account:null}
 ]){
   const q=quote(x,begins-72*3600000);
   assert.equal(q.status,'AWAITING_SESSION_GO');
   assert.equal(q.proofRequired,false);
 }
 assert.equal(quote({...event,event_id:'PUB-OREL-20261114',price_czk:0},begins-72*3600000),null);
 assert.equal(quote({...event,event_id:'PUB-HEMA-20261109',training_price_scheme:'LEGACY'},begins-72*3600000),null);
 assert.ok(oldSql.includes("'imperion-training-payment-proofs',false"));
});
test('PDF evidence is consented, private, one-time, non-verifying, eligibility protected',()=>{
 for(const needle of [
 "payment_resume_token_hash","crypto.getRandomValues","await tokenHash(resumeToken)",
 ".eq('payment_resume_token_hash',hashed)","'PROOF_RECEIVED'",
 "body.quotedTotalCzk!==quote!.totalCzk","body.quotedTier!==chosenTier",
 "body.tariffVersion!==TRAINING_TARIFF_VERSION","pdfInfo(proof)",
 "new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'",
 "matched.data.training_requested_tier!==chosenTier",
 "matched.data.training_authorized_tier!==chosenTier",
 ".is('payment_pdf_path',null)","payment_crm_synced_at:null",
 "bankVerified:false"
 ])assert.ok(edge.includes(needle),needle);
 assert.ok(!edge.includes("bank_verified_at:new Date()"),'upload cannot mean cleared funds');
 assert.ok(newSql.includes("training_requested_tier"));
 assert.ok(newSql.includes("training_authorized_tier"));
});
test('one common multilingual form, current tiers and quote-fed total',()=>{
 new Function(browser);
 for(const path of paths){
  const html=fs.readFileSync(path,'utf8');
  for(const id of ['trainingPayment','trainingTier','paymentResumeToken','paymentProof','eventId','rsvpForm'])
   assert.ok(html.includes('id="'+id+'"'),path+' '+id);
  assert.match(html,/training-payment\.js/);
  assert.match(html,/quotedTier:tier\(\)/);
  assert.match(html,/paymentProofField/);
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/ig;let m,parsed=0;
  while((m=re.exec(html))!==null){
   if(/\b(src|type=['"]application\/ld\+json)/i.test(m[1])||!m[2].trim())continue;
   assert.doesNotThrow(()=>new Function(m[2]),path+' inline JS syntax');
   parsed++;
  }
  assert.ok(parsed>0,path+' inline JS not checked');
 }
});
test('proof updates existing CRM row, no duplicate and no forged bank status',()=>{
 for(const needle of [
  'payment_crm_synced_at.is.null','payment_evidence_status.eq.PROOF_RECEIVED',
  'impUpdateExistingRsvpProof_','Quoted_Total_CZK','Payment_Evidence_Status',
  'Training_Requested_Tier','Training_Authorized_Tier','Quoted_Tier'
 ])assert.ok((bridge+crm).includes(needle),needle);
 assert.ok(!bridge.includes('payment_pdf_path')&&!bridge.includes('payment_pdf_sha256'));
 assert.ok(crm.includes('Payment_Status:paymentStatus'));
});
test('private Storage cleanup uses Storage API and no public access',()=>{
 assert.ok(clean.includes(".storage.from(BUCKET).list("));
 assert.ok(clean.includes(".storage.from(BUCKET).remove("));
 assert.ok(clean.includes("verify_imperion_intake_bridge_token"));
 assert.ok(!clean.includes("api.schema('storage')"));
 assert.ok(!clean.includes("getPublicUrl("));
});
