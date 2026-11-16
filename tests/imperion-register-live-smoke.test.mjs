import {test} from 'node:test';
import assert from 'node:assert/strict';
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const ORIGIN='https://aliaksei-chareshneu.github.io';
test('deployed registration GET is healthy, no bank details or fake booking',async()=>{
 const r=await fetch(API,{method:'GET',headers:{Origin:ORIGIN,Accept:'application/json'},
   signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200,'public registration API must answer HTTP 200');
 const body=await r.json();
 assert.equal(body.bookingConfirmed,false);
 assert.ok(Array.isArray(body.events),'event catalog must be an array');
 assert.equal(r.headers.get('access-control-allow-origin'),ORIGIN);
 for(const e of body.events){
   assert.equal(Object.hasOwn(e,'training_payment_account'),false,'no public bank account');
   assert.equal(Object.hasOwn(e,'training_payment_recipient'),false,'no public payee');
   assert.equal(e.bookingConfirmed,true,false,'no events automatically booked');
   if(e.community==='Družina Moravy'&&e.category==='HEMA Training'&&e.trainingPayment){
     assert.equal(e.trainingPayment.requiresPersonalConfirmation,true);
     assert.equal(e.trainingPayment.proofRequired,false);
     assert.deepEqual(e.trainingPayment.tiers.map(t=>t.baseCzk),[240,120,800]);
   }
 }
});
test('deployed API refuses unauthenticated payment POST without browser origin',async()=>{
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'quote',eventId:'PUB-HEMA-20261121'}),
   signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,403);
 const body=await r.json();
 assert.equal(body.error,'forbidden_origin');
 assert.equal(Object.hasOwn(body,'trainingPayment'),false);
});