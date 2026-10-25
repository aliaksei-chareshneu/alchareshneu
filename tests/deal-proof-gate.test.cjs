'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {report,economics}=require('../ops/deal-proof-gate.cjs');
const qualified={
  entity:'OSVC',buyer_source:'Buyer reply evidence',problem:'Document manual workflow',
  authority:'Authorized buyer named',budget_source:'Budget in buyer email',
  scope:'One workflow only',deliverable:'Reproducible handover',acceptance:'Buyer accepts reproducible test',
  price_source:'Approved written quote',payment_terms:'Due on accepted invoice',
  cancellation_terms:'Written cancellation clause'
};
test('unverified lead never becomes a sale',()=>{
 const result=report({entity:'OSVC'});
 assert.equal(result.recorded_stage,'LEAD');
 assert.equal(result.verified_cash,false);
 assert.ok(result.next_missing_evidence.includes('buyer_source'));
});
test('buyer and price evidence still does not prove an order',()=>{
 const result=report(qualified);
 assert.equal(result.recorded_stage,'OFFER');
 assert.ok(result.next_missing_evidence.includes('written_order_source'));
 assert.equal(result.verified_order,false);
});
test('invoice is not a verified bank credit',()=>{
 const result=report({...qualified,written_order_source:'Signed purchase order',invoice_source:'Invoice document'});
 assert.equal(result.recorded_stage,'INVOICE');
 assert.ok(result.next_missing_evidence.includes('bank_readback_source'));
 assert.equal(result.verified_cash,false);
});
test('self-entered bank proof requires independent verification',()=>{
 const result=report({...qualified,written_order_source:'Purchase order',
  invoice_source:'Invoice evidence',bank_readback_source:'Bank statement row',payee_confirmation:'Verified legal seller'});
 assert.equal(result.recorded_stage,'BANK');
 assert.equal(result.verified_cash,false);
 assert.equal(result.state,'NEEDS_INDEPENDENT_READBACK');
});
test('NGO and regulated sport are separate legal gates',()=>{
 for(const item of [{...qualified,entity:'Z.S.'},{...qualified,sports_training:true}]){
  const result=report(item);
  assert.equal(result.state,'HOLD');assert.equal(result.verified_cash,false);
 }
});
test('no buyer or opportunity values echoed by default',()=>{
 const result=report({...qualified,private_message:'Confidential client details'});
 assert.ok(!JSON.stringify(result).includes('Confidential'));
});

test('economics are labeled scenarios, not revenue',()=>{
 const x=economics({...qualified,economics:{quoted_czk:14900,external_cost_czk:2900,founder_hours:8,
  probability:0.4,probability_source:'Reviewed qualification evidence',expected_payment_days:21}});
 assert.equal(x.net_per_founder_hour_scenario_czk,1500);
 assert.equal(x.weighted30_scenario_czk,5960);
 assert.equal(report(qualified).verified_cash,false);
});
test('missing basis or payment beyond thirty days has no weighted scenario',()=>{
 const a=economics({economics:{quoted_czk:14900,external_cost_czk:0,founder_hours:5,
   probability:0.4,expected_payment_days:14}});
 assert.equal(a.weighted30_scenario_czk,null);
 const b=economics({...qualified,economics:{quoted_czk:14900,external_cost_czk:0,founder_hours:5,
   probability:0.4,probability_source:'Buyer message',expected_payment_days:31}});
 assert.equal(b.weighted30_scenario_czk,null);
});

test('unqualified leads never get weighted thirty-day scenarios',()=>{
 const scenario=economics({entity:'OSVC',economics:{
   quoted_czk:14900,external_cost_czk:0,founder_hours:5,probability:0.5,
   probability_source:'Synthetic assumption',expected_payment_days:12
 }});
 assert.equal(scenario.weighted30_scenario_czk,null);
});
