'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {stage}=require('./helpers/druzina-booking-stage.cjs');
const productCode='DRU-FIRSTVISIT-202611';
const payload=(auth,id,session)=>({bookingToken:auth.bookingToken,requestId:id,
  items:[{productCode,sessionId:session.Session_ID}]});

test('overlapping dates in one cart cannot reserve two places',()=>{
 const {h,auth,session}=stage(),a=session(72),b=session(72.5);
 const before=h.rows('Requests').length;
 assert.throws(()=>h.call('drufCreateQuoteWithVS_',{...payload(auth,'OVERLAP-CART',a),
  items:[{productCode,sessionId:a.Session_ID},{productCode:'DRU-JUNIOR-DROPIN',sessionId:b.Session_ID}]}),/overlap/i);
 assert.equal(h.rows('Quotes').length,0);assert.equal(h.rows('Holds').length,0);
 assert.equal(h.rows('Requests').length,before);
});
test('own unexpired hold prevents conflicting checkout; exact replay stays idempotent',()=>{
 const {h,auth,session}=stage(),a=session(72),b=session(72.5);
 const p=payload(auth,'HOLD-ORIGINAL',a),q=h.call('drufCreateQuoteWithVS_',p);
 assert.equal(h.call('drufCreateQuoteWithVS_',p).quoteId,q.quoteId);
 assert.throws(()=>h.call('drufCreateQuoteWithVS_',payload(auth,'HOLD-CONFLICT',b)),/overlap/i);
 assert.equal(h.rows('Quotes').length,1);assert.equal(h.rows('Holds').length,1);
});
test('different session ID overlapping an existing paid booking is rejected',()=>{
 const {h,auth,member,session}=stage(),a=session(72),b=session(72.5);
 h.add('Bookings',{Booking_ID:'EXISTING',Member_ID:member.Member_ID,Session_ID:a.Session_ID,Status:'VERIFIED'});
 assert.throws(()=>h.call('drufCreateQuoteWithVS_',payload(auth,'BOOKING-CONFLICT',b)),/overlap/i);
 assert.equal(h.rows('Quotes').length,0);
});
test('settlement rechecks conflicts introduced after quote without recording money',()=>{
 const {h,auth,member,session}=stage(),a=session(72),b=session(72.5);
 const q=h.call('drufCreateQuoteWithVS_',payload(auth,'LATER-CONFLICT',a));
 h.add('Bookings',{Booking_ID:'EXISTING',Member_ID:member.Member_ID,Session_ID:b.Session_ID,Status:'VERIFIED'});
 const result=h.call('drufCommitVerifiedBankTransaction_',{transactionId:'1000000009',
  variableSymbol:q.paymentReference,amountCZK:240,amountHalers:24000,currency:'CZK',
  direction:'CREDIT',isReversal:false,tokenAccountVerified:true,accountKey:'192000145399/0800'});
 assert.equal(result.ok,false);assert.equal(h.rows('Payments').length,0);
 assert.equal(h.rows('Quotes')[0].Status,'OPEN');assert.equal(h.rows('Bookings').length,1);
});
test('expired holds and cancelled bookings release conflicts; adjacent dates are allowed',()=>{
 const {h,auth,member,session}=stage(),a=session(72),b=session(73.5);
 h.add('Bookings',{Booking_ID:'OLD',Member_ID:member.Member_ID,Session_ID:a.Session_ID,Status:'CANCELLED'});
 h.add('Holds',{Hold_ID:'OLD-HOLD',Member_ID:member.Member_ID,Session_ID:a.Session_ID,
  Status:'ACTIVE',Expires_At:'2020-01-01T00:00:00Z'});
 assert.equal(h.call('drufCreateQuoteWithVS_',payload(auth,'ADJACENT-CART',b)).amount,240);
});
test('duplicate session identity and invalid interval fail closed before reserving',()=>{
 for(const bad of ['duplicate','invalid']){
  const {h,auth,session}=stage(),s=session(72);
  if(bad==='duplicate')h.add('Sessions',{...s});
  else h.patch('Sessions',s._row,{End_DateTime:'not-a-date'});
  assert.throws(()=>h.call('drufCreateQuoteWithVS_',payload(auth,'BAD-SESSION-ID',s)),/session|interval/i);
  assert.equal(h.rows('Quotes').length,0);assert.equal(h.rows('Holds').length,0);
 }
});
