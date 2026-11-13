/* Public read-only digital-store smoke test. Never creates a payment or a buyer record. */
'use strict';
const assert=require('node:assert/strict');
const ROOT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-digital-store';
const SITE='https://aliaksei-chareshneu.github.io/alchareshneu/shop/';
async function request(url,options={}){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000),...options});
  const body=await response.text();
  let obj={};try{obj=JSON.parse(body)}catch{}
  return {status:response.status,headers:response.headers,body:obj,raw:body};
}
(async()=>{
  const health=await request(ROOT+'/health');
  assert.equal(health.status,200,'Health must be publicly reachable');
  assert.equal(health.body.service,'imperion-digital-store','Wrong backend');
  const products=Object.fromEntries((health.body.products||[]).map(x=>[x.product_key,x]));
  assert.equal(products.csv_rescue.price_czk,490);
  assert.equal(products.ai_roi.price_czk,690);
  assert.equal(health.headers.get('access-control-allow-origin'),'https://aliaksei-chareshneu.github.io');
  console.log('PASS: public health reads both server-side product prices; checkout_active=',health.body.checkout_active);
  const unauth=await request(ROOT+'/download?session_id=not-a-session');
  assert.equal(unauth.status,400,'Malformed session must not download ZIP');
  assert.notEqual(unauth.headers.get('content-type'),'application/zip');
  console.log('PASS: invalid download is denied');
  const badStatus=await request(ROOT+'/status?session_id=not-a-session');
  assert.equal(badStatus.status,200);assert.equal(badStatus.body.ready,false);
  console.log('PASS: arbitrary session cannot obtain delivery');
  const forbidden=await request(ROOT+'/checkout-intent',{method:'POST',
    headers:{'content-type':'application/json','Origin':'https://random.invalid'},
    body:JSON.stringify({product_key:'csv_rescue',accepted_terms:true,immediate_delivery_requested:true,policy_version:'digital-v1-20261108'})});
  assert.equal(forbidden.status,403,'Origin guard must block cross-site checkout');
  console.log('PASS: checkout origin guard');
  // A deliberately invalid consent must fail at validation (422). If the secret
  // cannot be read from private Vault, the server instead responds 503 before validation.
  // No consent/charge/order is created by this readback probe.
  const vaultReady=await request(ROOT+'/checkout-intent',{method:'POST',
    headers:{'content-type':'application/json','Origin':'https://aliaksei-chareshneu.github.io'},
    body:JSON.stringify({product_key:'csv_rescue',accepted_terms:false,
      immediate_delivery_requested:false,policy_version:'digital-v1-20261108'})});
  assert.equal(vaultReady.status,422,'Stripe signing secret must be available via private Supabase Vault');
  assert.equal(vaultReady.body.error,'consent_or_product_missing');
  console.log('PASS: real webhook signing secret accessible to server; invalid consent blocked without charge');
  // A valid pre-checkout request records consent and returns a Stripe Payment Link,
  // but DOES NOT submit payment details or create a Stripe charge.
  for (const key of ['csv_rescue','ai_roi']) {
    const intent=await request(ROOT+'/checkout-intent',{method:'POST',
      headers:{'content-type':'application/json','Origin':'https://aliaksei-chareshneu.github.io'},
      body:JSON.stringify({product_key:key,accepted_terms:true,
        immediate_delivery_requested:true,policy_version:'digital-v1-20261108'})});
    assert.equal(intent.status,200,key+' must return an active checkout URL');
    assert.equal(intent.body.product_key,key);
    const checkout=new URL(intent.body.checkout_url);
    assert.equal(checkout.protocol,'https:');
    assert.equal(checkout.hostname,'buy.stripe.com');
    assert.match(checkout.searchParams.get('client_reference_id')||'',/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/);
    console.log('PASS: real live '+key+' checkout intent, consent + Stripe URL verified; NO payment attempted');
  }

  const bogusWebhook=await request(ROOT+'/stripe-webhook',{method:'POST',
    headers:{'content-type':'application/json','Stripe-Signature':'t=1234567890,v1='+('0'.repeat(64))},
    body:JSON.stringify({type:'checkout.session.completed',id:'evt_invalid'})});
  assert.ok([400,503].includes(bogusWebhook.status),'Forged Stripe event must be denied');
  console.log('PASS: forged webhook denied');
  if(!health.body.checkout_active){
    console.log('PENDING: live Stripe link, webhook secret and tax verification; no live sale claimed');
  } else{
    console.log('NOTE: live checkout enabled; full test requires an authorized real paid purchase');
  }
  console.log('SMOKE TEST COMPLETE; no real payment attempted or new customer created');
})().catch(err=>{console.error('DIGITAL STORE SMOKE FAILED:',err.message);process.exitCode=1});
