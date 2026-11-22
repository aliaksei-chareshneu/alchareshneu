'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const edge=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
const ui=fs.readFileSync('register/training-payment.js','utf8');
const crm=fs.readFileSync('imperion-intake-sync.gs','utf8');
const bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const legacy=fs.readFileSync('druzina/prihlaska/index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20261109_druzina_restore_individual_rates.sql','utf8');
const pages=['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html'];
function loadPrices(){
 const start=edge.indexOf('const TRAINING_TIER_PRICE_CZK:'),end=edge.indexOf('async function readSmallMultipart',start);
 assert.ok(start>0&&end>start,'isolated server pricing function');
 const code=edge.slice(start,end)
  .replace('const TRAINING_TIER_PRICE_CZK:Record<TrainingTier,number>','const TRAINING_TIER_PRICE_CZK')
  .replace("function trainingQuote(e:TrainingEvent,tier:TrainingTier='STANDARD'","function trainingQuote(e,tier='STANDARD'")
  .replace('function publicTrainingQuote(e:TrainingEvent)','function publicTrainingQuote(e)')
  .replace("(['STANDARD','SENIOR','STARTER4'] as TrainingTier[])","['STANDARD','SENIOR','STARTER4']")
  .replace('trainingQuote(e,t)!','trainingQuote(e,t)');
 return new Function('const LATE_WINDOW_MS=48*60*60*1000;\n'+code+'\nreturn {trainingQuote,publicTrainingQuote};')();
}
const {trainingQuote,publicTrainingQuote}=loadPrices();
const event={
 event_id:'PUB-HEMA-20261116',community:'Družina Moravy',category:'HEMA Training',
 price_czk:240,begins_at:'2026-11-16T17:00:00Z',is_open:true,source_active:true,
 price_verified:true,end_time_verified:true,registration_mode:'FORM',
 training_price_scheme:'INDIVIDUAL',training_payment_open:true,
 training_quote_locked_at:'2026-11-14T10:00:00Z',
 training_operational_go_at:'2026-11-14T10:00:00Z',
 training_payment_recipient:'Verified association (fixture only)',training_payment_account:'verified-bank-placeholder'
};
const t0=Date.parse(event.begins_at);
test('current 9 Nov product prices and 25% strictly inside T-48h',()=>{
 for(const [tier,base,late] of [['STANDARD',240,300],['SENIOR',120,150],['STARTER4',800,1000]]){
   const q=trainingQuote(event,tier,t0-48*3600000);
   assert.equal(q.baseCzk,base);assert.equal(q.surchargeCzk,0);assert.equal(q.totalCzk,base);
   assert.equal(q.late48h,false);
   const l=trainingQuote(event,tier,t0-48*3600000+1);
   assert.equal(l.late48h,true);assert.equal(l.totalCzk,late);
   assert.equal(l.surchargeCzk,Math.ceil(base*0.25));
 }
});
test('free Orel and legacy commitments must never be presented as payable',()=>{
 assert.equal(trainingQuote({...event,event_id:'PUB-OREL-20261114',price_czk:0}),null);
 assert.equal(trainingQuote({...event,training_price_scheme:'LEGACY'}),null);
 assert.equal(trainingQuote({...event,price_czk:0}),null);
 assert.equal(trainingQuote({...event,training_payment_open:false}).status,'AWAITING_ORGANIZER_GO');
 assert.equal(trainingQuote({...event,training_operational_go_at:null}).status,'AWAITING_ORGANIZER_GO');
 assert.equal(trainingQuote({...event,training_payment_recipient:null}).status,'AWAITING_ORGANIZER_GO');
 assert.equal(trainingQuote({...event,is_open:false}).sessionPaymentOpen,false);
});
test('public catalogue cannot expose banking details or present approved seat',()=>{
 const q=publicTrainingQuote(event);
 assert.equal(q.tiers.length,3);
 assert.deepEqual(q.tiers.map(x=>x.baseCzk),[240,120,800]);
 assert.equal(q.requiresPersonalConfirmation,true);
 assert.equal(q.proofRequired,false);
 assert.ok(!JSON.stringify(q).includes('verified-bank-placeholder'));
 assert.equal(trainingQuote(event,'SENIOR',t0-72*3600000,false).account,null);
 assert.equal(trainingQuote(event,'SENIOR',t0-72*3600000,true).account,'verified-bank-placeholder');
});
test('the resume code enforces server-side tier approval and no duplicate intake',()=>{
 for(const needle of ['training_authorized_at','training_requested_tier','training_authorized_tier',
  "savedTier!==trainingTier","if(!approved)return reply({error:'personal_confirmation_pending'}",
  "if(action==='quote')","payment_resume_token_hash","quoted_tier:savedTier",
  "body.quotedTotalCzk!==verifiedQuote.totalCzk","body.quotedTier!==savedTier",
  ".eq('payment_evidence_status','NOT_REQUIRED').is('payment_pdf_path',null)",
  "payment_resume_token_hash:null","payment_crm_synced_at:null",
  "paymentEvidenceStatus:'PROOF_RECEIVED',bankVerified:false",
  "verifiedQuote=isOsVc?osvcQuote(event,registrationMs,true):trainingQuote(event,savedTier,registrationMs,true)",
  ".select('id,created_at,training_requested_tier",
  "Date.now()>=Date.parse(event.begins_at)"]){
  assert.ok(edge.includes(needle),needle);
 }
 assert.ok(edge.includes("new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'"));
 assert.ok(!edge.includes('bank_verified_at:new Date()'));
});
test('one canonical form on all locales, including quote verification before PDF',()=>{
 assert.doesNotThrow(()=>new Function(ui));
 const sources=[];
 for(const path of pages){
  const html=fs.readFileSync(path,'utf8');
  for(const id of ['rsvpForm','trainingPayment','trainingTier','paymentResumeToken',
    'paymentQuoteButton','paymentProof','trainingPaymentPrivate','safety']){
   assert.ok(html.includes('id="'+id+'"'),path+': '+id);
  }
  assert.ok(html.includes('training-payment.js'));
  const app=html.match(/<script>\s*('use strict';[\s\S]*?)\s*<\/script>/);
  assert.ok(app,path+': app code');new Function(app[1]);sources.push(app[1]);
 }
 for(const item of sources)assert.equal(item,sources[0],'four-language script drift');
 assert.ok(ui.includes('privateQuote='));
 assert.ok(ui.includes("action:'quote'"));
 assert.ok(ui.includes("data.append('paymentProof'"));
 assert.ok(legacy.includes('window.location.replace(target.href)'));
 assert.ok(!legacy.includes('<form '));
});
test('the existing CRM is updated in place; PDF files stay outside public Sheets',()=>{
 for(const k of ['impUpdateExistingRsvpProof_','Payment_Evidence_Status',
  'Quoted_Total_CZK','impEnsureRsvpPaymentCols_','payment_crm_synced_at']){
  assert.ok((crm+bridge).includes(k),k);
 }
 assert.ok(!bridge.includes('payment_pdf_path')&&!bridge.includes('payment_pdf_sha256'));
 assert.ok(migration.includes("'INDIVIDUAL'")&&migration.includes('training_authorized_at'));
});
test('private receipt cleanup is controlled, not public file listing',()=>{
 const source=fs.readFileSync('supabase/functions/imperion-training-proof-retention/index.ts','utf8');
 assert.ok(source.includes('verify_imperion_intake_bridge_token'));
 assert.ok(source.includes('.storage.from(item.name).list(')&&source.includes('imperion-training-payment-proofs'));
 assert.ok(source.includes('.storage.from(item.name).remove(')&&source.includes('imperion-academy-payment-proofs'));
 assert.ok(!source.includes('getPublicUrl('));
});

test('Starter4 cannot be charged through a one-event RSVP without a package ledger',()=>{
 assert.ok(edge.includes("if(!isOsVc&&savedTier==='STARTER4')return reply({error:'package_checkout_requires_plan_authorization'}"));
});
test('QR Platba instruction is unique, amount-locked, and cannot substitute bank readback',async()=>{
 const path=require('node:path'),{pathToFileURL}=require('node:url');
 const qr=await import(pathToFileURL(path.resolve('supabase/functions/imperion-register/training-qr.mjs')).href);
 const domestic='19-2000145399/0800',iban='CZ6508000000192000145399';
 assert.equal(qr.domesticIban(domestic),iban);
 assert.equal(qr.domesticIban(iban),iban);
 assert.equal(qr.domesticIban('CZ0008000000192000145399'),null);
 assert.equal(qr.verifiedBankIban(domestic,'Fixture Association',iban,'Fixture Association'),iban);
 assert.equal(qr.verifiedBankIban(domestic,'Wrong Merchant',iban,'Fixture Association'),null);
 assert.equal(qr.verifiedBankIban(domestic,'Fixture Association',null,'Fixture Association'),null);
 assert.equal(qr.verifiedBankIban(domestic,'Fixture Association',iban,null),null);
 const one='11111111-1111-4111-8111-111111111111';
 const two='22222222-2222-4222-8222-222222222222';
 const spd=qr.createTrainingSpd(iban,240,one);
 assert.match(spd,/^SPD\*1\.0\*ACC:CZ6508000000192000145399\*AM:240\.00\*CC:CZK\*MSG:DM /);
 assert.ok(spd.includes(one.replace(/-/g,'').toUpperCase()));
 assert.notEqual(spd,qr.createTrainingSpd(iban,240,two));
 assert.equal(qr.createTrainingSpd(iban,0,one),null);
 assert.equal(qr.createTrainingSpd(iban,240,'not-a-uuid'),null);
 for(const check of ["Deno.env.get('OSVC_APPROVED_IBAN')","Deno.env.get('DRUZINA_APPROVED_IBAN')",
  "Deno.env.get('OSVC_APPROVED_PAYEE')","Deno.env.get('DRUZINA_APPROVED_PAYEE')",
  "if(!spd)return reply({error:'approved_bank_not_configured'}","paymentReference:lookup.data.id,variableSymbol:vs,spd"])assert.ok(edge.includes(check),check);
 assert.ok(!edge.includes('2703598853/2010'),'verified real bank account must not be hardcoded in public code');
 for(const page of pages){
  const html=fs.readFileSync(page,'utf8');
  assert.ok(html.includes('id="paymentQrArea"')&&html.includes('vendor/qrcode.min.js'),page);
 }
 assert.ok(ui.includes('renderApprovedQr')&&ui.includes('window.QRCode'));
 const vendor=fs.readFileSync('register/vendor/qrcode.min.js','utf8');
 const license=fs.readFileSync('register/vendor/LICENSE-qrcodejs.txt','utf8');
 assert.ok(vendor.includes('QRCode')&&license.includes('MIT License'));
});

test('already-transferred PDF is private, manually reviewed, and excluded from bank automation',()=>{
 for(const part of ["if(action==='manual_proof'){",
   "if(isOsVc||!training||!proof)return reply({error:'payment_not_open'}",
   "payment_pdf_review_status:'NEEDS_MANUAL_REVIEW'",
   "payment_pdf_review_flags:['NO_APPROVED_PAYMENT_QUOTE','RECIPIENT_SELF_REPORTED_'+proofRecipient]",
   "payment_bank_check_after:null",
   "payment_resume_token_hash:null,payment_crm_synced_at:null",
   "paymentNotApproved:true,bankVerified:false",
   ".eq('payment_resume_token_hash',hashed)"]) assert.ok(edge.includes(part),part);
 assert.ok(ui.includes("async function uploadManualProof"));
 assert.ok(ui.includes("action:'manual_proof'"));
 assert.ok(edge.includes("const manualBucket=proofRecipient==='OSVC'?OSVC_PROOF_BUCKET:PROOF_BUCKET"));
 assert.ok(edge.includes("proofRecipient=safeEnum(body.proofRecipient,['OSVC','DRUZINA'])"));
 assert.ok(ui.includes('proofRecipient:'));

 for(const path of pages){
  const html=fs.readFileSync(path,'utf8');
  assert.ok(html.includes('uploadManualProof('),path);
 }
});
