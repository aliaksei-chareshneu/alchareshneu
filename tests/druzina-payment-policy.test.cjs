'use strict';
/* These tests run the exact Apps Script-compatible source without a live bank,
 * merchant, spreadsheet or calendar. No transactions are performed. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../DruzinaBillingPolicy.gs'),'utf8');
const env=vm.createContext({});
vm.runInContext(source,env,{filename:'DruzinaBillingPolicy.gs'});
const {drubQuoteItem,drubAuthorizeCheckout,drubMatchBankTransfer,drubWindow,drubPolicyDate}=env;
const event='2026-11-16T18:00:00+01:00';
const eventMs=Date.parse(event);
const atHours=h=>new Date(eventMs-h*3600000).toISOString();
const isoFrom=ms=>new Date(ms).toISOString();
const flex=(h,tier='JUNIOR',other={})=>drubQuoteItem({
  nowISO:atHours(h),sessionStartsAt:event,type:'FLEX',tier,
  existingMemberVerified:true,...other
});
const first=(h,other={})=>drubQuoteItem({
  nowISO:atHours(h),sessionStartsAt:event,type:'FIRST_VISIT',tier:'JUNIOR',
  firstVisitEligible:true,...other
});
const daysFrom=(n)=>isoFrom(eventMs+n*86400000);

test('Czech local date is used for new November pricing, including offset change',()=>{
  assert.equal(drubPolicyDate(Date.parse('2026-10-31T23:15:00Z')),'2026-11-01');
  assert.equal(drubPolicyDate(Date.parse('2026-10-31T22:15:00Z')),'2026-10-31');
});
test('normal rates follow the session date',()=>{
  assert.equal(flex(49,'JUNIOR').amountCZK,240);
  assert.equal(flex(49,'SENIOR').amountCZK,200);
  assert.equal(first(49).amountCZK,240);
});
test('late November means upfront +25% for single visit',()=>{
  assert.equal(flex(47,'JUNIOR').amountCZK,300);
  assert.equal(flex(47,'SENIOR').amountCZK,250);
  assert.equal(flex(48,'SENIOR').window,'LATE');
  assert.equal(flex(48,'JUNIOR').amountCZK,300);
});
test('emergency November means upfront +50%; exactly 3h is emergency',()=>{
  assert.equal(flex(2,'JUNIOR').amountCZK,360);
  assert.equal(flex(2,'SENIOR').amountCZK,300);
  assert.equal(flex(3,'SENIOR').window,'EMERGENCY');
  assert.equal(flex(3,'SENIOR').amountCZK,300);
});
test('portal closes by T-30m; never sell after start',()=>{
  assert.equal(flex(.5).code,'CLOSED_30M');
  assert.equal(flex(.3).ok,false);
  assert.equal(flex(-1).code,'CLOSED_30M');
});
test('new First Visit only before 48h, with eligibility evidence',()=>{
  assert.equal(first(48).code,'FIRST_VISIT_48H_REQUIRED');
  assert.equal(first(10).code,'FIRST_VISIT_48H_REQUIRED');
  assert.equal(first(49,{firstVisitEligible:false}).code,'FIRST_VISIT_NOT_ELIGIBLE');
  assert.equal(flex(49,'JUNIOR',{firstVisitEligible:true}).code,'FIRST_VISIT_REQUIRES_ONBOARDING');
});
test('emergency cannot onboard an unverified new member',()=>{
  assert.equal(flex(1,'JUNIOR',{existingMemberVerified:false}).code,
    'EMERGENCY_EXISTING_MEMBERS_ONLY');
});
test('October single-session prices remain unchanged for historic obligations',()=>{
  const s='2026-10-26T18:00:00+01:00';
  const before=h=>new Date(Date.parse(s)-h*3600000).toISOString();
  const quote=(h,tier)=>drubQuoteItem({nowISO:before(h),sessionStartsAt:s,
    type:'FLEX',tier,existingMemberVerified:true});
  assert.equal(quote(49,'SENIOR').amountCZK,120);
  assert.equal(quote(47,'SENIOR').amountCZK,150);
  assert.equal(quote(2,'SENIOR').amountCZK,180);
  assert.equal(quote(47,'JUNIOR').amountCZK,300);
  assert.equal(quote(2,'JUNIOR').amountCZK,360);
});
test('new Starter4 requires exactly four selected and eligible sessions',()=>{
  const selected=[event,daysFrom(4),daysFrom(7),daysFrom(11)];
  const q=drubQuoteItem({nowISO:atHours(60),sessionStartsAt:event,
    type:'STARTER4',tier:'JUNIOR',selectedSessions:selected});
  assert.equal(q.ok,true);
  assert.equal(q.amountCZK,800);
  assert.equal(q.sessionsPurchased,4);
  assert.equal(q.validityDays,30);
});
test('Starter4 never covers session inside 48h even if purchased earlier',()=>{
  const selected=[event,daysFrom(4),daysFrom(7),daysFrom(11)];
  const q=drubQuoteItem({nowISO:atHours(47),sessionStartsAt:event,
    type:'STARTER4',tier:'JUNIOR',selectedSessions:selected});
  assert.equal(q.code,'PACKAGE_SESSION_48H_REQUIRED');
});
test('package date must be ordered, unique, and inside 30 day validity',()=>{
  const input={nowISO:atHours(72),sessionStartsAt:event,type:'STARTER4',tier:'JUNIOR'};
  assert.equal(drubQuoteItem({...input,selectedSessions:[event,daysFrom(7),daysFrom(7),daysFrom(8)]}).code,
    'DUPLICATE_SESSION');
  assert.equal(drubQuoteItem({...input,selectedSessions:[event,daysFrom(7),daysFrom(5),daysFrom(8)]}).code,
    'SESSIONS_NOT_ORDERED');
  assert.equal(drubQuoteItem({...input,selectedSessions:[event,daysFrom(8),daysFrom(16),daysFrom(30)]}).code,
    'PACKAGE_OUTSIDE_30_DAYS');
});
test('Starter4 credit only for a paid, attended, timely and unconsumed 240 Kč visit',()=>{
  const attended=Date.parse('2026-11-10T18:00:00+01:00');
  const original={verified:true,paymentVerified:true,creditAlreadyUsed:false,
    sessionId:'DRU-SESSION-ONE',amountReceivedCZK:240,
    attendedAt:isoFrom(attended)};
  const base={nowISO:isoFrom(attended+25*3600000),sessionStartsAt:event,
    type:'STARTER4_UPGRADE',tier:'JUNIOR',
    selectedSessions:[event,daysFrom(4),daysFrom(7)]};
  const valid=drubQuoteItem({...base,verifiedFirstAttendance:original});
  assert.equal(valid.ok,true);
  assert.equal(valid.amountCZK,560);
  assert.equal(valid.creditedFirstVisit,true);
  assert.equal(valid.sessionsPurchased,4); // 1 already attended + 3 future.
  assert.equal(valid.validityFromISO,isoFrom(attended));
  assert.equal(drubQuoteItem({...base,verifiedFirstAttendance:{...original,creditAlreadyUsed:true}}).code,
    'UPGRADE_FIRST_VISIT_EVIDENCE_REQUIRED');
  assert.equal(drubQuoteItem({...base,verifiedFirstAttendance:{...original,paymentVerified:false}}).code,
    'UPGRADE_FIRST_VISIT_EVIDENCE_REQUIRED');
  assert.equal(drubQuoteItem({...base,nowISO:isoFrom(attended+49*3600000),
    verifiedFirstAttendance:original}).code,'UPGRADE_48H_AFTER_ATTENDANCE_REQUIRED');
});
test('bad timestamps and unrecognized products fail closed',()=>{
  assert.equal(drubQuoteItem({nowISO:'yesterday',sessionStartsAt:event,
    type:'FLEX',tier:'SENIOR'}).code,'INVALID_DATE');
  assert.equal(drubQuoteItem({nowISO:atHours(60),sessionStartsAt:event,
    type:'UNLIMITED_365',tier:'SENIOR'}).code,'INVALID_PRODUCT_OR_TIER');
  assert.equal(drubWindow(Date.now(),NaN),'CLOSED');
});
const gate={
  status:'CONFIRMED',venueWrittenPermission:true,safetyPlanVerified:true,
  instructorVerified:true,insuranceVerified:true,equipmentVerified:true,
  firstAidVerified:true,capacityWrittenVerified:true,remainingSafePlaces:12
};
const checkout={
  paymentLaunchApproved:true,legalSellerVerified:true,beneficiaryVerified:true,
  identityVerified:true,outstandingCZK:0,existingContractHonoured:true,
  eventGates:[gate]
};
test('pricing alone never enables paid booking',()=>{
  assert.equal(drubAuthorizeCheckout({...checkout,paymentLaunchApproved:false}).code,'PAID_BOOKING_DISABLED');
  assert.equal(drubAuthorizeCheckout({...checkout,beneficiaryVerified:false}).code,'BENEFICIARY_UNVERIFIED');
  assert.equal(drubAuthorizeCheckout({...checkout,legalSellerVerified:false}).code,'LEGAL_SELLER_UNVERIFIED');
  assert.equal(drubAuthorizeCheckout({...checkout,outstandingCZK:120}).code,'OUTSTANDING_OR_UNKNOWN_BALANCE');
  assert.equal(drubAuthorizeCheckout({...checkout,identityVerified:false}).code,'IDENTITY_UNVERIFIED');
  assert.equal(drubAuthorizeCheckout({...checkout,existingContractHonoured:false}).code,'LEGACY_RIGHTS_UNVERIFIED');
});
test('session-specific safety and minors guardian acceptance fail closed',()=>{
  assert.equal(drubAuthorizeCheckout({...checkout,eventGates:[{...gate,venueWrittenPermission:false}]}).code,
    'SESSION_SAFETY_OR_CAPACITY_UNCONFIRMED');
  assert.equal(drubAuthorizeCheckout({...checkout,eventGates:[{...gate,remainingSafePlaces:0}]}).code,
    'SESSION_SAFETY_OR_CAPACITY_UNCONFIRMED');
  assert.equal(drubAuthorizeCheckout({...checkout,isMinor:true,guardianConsentVerified:false}).code,
    'GUARDIAN_CONSENT_REQUIRED');
  assert.equal(drubAuthorizeCheckout({...checkout,eventGates:[gate]}).code,
    'GATES_PASSED_NOT_PAID');
});
const expected={
  payeeVerified:true,payeeAccountKey:'DruzinaMoravy_zs_fio_verified',
  paymentRef:'1234567890',amountCZK:300,status:'PENDING_PAYMENT'
};
const movement={
  tokenAccountVerified:true,accountKey:'DruzinaMoravy_zs_fio_verified',
  variableSymbol:'1234567890',currency:'CZK',direction:'CREDIT',
  amountCZK:300,transactionId:'FIO-TRX-12345',isReversal:false
};
test('Fio movement exact match permits idempotent server review, not auto booking',()=>{
  const match=drubMatchBankTransfer(movement,expected,[]);
  assert.equal(match.ok,true);
  assert.equal(match.code,'MATCHED_BANK_RECEIPT');
  assert.equal(match.amountCZK,300);
  assert.equal(drubMatchBankTransfer(movement,expected,[movement.transactionId]).code,'ALREADY_RECONCILED');
});
test('Fio wrong beneficiary, VS, amount, currency, or direction never pays',()=>{
  assert.equal(drubMatchBankTransfer({...movement,accountKey:'OSVC'},expected,[]).code,'WRONG_BENEFICIARY_ACCOUNT');
  assert.equal(drubMatchBankTransfer({...movement,variableSymbol:'43210'},expected,[]).code,'REFERENCE_MISMATCH');
  assert.equal(drubMatchBankTransfer({...movement,amountCZK:240},expected,[]).code,'AMOUNT_MISMATCH_REVIEW');
  assert.equal(drubMatchBankTransfer({...movement,amountCZK:320},expected,[]).code,'AMOUNT_MISMATCH_REVIEW');
  assert.equal(drubMatchBankTransfer({...movement,currency:'EUR'},expected,[]).code,'CURRENCY_MISMATCH');
  assert.equal(drubMatchBankTransfer({...movement,direction:'DEBIT'},expected,[]).code,'NOT_SETTLED_INCOMING');
  assert.equal(drubMatchBankTransfer({...movement,isReversal:true},expected,[]).code,'NOT_SETTLED_INCOMING');
  assert.equal(drubMatchBankTransfer({...movement,tokenAccountVerified:false},expected,[]).code,'BANK_ACCOUNT_UNVERIFIED');
  assert.equal(drubMatchBankTransfer(movement,{...expected,status:'EXPIRED'},[]).code,'QUOTE_NOT_PENDING');
});

test('Senior activates from next calendar month after four unique verified attendances',()=>{
  const e=(id,date,overrides={})=>({
    sessionId:id,attendedAt:date,status:'ATTENDED',
    verified:true,instructorVerified:true,...overrides
  });
  const records=[
    e('OCT-01','2026-10-03T18:00:00+02:00'),
    e('OCT-02','2026-10-10T18:00:00+02:00'),
    e('OCT-03','2026-10-17T18:00:00+02:00'),
    e('OCT-04','2026-10-24T18:00:00+02:00'),
    e('OCT-04','2026-10-24T18:00:00+02:00'), // duplicate
    e('OCT-05','2026-10-25T18:00:00+01:00',{verified:false}),
    e('OCT-06','2026-10-26T18:00:00+01:00',{status:'NO_SHOW'}),
    e('OCT-07','2026-10-27T18:00:00+01:00',{instructorVerified:false})
  ];
  const next=env.drubSeniorEligibility(event,records);
  assert.equal(next.ok,true);
  assert.equal(next.seniorEligible,true);
  assert.equal(next.verifiedVisitsPreviousMonth,4);
  assert.equal(next.previousMonth,'2026-10');
  const october=env.drubSeniorEligibility('2026-10-31T18:00:00+01:00',records);
  assert.equal(october.seniorEligible,false); // October requires verified September visits
  assert.equal(env.drubSeniorEligibility(event,records.slice(0,3)).seniorEligible,false);
});
test('Senior year boundary January requires verified December attendance',()=>{
  const r=[1,2,3,4].map(n=>({sessionId:'DEC-'+n,attendedAt:'2026-12-'+String(8+n*4).padStart(2,'0')+'T18:00:00+01:00',
    status:'ATTENDED',verified:true,instructorVerified:true}));
  const q=env.drubSeniorEligibility('2027-01-11T18:00:00+01:00',r);
  assert.equal(q.previousMonth,'2026-12');
  assert.equal(q.seniorEligible,true);
});
