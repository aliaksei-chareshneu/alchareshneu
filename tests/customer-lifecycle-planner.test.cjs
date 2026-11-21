'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planCustomerLifecycle,planInboundReply,assessLateBookingSurcharge}=require('../ops/customer-lifecycle-planner.cjs');
const event={id:'SYN-2026-11-14',status:'ACTIVE_CONFIRMED',venue_confirmed:true,organizer_confirmed:true,safety_confirmed:true,payee:'ZS',starts_at:'2026-11-14T11:00:00Z',ends_at:'2026-11-14T13:00:00Z'};
const booking={id:'SYN-BOOK-1',event_id:event.id,payee:'ZS',status:'PENDING_PAYMENT',canonical_readback:true,rules_accepted:true,email_verified:true,phone_verified:false,marketing_opt_in:false};
const policy={requires_payment:true,price_czk:200,price_approved:true,payee_verified:true,approved_checkout_url:'https://checkout.example.test/owner-approved'};
const paid={verified:true,source:'VERIFIED_STRIPE_WEBHOOK',payee:'ZS',booking_id:booking.id,cleared_czk:200,provider_receipt_id:'evt_synthetic_ok'};
const base={event,booking,policy,now:'2026-11-13T11:30:00Z',deliveryLog:[]};
test('no money without trusted proof; emit only dry-run payment link',()=>{
 const x=planCustomerLifecycle({...base,payment:{verified:true,source:'SUCCESS_REDIRECT',payee:'ZS',booking_id:booking.id,cleared_czk:200,provider_receipt_id:'fake'}});
 assert.equal(x.status,'READY_FOR_AUTHORIZED_ADAPTER');assert.deepEqual(x.actions.map(a=>a.type),['PAYMENT_LINK']);
 assert.ok(x.actions.every(a=>a.status==='DRY_RUN_REVIEW_REQUIRED'));
});
test('trusted payment results in confirmation and upcoming reminder',()=>{
 const x=planCustomerLifecycle({...base,payment:paid});assert.deepEqual(x.actions.map(a=>a.type),['BOOKING_CONFIRMATION','PRE_EVENT_REMINDER']);
});
test('source event not confirmed fails closed',()=>assert.equal(planCustomerLifecycle({...base,event:{...event,status:'HOLD'},payment:paid}).status,'BLOCKED'));
test('unverified venue fails closed',()=>assert.deepEqual(planCustomerLifecycle({...base,event:{...event,venue_confirmed:false}}).actions,[]));
test('payee mismatch prevents NGO money routed to OSVC',()=>assert.ok(planCustomerLifecycle({...base,event:{...event,payee:'OSVC'},payment:paid}).blocked.includes('ENTITY_MISMATCH')));
test('unpersisted public form is NOT a booking',()=>assert.ok(planCustomerLifecycle({...base,booking:{...booking,canonical_readback:false}}).blocked.includes('BOOKING_NOT_PERSISTED')));
test('unaccepted rules fail closed',()=>assert.ok(planCustomerLifecycle({...base,booking:{...booking,rules_accepted:false}}).blocked.includes('RULES_NOT_ACCEPTED')));
test('unknown price, payee, checkout block or flag',()=>assert.equal(planCustomerLifecycle({...base,policy:{...policy,price_approved:false}}).status,'BLOCKED'));
test('no duplicate output when dispatch receipt verified',()=>{
 const a=planCustomerLifecycle({...base,payment:paid});const receipt={key:a.actions[0].idempotency_key,status:'SENT_VERIFIED'};
 const b=planCustomerLifecycle({...base,payment:paid,deliveryLog:[receipt]});assert.equal(b.actions.length,1);assert.equal(b.actions[0].type,'PRE_EVENT_REMINDER');
});
test('post attendance message only on verified check in AFTER event',()=>{
 const when='2026-11-14T14:00:00Z';
 const x=planCustomerLifecycle({...base,now:when,payment:paid,attendance:{booking_id:booking.id,verified_by_organizer:true,check_in_at:'2026-11-14T11:10:00Z'}});
 assert.ok(x.actions.some(a=>a.type==='POST_ATTENDANCE_THANK_YOU'));
 const y=planCustomerLifecycle({...base,now:when,payment:paid,attendance:{booking_id:booking.id,verified_by_organizer:false,check_in_at:'2026-11-14T11:10:00Z'}});
 assert.ok(!y.actions.some(a=>a.type==='POST_ATTENDANCE_THANK_YOU'));
});
test('48-hour upsell requires separately opted-in marketing and approved SKU',()=>{
 const attendance={booking_id:booking.id,verified_by_organizer:true,check_in_at:'2026-11-14T11:10:00Z'};
 const upgrade={approved:true,payee:'ZS',sku:'SYN-STARTER-4',difference_czk:600,checkout_url:'https://checkout.example.test/u'};
 const t='2026-11-14T15:00:00Z';
 const no=planCustomerLifecycle({...base,now:t,payment:paid,attendance,policy:{...policy,upgrade}});
 assert.equal(no.actions.some(a=>a.type==='OPTIONAL_UPGRADE_OFFER'),false);
 const yes=planCustomerLifecycle({...base,now:t,booking:{...booking,marketing_opt_in:true},payment:paid,attendance,policy:{...policy,upgrade}});
 assert.equal(yes.actions.some(a=>a.type==='OPTIONAL_UPGRADE_OFFER'),true);
 const tooLate=planCustomerLifecycle({...base,now:'2026-11-17T16:00:00Z',booking:{...booking,marketing_opt_in:true},payment:paid,attendance,policy:{...policy,upgrade}});
 assert.equal(tooLate.actions.some(a=>a.type==='OPTIONAL_UPGRADE_OFFER'),false);
});
test('auto replies only to verified public FAQ fields; others escalate',()=>{
 const facts={E:{status:'ACTIVE_CONFIRMED',public_approved:true,registration_url:'https://example.test/register'}};
 const req={channel:'WHATSAPP',message_id:'msg1',intent:'REGISTRATION_LINK',event_id:'E'};
 assert.equal(planInboundReply(req,facts).status,'REPLY_DRAFT');
 assert.equal(planInboundReply({...req,intent:'REFUND_DISPUTE'},facts).status,'ESCALATE');
 assert.equal(planInboundReply({...req,human_required:true},facts).status,'ESCALATE');
 assert.equal(planInboundReply({...req,event_id:'UNKNOWN'},facts).status,'ESCALATE');
});
test('late booking surcharge needs prior publication, no retroactive penalty',()=>{
 const args={booked_at:'2026-11-14T07:00:00Z',published_at:'2026-10-26T12:00:00Z',event_start:event.starts_at,policy:{approved:true,prospective_terms_approved:true,surcharge_czk:100,hours_before_event:24}};
 assert.equal(assessLateBookingSurcharge(args).status,'DISPLAY_BEFORE_CHECKOUT');
 assert.equal(assessLateBookingSurcharge({...args,published_at:'2026-11-14T09:00:00Z'}).status,'NO_SURCHARGE');
 assert.equal(assessLateBookingSurcharge({...args,policy:{...args.policy,approved:false}}).status,'NO_SURCHARGE');
});
