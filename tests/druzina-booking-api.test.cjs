'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/druzina-apps-script-harness.cjs');
const {stage}=require('./helpers/druzina-booking-stage.cjs');
test('public bank-order API fails closed with production defaults, even if caller supplies flags',()=>{
 const h=harness({enforceEmailAuth:true});
 assert.throws(()=>h.call('createDruzinaBankOrder',{bookingToken:'forged',
  paidBookingLiveApproved:true,DRUS_PAID_BANK_ADAPTER_LIVE:true,items:[]}),/paused/);
 assert.equal(h.rows('Quotes').length,0);assert.equal(h.rows('Requests').length,0);
 assert.equal(h.rows('Payments').length,0);assert.equal(h.emails.length,0);
});
test('operator API requires server-side admin role and performs zero mutations',()=>{
 const {h,auth,session}=stage(),s=session();
 for(const p of [{},{adminToken:'forged'},{bookingToken:auth.bookingToken}])
  assert.throws(()=>h.call('getDruzinaBookingOperations',p),/Unauthorized/);
 const q=h.call('createDruzinaBankOrder',{bookingToken:auth.bookingToken,requestId:'OPERATOR-READBACK',
  items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]});
 const snapshot=()=>JSON.stringify([...h.sheets].map(([k,v])=>[k,v.data]));
 const before=snapshot(),result=h.call('getDruzinaBookingOperations',{adminToken:h.properties.ADMIN_TOKEN});
 assert.equal(result.unpaidOrders,1);assert.equal(result.bankRecordedPayments,0);
 assert.equal(result.sessions[0].held,1);assert.equal(result.sessions[0].available,3);
 assert.equal(result.sessions[0].minimumGroupReview,true);
 assert.equal(result.automaticCancellations,0);assert.equal(snapshot(),before);
 assert.equal(result.bankReadback,'NOT_PERFORMED');
 h.advance(21*60000);
 const expired=h.call('getDruzinaBookingOperations',{adminToken:h.properties.ADMIN_TOKEN});
 assert.equal(expired.expiredUnpaidOrders,1);assert.equal(expired.sessions[0].held,0);
 assert.equal(h.rows('Quotes')[0].Quote_ID,q.quoteId);
 assert.equal(h.rows('Quotes')[0].Status,'OPEN','Readback does not mutate expired orders');
 assert.equal(h.rows('Sessions')[0].Status,'OPEN','Minimum group never cancels a session');
});
test('bank-order API cannot fall back to an unverified member profile',()=>{
 const {h,session}=stage(),s=session();
 const payload={requestId:'UNVERIFIED-ATTACK',member:{email:'synthetic-member@example.test'},
  items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]};
 assert.throws(()=>h.call('createDruzinaBankOrder',payload),/verification/i);
 h.config('REQUIRE_BOOKING_VERIFICATION',false);
 assert.throws(()=>h.call('createDruzinaBankOrder',payload),/paused|OTP/i);
 assert.equal(h.rows('Quotes').length,0);assert.equal(h.rows('Holds').length,0);
});
