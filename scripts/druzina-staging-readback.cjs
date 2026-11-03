'use strict';
// Local synthetic acceptance only. Never loads credentials or calls a provider.
const assert=require('node:assert/strict');
const {stage}=require('../tests/helpers/druzina-booking-stage.cjs');
const {harness}=require('../tests/helpers/druzina-apps-script-harness.cjs');
const paused=harness({enforceEmailAuth:true});
assert.equal(paused.call('getBootstrap').bookingEnabled,false);
assert.throws(()=>paused.call('createDruzinaBankOrder',{items:[]}),/paused/);
const {h,auth,session}=stage(),s=session();
const payload={bookingToken:auth.bookingToken,requestId:'LOCAL-READBACK-ORDER',
 items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]};
const order=h.call('createDruzinaBankOrder',payload);
assert.equal(h.call('createDruzinaBankOrder',payload).orderId,order.orderId);
const statement={accountStatement:{info:{accountId:h.properties.DRU_FIO_ACCOUNT_ID,
 bankId:h.properties.DRU_FIO_BANK_ID,currency:'CZK'},transactionList:{transaction:[{
 column22:{value:'1000000009'},column1:{value:'240.00'},
 column5:{value:order.paymentReference},column14:{value:'CZK'}
}]}}};
const parsed=h.call('drufParseFioJSON',statement,{accountId:h.properties.DRU_FIO_ACCOUNT_ID,
 bankId:h.properties.DRU_FIO_BANK_ID});
assert.equal(parsed.ok,true);
assert.equal(h.call('drufCommitVerifiedBankTransaction_',parsed.transactions[0]).ok,true);
assert.equal(h.call('drufCommitVerifiedBankTransaction_',parsed.transactions[0]).ok,false);
// Fresh readers reconstruct state from persisted fake Sheet cells rather than
// accepting the returned mutation response as proof of the business outcome.
const account=h.call('getDruzinaMemberAccount',{bookingToken:auth.bookingToken});
const ops=h.call('getDruzinaBookingOperations',{adminToken:h.properties.ADMIN_TOKEN});
assert.equal(account.account.payments[0].paymentState,'PAID_BANK_VERIFIED');
assert.equal(account.account.bookings[0].bookingState,'BOOKED');
assert.equal(h.rows('Quotes').length,1);assert.equal(h.rows('Payments').length,1);
assert.equal(h.rows('Bookings').length,1);assert.equal(ops.sessions[0].occupied,1);
h.config('CALENDAR_SYNC_ENABLED',true);h.config('PORTAL_URL','https://example.test/synthetic-portal');
assert.equal(h.call('syncSessionsToCalendar').created,1);
assert.equal(h.call('syncSessionsToCalendar').created,0);
assert.equal(h.calendarEvents.length,1);
assert.equal(h.rows('Bookings')[0].Attendance_Status,'');
h.setTime(s.End_DateTime);
const bookingId=h.rows('Bookings')[0].Booking_ID;
for(let i=0;i<2;i++)h.call('setAttendance',{adminToken:h.properties.ADMIN_TOKEN,bookingId,status:'PRESENT'});
assert.equal(h.rows('Members')[0].Attendance_Total,1);
assert.equal(h.rows('Bookings')[0].Attendance_Status,'PRESENT');
assert.equal(h.context.UrlFetchApp,undefined);
console.log(JSON.stringify({mode:'LOCAL_SYNTHETIC_FUTURE_RELEASE_SIMULATION',
 status:'PASS',defaultPaidRelease:'PAUSED',providerReadback:'NOT_PERFORMED',
 googleServices:'IN_MEMORY_FAKES',bank:'SYNTHETIC_STATEMENT',
 otp:'FAKE_MAILBOX_NOT_REAL_DELIVERY',
 stored:{orders:h.rows('Quotes').length,payments:h.rows('Payments').length,
  bookings:h.rows('Bookings').length,calendarEvents:h.calendarEvents.length,
  verifiedAttendances:h.rows('Members')[0].Attendance_Total},
 replayDuplicates:0,ownerProductionGo:false},null,2));
