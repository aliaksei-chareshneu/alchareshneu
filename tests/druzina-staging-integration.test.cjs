'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/druzina-apps-script-harness.cjs');
function stage(){
 const h=harness({enforceEmailAuth:true,futureReleaseSimulation:true,activeEmail:'owner@example.test'});
 Object.assign(h.properties,{
  DRU_FIO_READONLY_TOKEN:'Q'.repeat(64),DRU_FIO_ACCOUNT_ID:'192000145399',DRU_FIO_BANK_ID:'0800',
  DRU_FIO_IBAN:'CZ6508000000192000145399',DRU_FIO_AUTOMATION_ENABLED:'YES',
  DRU_FIO_READONLY_CONFIRMED:'YES',DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'YES',
  DRU_PAID_BOOKING_APPROVED:'YES',DRU_LEGAL_SELLER_CONFIRMED:'YES',
  DRU_OSVC_ACTIVITY_INSURANCE_VERIFIED:'YES',DRU_TRADE_AUTHORIZATION_VERIFIED:'YES',
  DRU_BOOKING_OTP_LIVE_VERIFIED:'YES',DRU_BANK_RECONCILIATION_E2E_VERIFIED:'YES',
  DRU_BOOKING_RELEASE_E2E_VERIFIED:'YES'});
 h.config('SAFETY_FORM_VERSION','SYNTHETIC-SAFETY');h.config('RULES_VERSION','SYNTHETIC-RULES');
 h.add('Products',{Product_ID:'DRU-FIRSTVISIT-202611',Offer:'Synthetic First Visit',Price_CZK:240,Active:true});
 const email='synthetic-member@example.test';
 h.call('requestBookingCode',{email});
 const code=h.emails.at(-1).body.match(/code: ([A-F0-9]{10})/)[1];
 const auth=h.call('verifyBookingCode',{email,code,name:'Synthetic Member'});
 const member=h.rows('Members')[0];
 for(const kind of ['SAFETY_FORM','RULES','AGE_CLASSIFICATION'])h.call('recordDruzinaConsentReview',{
  adminToken:h.properties.ADMIN_TOKEN,memberId:member.Member_ID,kind,
  source:'https://example.test/synthetic-evidence',guardianRequired:false});
 const gateKeys=['Session_ID','Slot_State','Publish_Confirmed_Only','Newcomer_Ready','Instructor_Verified',
  'Venue_Permission_Verified','Activity_Insurance_Verified','Participant_Safety_Form_Valid','Equipment_Check',
  'Guardian_Gate_If_Minors','Evidence_Source','Reviewer_and_proof_of_100_TOTAL_not_ready',
  'Max_Attendance_Checked','Staff_And_Marshals_Count','Other_Humans_Count_Parents_Spectators',
  'BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA'];
 const sheet=new (h.sheets.get('Products').constructor)('Druzina_Training_Capacity_Gate',gateKeys);
 h.sheets.set(sheet.name,sheet);
 function session(hours=72){
  const s=h.session(hours,{Location:'Synthetic permitted site',Capacity:4});
  h.context.appendObj_(sheet.name,{Session_ID:s.Session_ID,Slot_State:'CONFIRMED',Publish_Confirmed_Only:'YES',
   Newcomer_Ready:'YES',Instructor_Verified:'VERIFIED',Venue_Permission_Verified:'VERIFIED',
   Activity_Insurance_Verified:'VERIFIED',Participant_Safety_Form_Valid:'VERIFIED',Equipment_Check:'VERIFIED',
   Guardian_Gate_If_Minors:'NOT_APPLICABLE',Evidence_Source:'synthetic signed evidence',
   Reviewer_and_proof_of_100_TOTAL_not_ready:'synthetic owner',Max_Attendance_Checked:10,
   Staff_And_Marshals_Count:2,Other_Humans_Count_Parents_Spectators:1,
   BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:4});
  return s;
 }
 return {h,auth,member,session};
}
test('recovered p13 + staged adapters: OTP → consent → quote/VS → synthetic bank → CRM → Calendar → check-in',()=>{
 const {h,auth,member,session}=stage(),s=session();
 const payload={bookingToken:auth.bookingToken,requestId:'SYNTHETIC-ORDER-1',
  items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]};
 const q=h.call('drufCreateQuoteWithVS_',payload);
 const replay=h.call('drufCreateQuoteWithVS_',payload);
 assert.equal(replay.quoteId,q.quoteId);assert.equal(h.rows('Quotes').length,1);
 assert.equal(h.rows('Holds').length,1);
 assert.throws(()=>h.call('drufCreateQuoteWithVS_',{...payload,items:[{...payload.items[0],productCode:'OTHER'}]}),/different cart/);
 assert.equal(q.amount,240);assert.match(q.paymentReference,/^\d{10}$/);
 assert.equal(q.confirmedBooking,false);assert.equal(h.rows('Payments').length,0);
 const bank={accountStatement:{info:{accountId:'192000145399',bankId:'0800',currency:'CZK'},transactionList:{transaction:[{
  column22:{value:'1000000009'},column1:{value:'240.00'},column5:{value:q.paymentReference},column14:{value:'CZK'}
 }]}}};
 const tx=h.call('drufParseFioJSON',bank,{accountId:'192000145399',bankId:'0800'}).transactions[0];
 const result=h.call('drufCommitVerifiedBankTransaction_',tx);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(h.rows('Payments').length,1);assert.equal(h.rows('Bookings').length,1);
 const privateAccount=h.call('getDruzinaMemberAccount',{bookingToken:auth.bookingToken,memberId:'someone-else'});
 assert.equal(privateAccount.account.payments.length,1);
 assert.equal(privateAccount.account.bookings.length,1);
 assert.equal(privateAccount.account.payments[0].confirmedReceivedCZK,240);
 assert.doesNotMatch(JSON.stringify(privateAccount),/Manage_Token|FIO_SETTLED_ID|bookingToken/);
 assert.equal(h.rows('Bookings')[0].Status,'VERIFIED');
 assert.equal(h.call('drufCommitVerifiedBankTransaction_',tx).ok,false);
 assert.equal(h.rows('Payments').length,1);assert.equal(h.rows('Bookings').length,1);
 h.config('CALENDAR_SYNC_ENABLED',true);h.config('PORTAL_URL','https://example.test/synthetic-portal');
 assert.equal(h.call('syncSessionsToCalendar').created,1);
 assert.equal(h.call('syncSessionsToCalendar').created,0);assert.equal(h.calendarEvents.length,1);
 assert.equal(h.rows('Bookings')[0].Attendance_Status,'');
 h.setTime(s.End_DateTime);
 for(let i=0;i<2;i++)h.call('setAttendance',{adminToken:h.properties.ADMIN_TOKEN,
  bookingId:result.bookingIds[0],status:'PRESENT'});
 assert.equal(h.rows('Members')[0].Attendance_Total,1);assert.equal(h.rows('Bookings')[0].Status,'ATTENDED');
 assert.equal(h.calls.lockDepth,0);assert.ok(h.calls.lockAcquisitions>0);
 // Google services are in-memory fakes. No provider URLs can be fetched.
 assert.equal(h.context.UrlFetchApp,undefined);assert.equal(h.emails.length,1);
 // The real p13 package code must credit the verified attended visit once.
 h.advance(3600000);
 h.call('requestBookingCode',{email:member.Email});
 const newCode=h.emails.at(-1).body.match(/code: ([A-F0-9]{10})/)[1];
 const nextAuth=h.call('verifyBookingCode',{email:member.Email,code:newCode});
 const product=h.rows('Products').find(p=>p.Product_ID==='DRU-STARTER4-202611');
 h.patch('Products',product._row,{Active:true});
 const future=[72,144,216].map(hours=>session(hours));
 const upgradePayload={bookingToken:nextAuth.bookingToken,requestId:'SYNTHETIC-UPGRADE-1',
  items:[{productCode:'DRU-STARTER4-202611',trialUpgradeBookingId:result.bookingIds[0],
    sessionIds:future.map(s=>s.Session_ID)}]};
 const up=h.call('drufCreateQuoteWithVS_',upgradePayload);assert.equal(up.amount,560);
 const upgradeTx={...tx,transactionId:'1000000010',variableSymbol:up.paymentReference,
  amountCZK:560,amountHalers:56000};
 assert.equal(h.call('drufCommitVerifiedBankTransaction_',upgradeTx).ok,true);
 assert.equal(h.rows('Payments').length,2);assert.equal(h.rows('Bookings').length,4);
 assert.equal(h.rows('Plans').length,1);assert.equal(h.rows('Plans')[0].Sessions_Used,1);
 assert.equal(h.call('drufCommitVerifiedBankTransaction_',upgradeTx).ok,false);
 assert.equal(h.rows('Payments').length,2);assert.equal(h.rows('Plans').length,1);
});
test('default recovered runtime remains paused with no quote/payment/Calendar side effects',()=>{
 const h=harness({enforceEmailAuth:true});
 assert.equal(h.call('getBootstrap').bookingEnabled,false);
 assert.throws(()=>h.call('createQuote',{items:[]}),/paused/);
 assert.equal(h.rows('Payments').length,0);assert.equal(h.rows('Bookings').length,0);
 assert.equal(h.calendarEvents.length,0);assert.equal(h.emails.length,0);
});
test('staging uses actual consent/auth gates: unsigned minor and unknown OTP cannot reserve a place',()=>{
 const {h,auth,member,session}=stage(),s=session();
 h.call('recordDruzinaConsentReview',{adminToken:h.properties.ADMIN_TOKEN,
  memberId:member.Member_ID,kind:'AGE_CLASSIFICATION',source:'https://example.test/minor',guardianRequired:true});
 const items=[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}];
 assert.throws(()=>h.call('createQuote',{bookingToken:auth.bookingToken,items}),/guardian evidence/);
 assert.throws(()=>h.call('createQuote',{bookingToken:'forged',items}),/verification/);
 assert.equal(h.rows('Holds').length,0);assert.equal(h.rows('Payments').length,0);
 h.config('REQUIRE_BOOKING_VERIFICATION',false);
 assert.throws(()=>h.call('getDruzinaMemberAccount',{member:{email:member.Email}}),/Verified email OTP/);
});

test('actual package/no-show integration debits one visit once and exposes the correct remainder',()=>{
 const {h,auth,session}=stage();
 const product=h.rows('Products').find(p=>p.Product_ID==='DRU-STARTER4-202611');
 h.patch('Products',product._row,{Active:true});
 const sessions=[72,144,216,288].map(hours=>session(hours));
 const q=h.call('drufCreateQuoteWithVS_',{bookingToken:auth.bookingToken,requestId:'SYNTHETIC-PACKAGE-1',
  items:[{productCode:'DRU-STARTER4-202611',sessionIds:sessions.map(s=>s.Session_ID)}]});
 assert.equal(q.amount,800);
 const result=h.call('drufCommitVerifiedBankTransaction_',{transactionId:'1000000009',
  variableSymbol:q.paymentReference,amountCZK:800,amountHalers:80000,
  currency:'CZK',direction:'CREDIT',isReversal:false,tokenAccountVerified:true,accountKey:'192000145399/0800'});
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(h.rows('Plans').length,1);
 assert.equal(h.rows('Bookings').length,4);
 h.setTime(sessions[0].End_DateTime);
 for(let i=0;i<2;i++)h.call('setAttendance',{adminToken:h.properties.ADMIN_TOKEN,
  bookingId:result.bookingIds[0],status:'NO_SHOW'});
 const plan=h.rows('Plans')[0];assert.equal(plan.Sessions_Used,1);assert.equal(plan.Sessions_NoShow,1);
 const view=h.call('druaPrivateView',{serverOtpVerified:true,sessionOwnerVerified:true,
  memberId:h.rows('Members')[0].Member_ID},{member:h.rows('Members')[0],plans:h.rows('Plans')});
 assert.equal(view.account.packages[0].remaining,3);
});
test('idempotency reservation preserves interrupted checkout for recovery without another hold',()=>{
 const {h,auth,session}=stage(),s=session();
 const create=h.context.createQuote;
 h.context.createQuote=p=>{create(p);throw Error('Synthetic interruption after Sheets write')};
 const payload={bookingToken:auth.bookingToken,requestId:'SYNTHETIC-INTERRUPTED',
  items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]};
 assert.throws(()=>h.call('drufCreateQuoteWithVS_',payload),/interruption/);
 assert.throws(()=>h.call('drufCreateQuoteWithVS_',payload),/owner recovery/);
 assert.equal(h.rows('Quotes').length,1);assert.equal(h.rows('Holds').length,1);
 assert.equal(h.rows('Requests')[0].Status,'PROCESSING');assert.equal(h.rows('Payments').length,0);
});
