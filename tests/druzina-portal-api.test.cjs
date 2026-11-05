'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {stage}=require('./helpers/druzina-staging-fixture.cjs');
function booked(locale='ru'){
 const env=stage(),{h,auth,session}=env,s=session(72);
 const q=h.call('createDruzinaBankQuote',{bookingToken:auth.bookingToken,language:locale,
  termsAccepted:true,termsVersion:'SYNTHETIC-TERMS-V1',
  requestId:'SYNTHETIC-API-ORDER',items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]});
 const tx={transactionId:'1000000009',variableSymbol:q.paymentReference,amountCZK:240,amountHalers:24000,
  currency:'CZK',direction:'CREDIT',isReversal:false,tokenAccountVerified:true,accountKey:'192000145399/0800'};
 assert.equal(h.call('getDruzinaOrderStatus',{bookingToken:auth.bookingToken,orderId:q.orderId}).paymentState,'PENDING_PAYMENT');
 const payment=h.call('drufCommitVerifiedBankTransaction_',tx);assert.equal(payment.ok,true);
 return {...env,s,q,tx,payment};
}
test('public order API is OTP-bound, bank-backed and does not leak another order',()=>{
 const {h,auth,q}=booked();
 const status=h.call('getDruzinaOrderStatus',{bookingToken:auth.bookingToken,orderId:q.orderId});
 assert.equal(status.paymentState,'PAID_BANK_VERIFIED');assert.equal(status.bookingState,'BOOKED');
 assert.throws(()=>h.call('getDruzinaOrderStatus',{bookingToken:'forged',orderId:q.orderId}),/verification/);
 assert.throws(()=>h.call('getDruzinaOrderStatus',{bookingToken:auth.bookingToken,orderId:'OTHER'}),/unavailable/);
 assert.doesNotMatch(JSON.stringify(status),/Manage_Token|Email|FIO_SETTLED_ID/);
});
test('unapproved, missing and superseded purchase terms produce no payment instructions or holds',()=>{
 for(const mode of ['unapproved','unchecked','stale']){
  const {h,auth,session}=stage(),s=session(72);
  if(mode==='unapproved')h.properties.DRU_PAID_TERMS_APPROVED='NO';
  assert.throws(()=>h.call('createDruzinaBankQuote',{bookingToken:auth.bookingToken,
   requestId:'SYNTHETIC-TERMS-ORDER',termsAccepted:mode!=='unchecked',
   termsVersion:mode==='stale'?'OLD-VERSION':'SYNTHETIC-TERMS-V1',
   items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]}),/terms/);
  assert.equal(h.rows('Quotes').length,0);assert.equal(h.rows('Holds').length,0);
 }
});
test('OTP cancellation request deduplicates without cancelling or refunding a booking',()=>{
 const {h,auth,payment}=booked(),payload={bookingToken:auth.bookingToken,bookingId:payment.bookingIds[0]};
 for(let i=0;i<2;i++)assert.equal(h.call('requestDruzinaCancellation',payload).bookingChanged,false);
 assert.equal(h.rows('Requests').filter(r=>String(r.Request_ID).startsWith('CXL-')).length,1);
 assert.equal(h.rows('Bookings')[0].Status,'VERIFIED');assert.equal(h.rows('Payments')[0].Verification_Status,'VERIFIED');
});
test('OTP rescheduling reuses existing capacity/cutoff checks and preserves bank payment',()=>{
 const {h,auth,payment,session}=booked(),dest=session(144),before=h.rows('Bookings')[0];
 const payload={bookingToken:auth.bookingToken,bookingId:payment.bookingIds[0],newSessionId:dest.Session_ID};
 assert.equal(h.call('rescheduleDruzinaBooking',payload).ok,true);
 assert.equal(h.call('rescheduleDruzinaBooking',payload).ok,true);
 assert.equal(h.rows('Bookings').length,1);assert.equal(h.rows('Bookings')[0].Payment_ID,before.Payment_ID);
 const near=session(24);assert.throws(()=>h.call('rescheduleDruzinaBooking',{...payload,newSessionId:near.Session_ID}),/48 hours/);
});
test('operator counts require existing admin authentication and expose no participant names',()=>{
 const {h}=booked();assert.throws(()=>h.call('getDruzinaBookingOperations','wrong'),/Unauthorized/);
 const r=h.call('getDruzinaBookingOperations',h.properties.ADMIN_TOKEN);
 assert.equal(r.counts.bankVerifiedPayments,1);assert.equal(r.counts.booked,1);
 assert.equal(r.sessions[0].organizerDecisionRequired,true);
 assert.doesNotMatch(JSON.stringify(r),/synthetic-member|Synthetic Member|Manage_Token/);
});
test('notification queue and delivery are separately disabled until explicit release approval',()=>{
 const {h}=booked();const count=h.emails.length;
 assert.equal(h.call('drunQueueBookingNotifications').disabled,true);
 assert.equal(h.call('drunDeliverNotifications').disabled,true);
 assert.equal(h.emails.length,count);assert.equal(h.rows('Notifications').length,0);
});
test('cancelled session is shown as cancelled without erasing its verified payment',()=>{
 const {h,auth,q,s}=booked();h.patch('Sessions',s._row,{Status:'CANCELLED'});
 const status=h.call('getDruzinaOrderStatus',{bookingToken:auth.bookingToken,orderId:q.orderId});
 assert.equal(status.paymentState,'PAID_BANK_VERIFIED');assert.equal(status.bookingState,'CANCELLED');
 assert.equal(h.call('getDruzinaMemberAccount',{bookingToken:auth.bookingToken}).account.bookings[0].bookingState,'CANCELLED');
});
test('bank instructions and their capacity holds end at the actual price cutoff',()=>{
 const {h,auth,session}=stage(),s=session(48+5/60);
 const q=h.call('createDruzinaBankQuote',{bookingToken:auth.bookingToken,language:'en',requestId:'SYNTHETIC-CUTOFF-ORDER',
  termsAccepted:true,termsVersion:'SYNTHETIC-TERMS-V1',items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]});
 assert.equal(new Date(q.expiresAt).getTime(),h.now().getTime()+5*60000);
 assert.equal(h.rows('Holds')[0].Expires_At,q.expiresAt);
});
test('existing notification queue deduplicates; synthetic delivery sends a confirmed receipt once',()=>{
 const {h}=booked();h.properties.DRU_NOTIFICATION_QUEUE_ENABLED='YES';
 assert.equal(h.call('drunQueueBookingNotifications').queued,2);
 assert.equal(h.call('drunQueueBookingNotifications').queued,0);
 h.properties.DRU_NOTIFICATION_DELIVERY_ENABLED='YES';const before=h.emails.length;
 assert.equal(h.call('drunDeliverNotifications').sent,1);
 assert.match(h.emails.at(-1).body,/Бронь подтверждена/);
 assert.equal(h.call('drunDeliverNotifications').sent,0);assert.equal(h.emails.length,before+1);
 assert.equal(h.rows('Notifications').filter(n=>n.Status==='SENT').length,1);
});
test('uncertain SMTP failure is a manual exception and never automatically retried',()=>{
 const {h}=booked();h.properties.DRU_NOTIFICATION_QUEUE_ENABLED='YES';h.call('drunQueueBookingNotifications');
 h.properties.DRU_NOTIFICATION_DELIVERY_ENABLED='YES';let attempts=0;
 h.context.MailApp.sendEmail=()=>{attempts++;throw Error('Synthetic unknown SMTP outcome')};
 assert.equal(h.call('drunDeliverNotifications').sent,0);
 assert.equal(h.call('drunDeliverNotifications').sent,0);assert.equal(attempts,1);
 assert.equal(h.rows('Notifications').filter(n=>n.Status==='MANUAL_REVIEW').length,1);
});
test('cancelled session and missing guardian contact suppress automated reminders and receipts',()=>{
 for(const scenario of ['cancelled','minor']){
  const {h,s,member}=booked();h.properties.DRU_NOTIFICATION_QUEUE_ENABLED='YES';
  if(scenario==='minor')h.call('recordDruzinaConsentReview',{adminToken:h.properties.ADMIN_TOKEN,
   memberId:member.Member_ID,kind:'AGE_CLASSIFICATION',source:'https://example.test/guardian',guardianRequired:true});
  h.call('drunQueueBookingNotifications');
  if(scenario==='cancelled')h.patch('Sessions',s._row,{Status:'CANCELLED'});
  h.properties.DRU_NOTIFICATION_DELIVERY_ENABLED='YES';const before=h.emails.length;
  assert.equal(h.call('drunDeliverNotifications').sent,0);assert.equal(h.emails.length,before);
 }
});
