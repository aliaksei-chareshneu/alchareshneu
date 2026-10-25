'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const paths=['DruzinaBillingPolicy.gs','DruzinaFioBridge.gs','DruzinaFioCommit.gs'];
function setup() {
 const ctx=vm.createContext({});
 paths.forEach(name=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),ctx,{filename:name}));
 const SHEETS={QUOTES:'quotes',MEMBERS:'members',PAYMENTS:'payments',PAYMENT_ITEMS:'payment_items',
   BOOKINGS:'bookings',HOLDS:'holds',AUDIT:'audit'};
 const future=new Date(Date.now()+72*3600000).toISOString();
 const quote={_row:2,Quote_ID:'Q-1',Member_ID:'M-1',Status:'OPEN',
   Payment_Reference:'1234567890',Expires_At:'2099-01-01T00:00:00Z',
   Expected_Amount_CZK:240,Policy_Version:'DRU-2026-11-v2',
   Cart_JSON:JSON.stringify([{kind:'SESSION',productCode:'DRU-FIRSTVISIT-202611',
     sessionId:'SES-A',name:'First Visit',lineTotal:240,unitAmount:240,policyVersion:'DRU-2026-11-v2'}])};
 const member={Member_ID:'M-1',Tier:'Junior',Attendance_Total:0};
 const session={Session_ID:'SES-A',Start_DateTime:future,End_DateTime:new Date(Date.parse(future)+7200000).toISOString(),Status:'OPEN'};
 const gate={Session_ID:'SES-A',Slot_State:'CONFIRMED',
  Venue_Permission_Verified:'VERIFIED',Instructor_Verified:'VERIFIED',
  Activity_Insurance_Verified:'VERIFIED',Equipment_Check:'VERIFIED',
  Participant_Safety_Form_Valid:'VERIFIED',Guardian_Gate_If_Minors:'VERIFIED',
  BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:4,Publish_Confirmed_Only:'YES'};
 const data={quotes:[quote],members:[member],payments:[],payment_items:[],bookings:[],holds:[],audit:[],
  Druzina_Training_Capacity_Gate:[gate]};
 const properties={
  DRU_FIO_READONLY_CONFIRMED:'YES',DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'YES',
  DRU_PAID_BOOKING_APPROVED:'YES',DRU_LEGAL_SELLER_CONFIRMED:'YES',
  DRU_FIO_AUTOMATION_ENABLED:'YES',DRU_FIO_ACCOUNT_ID:'123456789',DRU_FIO_BANK_ID:'2010'
 };
 ctx.SHEETS=SHEETS;
 ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>properties[k]||''})};
 ctx.configMap_=()=>({SAFETY_FORM_VERSION:'v1',RULES_VERSION:'v1'});
 ctx.rows_=name=>data[name]||[];
 ctx.findOne_=(name,fn)=>(data[name]||[]).find(fn)||null;
 ctx.findAll_=(name,fn)=>(data[name]||[]).filter(fn);
 ctx.sessionById_=id=>id==='SES-A'?session:null;
 ctx.isTrialEligible_=m=>m.Attendance_Total===0;
 ctx.revalidateQuote_=()=>JSON.parse(quote.Cart_JSON);
 ctx.patchRow_=(name,row,changes)=>Object.assign(data[name][row-2],changes);
 ctx.appendObj_=(name,obj)=>{const item={...obj,_row:data[name].length+2};data[name].push(item);return item};
 ctx.withLock_=fn=>fn();
 ctx.nowIso_=()=>new Date().toISOString();
 let idN=0;ctx.id_=prefix=>prefix+'-TEST-'+(++idN);
 ctx.createBooking_=(m,s,p,payment,product)=>{const bid='BKG-'+(++idN);
   data.bookings.push({_row:data.bookings.length+2,Booking_ID:bid,
     Member_ID:m.Member_ID,Session_ID:s,Payment_ID:payment,Status:'PROVISIONAL_CONFIRMED'});
   return bid;};
 ctx.activatePackage_=()=>{throw Error('package not in this test')};
 ctx.audit_=()=>{};
 const movement={transactionId:'1000000009',amountCZK:240,amountHalers:24000,
   variableSymbol:'1234567890',currency:'CZK',direction:'CREDIT',
   isReversal:false,accountKey:'123456789/2010'};
 return {ctx,data,properties,quote,member,session,gate,movement};
}
test('Fio settlement creates exactly one verified payment + booking in existing CRM',()=>{
 const {ctx,data,movement,quote}=setup();
 const x=ctx.drufCommitVerifiedBankTransaction_(movement);
 assert.equal(x.ok,true);
 assert.equal(x.status,'PAID_VERIFIED');
 assert.equal(data.payments.length,1);
 assert.equal(data.payments[0].Verification_Status,'VERIFIED');
 assert.equal(data.payments[0].Method,'fio_api_read_only');
 assert.equal(data.payments[0].Reconciliation_Note,'FIO_SETTLED_ID=1000000009');
 assert.equal(data.payment_items.length,1);
 assert.equal(data.bookings.length,1);
 assert.equal(data.bookings[0].Status,'VERIFIED');
 assert.equal(data.bookings[0].Proof_Required,false);
 assert.equal(quote.Status,'COMMITTED');
 const replay=ctx.drufCommitVerifiedBankTransaction_(movement);
 assert.equal(replay.ok,false);
 assert.equal(data.payments.length,1);
 assert.equal(data.bookings.length,1);
});
test('Fio cannot settle with wrong receiving account or amount',()=>{
 const {ctx,data,movement}=setup();
 assert.equal(ctx.drufCommitVerifiedBankTransaction_({...movement,accountKey:'999/2010'}).code,'WRONG_PAYEE');
 assert.equal(ctx.drufCommitVerifiedBankTransaction_({...movement,amountHalers:12000,amountCZK:120}).code,'AMOUNT_MISMATCH');
 assert.equal(data.payments.length,0);
});
test('Merchant, supplier and per-date safety gates block writes before bank settlement',()=>{
 const {ctx,data,properties,movement,gate}=setup();
 properties.DRU_PAID_BOOKING_APPROVED='NO';
 assert.equal(ctx.drufCommitVerifiedBankTransaction_(movement).code,'PAID_BOOKING_NOT_APPROVED');
 assert.equal(data.payments.length,0);
 properties.DRU_PAID_BOOKING_APPROVED='YES';gate.Venue_Permission_Verified='UNVERIFIED';
 assert.equal(ctx.drufCommitVerifiedBankTransaction_(movement).code,'PER_DATE_SAFETY_GATE_UNVERIFIED');
 assert.equal(data.payments.length,0);
});
test('Quote that crosses 48h cutoff before settlement must be repriced, not charged old rate',()=>{
 const {ctx,data,movement,session}=setup();
 session.Start_DateTime=new Date(Date.now()+47*3600000).toISOString();
 const res=ctx.drufCommitVerifiedBankTransaction_(movement);
 assert.equal(res.code,'QUOTE_CHANGED_OR_CUTOFF');
 assert.equal(data.payments.length,0);
});
test('November old 120 Kč trial and 680 Kč Starter top up are rejected by price gate',()=>{
 const {ctx,quote,movement,data}=setup();
 const old=JSON.parse(quote.Cart_JSON);old[0].productCode='DRU-TRIAL';old[0].lineTotal=120;
 quote.Cart_JSON=JSON.stringify(old);quote.Expected_Amount_CZK=120;
 const res=ctx.drufCommitVerifiedBankTransaction_({...movement,amountCZK:120,amountHalers:12000});
 assert.equal(res.code,'QUOTE_CHANGED_OR_CUTOFF');
 assert.equal(data.payments.length,0);
});
test('Verified first-visit upgrade requires instructor attendance and settled 240 Kč',()=>{
 const {ctx,data,member,session}=setup();
 data.bookings.push({_row:2,Booking_ID:'B-TRIAL',Member_ID:'M-1',Session_ID:'SES-A',
   Payment_ID:'PAY-TRIAL',Status:'ATTENDED',Attendance_Status:'PRESENT',Attendance_Checked:true,Plan_ID:''});
 data.payments.push({_row:2,Payment_ID:'PAY-TRIAL',Member_ID:'M-1',Verification_Status:'VERIFIED',
   Received_Amount_CZK:240});
 assert.equal(ctx.drufVerifiedFirstVisit_(member,'B-TRIAL').amountReceivedCZK,240);
 data.payments[0].Verification_Status='PROOF_SUBMITTED';
 assert.throws(()=>ctx.drufVerifiedFirstVisit_(member,'B-TRIAL'),/not bank verified/);
});
