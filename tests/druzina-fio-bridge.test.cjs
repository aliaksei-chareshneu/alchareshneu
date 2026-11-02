'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../DruzinaFioBridge.gs'),'utf8');
const env=vm.createContext({});vm.runInContext(source,env,{filename:'DruzinaFioBridge.gs'});
// Positive fixtures simulate a future separately reviewed code release.
vm.runInContext('const DRUS_PAID_BANK_ADAPTER_LIVE=true;',env);
env.drusPaidRelease_=()=>({ok:true});
const {drufVS,drufNumericVS,drufMoneyHalers,drufParseFioJSON,drufBankMatch,drufCanLaunch}=env;
const account={accountId:'123456789',bankId:'2010'};
const doc=(tx)=>({accountStatement:{info:{...account,currency:'CZK'},
  transactionList:{transaction:tx}}});
const transaction=(id='1234567890',amount='300',vs='1234567890',extra={})=>({
  column22:{value:id},column1:{value:amount},column5:{value:vs},
  column14:{value:'CZK'},column8:{value:'Okamžitá příchozí platba'},...extra
});
test('Fio official JSON mapping uses Column22 ID, Column1 amount, Column5 VS, Column14 currency',()=>{
 const p=drufParseFioJSON(doc([transaction()]),account);
 assert.equal(p.ok,true);
 assert.equal(p.transactions.length,1);
 assert.equal(p.transactions[0].transactionId,'1234567890');
 assert.equal(p.transactions[0].amountHalers,30000);
 assert.equal(p.transactions[0].variableSymbol,'1234567890');
 assert.equal(p.accountKey,'123456789/2010');
});
test('Fio bank parser never accepts wrong payee/account/bank/currency',()=>{
 assert.equal(drufParseFioJSON(doc([transaction()]),{...account,accountId:'999'}).code,'WRONG_FIO_SETTLEMENT_ACCOUNT');
 assert.equal(drufParseFioJSON(doc([transaction()]),{...account,bankId:'0800'}).code,'WRONG_FIO_SETTLEMENT_ACCOUNT');
 assert.equal(drufParseFioJSON({...doc([]),accountStatement:{info:{...account,currency:'EUR'},transactionList:{transaction:[]}}},account).ok,false);
});
test('Exclude outgoing, corrections, wrong currencies, invalid vs and duplicate bank IDs',()=>{
 const txs=[
  transaction('1000000001','300','000123'),
  transaction('1000000001','300','000123'),
  transaction('1000000002','-240','1234567890'),
  transaction('1000000003','200','1234567890',{column8:{value:'Opravný pohyb'}}),
  transaction('1000000004','200','1234567890',{column14:{value:'EUR'}}),
  transaction('1000000005','200','DRU-ABC'),
  transaction('1000000006','200.01','1234567890')
 ];
 const p=drufParseFioJSON(doc(txs),account);
 assert.equal(p.ok,true);
 assert.equal(p.count,2); // 300 CZK and 200.01 CZK; matching rejects cents.
 assert.equal(p.transactions[0].variableSymbol,'123');
 assert.equal(p.transactions[1].amountHalers,20001);
});
test('Fio amount decimal parser preserves halers with no floating point money',()=>{
 assert.equal(drufMoneyHalers(' 300.00 '),30000);
 assert.equal(drufMoneyHalers('200,10'),20010);
 assert.equal(drufMoneyHalers('-50.23'),-5023);
 assert.equal(drufMoneyHalers('120.001'),null);
 assert.equal(drufMoneyHalers('abc'),null);
});
test('Old alphanumeric payment references cannot be matched as VS',()=>{
 assert.equal(drufVS('DRU1025ABCDE'),'');
 assert.equal(drufVS('0123456789'),'123456789');
 assert.equal(drufVS('12345678900'),'');
});
test('Unique numeric VS generator checks all existing quote/payment refs',()=>{
 const n=drufNumericVS(['1000000000','1000000001'],(()=>{
  const candidates=[0,1/9000000000,0.5];let i=0;return ()=>candidates[i++];
 })());
 assert.equal(n,'5500000000');
 assert.match(n,/^\d{10}$/);
 assert.throws(()=>drufNumericVS([],()=>1),/random source invalid/);
});
const expected={Quote_ID:'QUOTE-1',Payment_Reference:'1234567890',
  Expected_Amount_CZK:300,Status:'OPEN',Expires_At:'2099-01-01T00:00:00Z'};
const move={transactionId:'1000000009',amountCZK:300,amountHalers:30000,
  variableSymbol:'1234567890',currency:'CZK',direction:'CREDIT',
  isReversal:false,accountKey:'123456789/2010'};
test('Strict bank match requires exact payee, decimal amount, VS and not duplicated',()=>{
 assert.equal(drufBankMatch(move,expected,'123456789/2010',[]).ok,true);
 assert.equal(drufBankMatch({...move,accountKey:'222/2010'},expected,'123456789/2010',[]).code,'WRONG_PAYEE');
 assert.equal(drufBankMatch({...move,variableSymbol:'1'},expected,'123456789/2010',[]).code,'VS_MISMATCH');
 assert.equal(drufBankMatch({...move,amountHalers:30001},expected,'123456789/2010',[]).code,'AMOUNT_MISMATCH');
 assert.equal(drufBankMatch({...move,amountCZK:299},expected,'123456789/2010',[]).code,'AMOUNT_MISMATCH');
 assert.equal(drufBankMatch({...move,amountCZK:300.001},expected,'123456789/2010',[]).code,'AMOUNT_MISMATCH');
 assert.equal(drufBankMatch(move,expected,'123456789/2010',[move.transactionId]).code,'ALREADY_USED');
 assert.equal(drufBankMatch(move,{...expected,Status:'COMMITTED'},'123456789/2010',[]).code,'QUOTE_NOT_OPEN');
 assert.equal(drufBankMatch(move,{...expected,Expires_At:'2026-10-22T00:00:00Z'},'123456789/2010',[]).code,'QUOTE_EXPIRED');
 assert.equal(drufBankMatch(move,{...expected,Payment_Reference:'DRU-ABC'},'123456789/2010',[]).code,'LEGACY_NONNUMERIC_REFERENCE');
});
test('Fio preview requires owner identity, secure read-only token and never contacts API if absent',()=>{
 env.requireOwner_=()=>{};
 env.PropertiesService={getScriptProperties:()=>({getProperty:()=>''})};
 assert.equal(env.drufReadOnlyPreview().code,'FIO_READ_ONLY_CREDENTIALS_NOT_CONFIGURED');
 env.requireOwner_=()=>{throw Error('Unauthorized')};
 assert.throws(()=>env.drufReadOnlyPreview(),/Unauthorized/);
});
const gate={Slot_State:'CONFIRMED',Venue_Permission_Verified:'VERIFIED',
  Instructor_Verified:'VERIFIED',Activity_Insurance_Verified:'VERIFIED',
  Equipment_Check:'VERIFIED',Participant_Safety_Form_Valid:'VERIFIED',
  Guardian_Gate_If_Minors:'NOT_APPLICABLE',BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:4,
  Publish_Confirmed_Only:'YES',Newcomer_Ready:'YES',
  Evidence_Source:'signed date-specific organiser/venue proof',
  Reviewer_and_proof_of_100_TOTAL_not_ready:'date-specific checked',
  Max_Attendance_Checked:60,Staff_And_Marshals_Count:3,
  Other_Humans_Count_Parents_Spectators:2};
const flags={DRU_FIO_READONLY_CONFIRMED:'YES',
  DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'YES',DRU_PAID_BOOKING_APPROVED:'YES',
  DRU_LEGAL_SELLER_CONFIRMED:'YES'};
test('No live paid flow unless owner, beneficiary and each session gate is independently verified',()=>{
 const config={SAFETY_FORM_VERSION:'v1',RULES_VERSION:'v1'};
 assert.equal(drufCanLaunch(config,flags,[gate]).ok,true);
 assert.equal(drufCanLaunch(config,{...flags,DRU_PAID_BOOKING_APPROVED:'NO'},[gate]).code,'PAID_BOOKING_NOT_APPROVED');
 assert.equal(drufCanLaunch(config,{...flags,DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'NO'},[gate]).code,'BENEFICIARY_UNVERIFIED');
 assert.equal(drufCanLaunch(config,flags,[{...gate,Equipment_Check:'UNVERIFIED'}]).code,'PER_DATE_SAFETY_GATE_UNVERIFIED');
 assert.equal(drufCanLaunch(config,flags,[{...gate,BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:0}]).code,'PER_DATE_SAFETY_GATE_UNVERIFIED');
 assert.equal(drufCanLaunch({...config,SAFETY_FORM_VERSION:''},flags,[gate]).code,'SAFETY_CONSENTS_UNVERIFIED');
});


test('Fio settlement cannot exceed total 100 humans or bypass signed staffing, venue and guardian evidence',()=>{
 const config={SAFETY_FORM_VERSION:'v1',RULES_VERSION:'v1'};
 const pass=gate;
 assert.equal(drufCanLaunch(config,flags,[pass]).ok,true);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Guardian_Gate_If_Minors:'UNVERIFIED'}]).ok,false);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Newcomer_Ready:'NO'}]).ok,false);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Evidence_Source:''}]).ok,false);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Staff_And_Marshals_Count:''}]).ok,false);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Max_Attendance_Checked:101}]).ok,false);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Max_Attendance_Checked:100,
   Staff_And_Marshals_Count:10,Other_Humans_Count_Parents_Spectators:15,
   BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:76}]).ok,false);
 assert.equal(drufCanLaunch(config,flags,[{...pass,Max_Attendance_Checked:100,
   Staff_And_Marshals_Count:10,Other_Humans_Count_Parents_Spectators:15,
   BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:75}]).ok,true);
});

test('Public adapter remains fail-closed even if all bank and safety flags are YES',()=>{
  const paused=vm.createContext({});
  vm.runInContext(source,paused,{filename:'DruzinaFioBridge.gs'});
  paused.drusPaidRelease_=()=>({ok:true}); // absent explicit code-level release still blocks
  const cfg={SAFETY_FORM_VERSION:'v1',RULES_VERSION:'v1'};
  assert.equal(paused.drufCanLaunch(cfg,flags,[gate]).code,'CANONICAL_PAID_ADAPTER_DISABLED');
  const payee={iban:'CZ6508000000192000145399',verifiedLegalPayee:true,
    verifiedReadOnlyBankAccount:true,paidBookingLiveApproved:true};
  assert.equal(paused.drufBankInstructions(expected,payee).code,'CANONICAL_PAID_ADAPTER_DISABLED');
});
test('Bank payment instructions create local Czech QR string only for authorized payee',()=>{
  const iban='CZ6508000000192000145399';
  assert.equal(env.drufCzIbanValid(iban),true);
  assert.equal(env.drufCzIbanValid('CZ6508000000192000145398'),false);
  const merchant={iban,verifiedLegalPayee:true,
    verifiedReadOnlyBankAccount:true,paidBookingLiveApproved:true};
  const result=env.drufBankInstructions(expected,merchant);
  assert.equal(result.ok,true);
  assert.equal(result.spd,'SPD*1.0*ACC:'+iban+'*AM:300.00*CC:CZK*X-VS:1234567890');
  assert.equal(result.confirmedBooking,false);
  assert.equal(result.status,'PENDING_BANK_SETTLEMENT_NOT_PAID');
  assert.equal(env.drufBankInstructions(expected,{...merchant,verifiedLegalPayee:false}).code,
    'PAYMENT_BENEFICIARY_OR_LAUNCH_UNVERIFIED');
  assert.equal(env.drufBankInstructions({...expected,Payment_Reference:'DRU12345'},merchant).code,
    'INVALID_BANK_INSTRUCTIONS');
  assert.equal(env.drufBankInstructions({...expected,Expires_At:'2020-01-01'},merchant).code,
    'QUOTE_EXPIRED_OR_NOT_OPEN');
});
test('new numeric quote wrapper is fail-closed before old createQuote is ever called',()=>{
  let called=false;
  env.withLock_=fn=>fn();
  env.PropertiesService={getScriptProperties:()=>({getProperty:()=>''})};
  env.configMap_=()=>({SAFETY_FORM_VERSION:'',RULES_VERSION:''});
  env.rows_=()=>[];
  env.createQuote=()=>{called=true;throw Error('should not be reached')};
  assert.throws(()=>env.drufCreateQuoteWithVS_({
    items:[{sessionId:'SES-20261102',productCode:'DRU-JUNIOR-DROPIN'}]
  }),/not yet enabled/);
  assert.equal(called,false);
});
