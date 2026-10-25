'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const names=['DruzinaBillingPolicy.gs','DruzinaFioBridge.gs','DruzinaFioProofReconcile.gs'];
function setup(){
 const ctx=vm.createContext({});
 names.forEach(name=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),ctx));
 const id='P-001',reference='1234567890',txId='1000000009',submission='2026-10-24T13:00:00Z';
 const payment={Payment_ID:id,Member_ID:'M-1',Verification_Status:'PROOF_SUBMITTED',
  Payment_Reference:reference,Amount_CZK:240,Expected_Amount_CZK:240,
  Source_Request_ID:'Q-001',Declared_At:submission,Policy_Version:'DRU-2026-11-v2',
  Reconciliation_Note:'Awaiting actual bank reconciliation'};
 const quote={Quote_ID:'Q-001',Member_ID:'M-1',Status:'COMMITTED',
  Payment_Reference:reference,Expected_Amount_CZK:240,Expires_At:'2026-10-24T13:20:00Z'};
 const b={Booking_ID:'B-01',Member_ID:'M-1',Payment_ID:id,
  Session_ID:'SES-20261116',Status:'PROVISIONAL_CONFIRMED',Proof_Required:true};
 const gate={Session_ID:b.Session_ID,Slot_State:'CONFIRMED',
  Venue_Permission_Verified:'VERIFIED',Instructor_Verified:'VERIFIED',
  Activity_Insurance_Verified:'VERIFIED',Equipment_Check:'VERIFIED',
  Participant_Safety_Form_Valid:'VERIFIED',Guardian_Gate_If_Minors:'VERIFIED',
  BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:4,Publish_Confirmed_Only:'YES'};
 const data={payments:[payment],quotes:[quote],bookings:[b],
  Druzina_Training_Capacity_Gate:[gate]};
 const flags={DRU_FIO_READONLY_CONFIRMED:'YES',DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'YES',
   DRU_PAID_BOOKING_APPROVED:'YES',DRU_LEGAL_SELLER_CONFIRMED:'YES',
   DRU_FIO_AUTOMATION_ENABLED:'YES',DRU_FIO_ACCOUNT_ID:'123456789',
   DRU_FIO_BANK_ID:'2010',ADMIN_TOKEN:'admin-private-only'};
 ctx.SHEETS={PAYMENTS:'payments',QUOTES:'quotes',BOOKINGS:'bookings'};
 ctx.PropertiesService={getScriptProperties:()=>({getProperty:key=>flags[key]||''})};
 ctx.rows_=key=>data[key]||[];ctx.findOne_=(key,pred)=>(data[key]||[]).find(pred)||null;
 ctx.findAll_=(key,pred)=>(data[key]||[]).filter(pred);
 ctx.withLock_=fn=>fn();
 ctx.configMap_=()=>({SAFETY_FORM_VERSION:'v2',RULES_VERSION:'v2'});
 let calls=0;ctx.reconcilePayment=payload=>{
   calls++;
   assert.equal(payload.adminToken,flags.ADMIN_TOKEN);
   assert.equal(payload.paymentId,id);
   data.payments[0].Verification_Status=payload.status;
   data.payments[0].Reconciliation_Note=payload.note;
   data.bookings[0].Status='VERIFIED';
   return {ok:true};
 };
 const movement={transactionId:txId,variableSymbol:reference,amountCZK:240,
  amountHalers:24000,accountKey:'123456789/2010',
  tokenAccountVerified:true,currency:'CZK',direction:'CREDIT',isReversal:false};
 return {ctx,payment,quote,b,gate,movement,flags,data,getCalls:()=>calls};
}
test('Fio proof submitted before T-48 and bank clearing later verifies same booking without 25% debt',()=>{
 const {ctx,data,quote,movement,getCalls}=setup();
 assert.ok(new Date(quote.Expires_At).getTime()<Date.now()); // hold long expired
 const r=ctx.drupReconcileExistingProof_(movement);
 assert.equal(r.ok,true);
 assert.equal(r.code,'PAYMENT_VERIFIED_NO_DUPLICATE_BOOKING');
 assert.equal(r.existingBookingCount,1);
 assert.equal(getCalls(),1);
 assert.equal(data.payments.length,1);
 assert.equal(data.bookings.length,1);
 assert.equal(data.bookings[0].Status,'VERIFIED');
 assert.equal(data.payments[0].Verification_Status,'VERIFIED');
 assert.match(data.payments[0].Reconciliation_Note,/FIO_SETTLED_ID=1000000009/);
 const twice=ctx.drupReconcileExistingProof_(movement);
 assert.equal(twice.ok,false);
 assert.equal(getCalls(),1);
});
test('Wrong bank amount, payee, token permission or VS can never verify proof',()=>{
 const {ctx,movement,getCalls}=setup();
 const wrong=[
  {...movement,amountHalers:12000,amountCZK:120},
  {...movement,accountKey:'999/2010'},
  {...movement,variableSymbol:'0000000001'},
  {...movement,tokenAccountVerified:false},
  {...movement,isReversal:true},
 ];
 for(const m of wrong){
   const r=ctx.drupReconcileExistingProof_(m);
   assert.equal(r.ok,false,JSON.stringify(r));
 }
 assert.equal(getCalls(),0);
});
test('Unverified per-date safety cancels automated confirmation and preserves provisional record',()=>{
 const {ctx,gate,movement,data,getCalls}=setup();
 gate.Venue_Permission_Verified='UNVERIFIED';
 assert.equal(ctx.drupReconcileExistingProof_(movement).code,'PER_DATE_SAFETY_GATE_UNVERIFIED');
 assert.equal(data.payments[0].Verification_Status,'PROOF_SUBMITTED');
 assert.equal(getCalls(),0);
});
test('No bank automation without separate explicit settlement and provider approvals',()=>{
 const {ctx,flags,movement,getCalls}=setup();
 flags.DRU_PAID_BOOKING_APPROVED='NO';
 assert.equal(ctx.drupReconcileExistingProof_(movement).code,'PAID_BOOKING_NOT_APPROVED');
 flags.DRU_PAID_BOOKING_APPROVED='YES';
 flags.DRU_FIO_AUTOMATION_ENABLED='NO';
 assert.equal(ctx.drupReconcileExistingProof_(movement).code,'RECONCILIATION_DISABLED');
 assert.equal(getCalls(),0);
});
test('Only original provisional member booking may be settled, not historical canceled or mismatched',()=>{
 const {ctx,payment,b,movement,getCalls}=setup();
 b.Status='CLUB_CANCELLED';
 assert.equal(ctx.drupReconcileExistingProof_(movement).code,'BOOKINGS_UNSAFE_OR_MISSING');
 b.Status='PROVISIONAL_CONFIRMED';
 payment.Member_ID='DIFFERENT';
 assert.equal(ctx.drupReconcileExistingProof_(movement).code,'PAYMENT_QUOTE_MISMATCH');
 assert.equal(getCalls(),0);
});
test('Same bank movement cannot be spent on a second payment even when new VS appears',()=>{
 const {ctx,data,movement,getCalls}=setup();
 data.payments.push({...data.payments[0],Payment_ID:'P-002',Payment_Reference:'9876543210',
  Source_Request_ID:'Q-002',Reconciliation_Note:'FIO_SETTLED_ID=1000000009'});
 assert.equal(ctx.drupReconcileExistingProof_(movement).code,'DUPLICATE_BANK_TRANSACTION');
 assert.equal(getCalls(),0);
});
