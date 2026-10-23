'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validDomain, preflight,siteSignals} = require('../ops/ngo-adgrants-preflight.cjs');
const okHtml = '<html><h1>Družina Moravy</h1><p>Naše poslání — komunitní volnočasové aktivity. Dobrovolnictví / registrace.</p><a href="mailto:info@example.org">Kontakt</a><a href="/privacy">Ochrana osobních údajů</a></html>';
const html = (data,status=200,ct='text/html') => ({ok:status>=200&&status<300,status,headers:{get:()=>ct},text:async()=>data});
const mock = (fn,ns=['ns1.desec.io','ns2.desec.org'])=>({resolveNs:async()=>ns,fetchFn:fn});
test('reject private or invalid domain-like strings',()=>{
  for(const d of ['localhost','..evil.org','evil.org/path','evil.org:80','-evil.org','evil..org','a'.repeat(64)+'.org']) assert.equal(validDomain(d),false);
  assert.equal(validDomain('druzinamoravy.asso.eu.org'),true);
});
test('fail closed if public registrar delegation is missing',async()=>{
  let requests=0;const r=await preflight(undefined,{resolveNs:async()=>{const e=Error('NXDOMAIN');e.code='ENOTFOUND';throw e;},fetchFn:()=>{requests++;throw Error('should never fetch')}});
  assert.equal(r.status,'BLOCKED');assert.equal(requests,0);assert.equal(r.checks.ns.ok,false);assert.equal(r.ad_grants_activated,false);
});
test('fail closed on no NS',async()=>{const r=await preflight(undefined,mock(()=>{throw Error('not fetch')},[]));assert.equal(r.status,'BLOCKED')});
test('site redirect is NOT evidence of compliant NGO website',async()=>{
  const r=await preflight(undefined,mock(async()=>html('',301)));
  assert.equal(r.status,'BLOCKED');assert.equal(r.checks.homepage.reason,'REDIRECT_NOT_EVIDENCE_OF_OWNED_SITE');
});
test('missing legal privacy and NGO mission triggers review, never active Ads',async()=>{
  const r=await preflight(undefined,mock(async()=>html('<html>Random blog</html>')));
  assert.equal(r.status,'CONTENT_REVIEW_REQUIRED');assert.equal(r.checks.homepage.missing.length,5);assert.equal(r.ad_grants_activated,false);
});
test('all signals still require human policy validation, never ads spend',async()=>{
  const r=await preflight(undefined,mock(async()=>html(okHtml)));
  assert.equal(r.status,'MANUAL_REVIEW_REQUIRED');assert.equal(r.real_eligibility_verified,false);assert.equal(r.ad_grants_activated,false);assert.equal(r.paid_actions,0);assert.equal(r.checks.homepage.missing.length,0);
});
test('HTTPS failure remains a blocker',async()=>{const r=await preflight(undefined,mock(async()=>{throw Error('ECONNREFUSED')}));assert.equal(r.status,'BLOCKED')});
test('non-HTML homepage remains a blocker',async()=>{const r=await preflight(undefined,mock(async()=>html('fake pdf',200,'application/pdf')));assert.equal(r.status,'BLOCKED')});
test('script-hidden copy cannot satisfy mission/privacy signals',()=>{assert.equal(siteSignals('<script>Mission privacy volunteer Družina Moravy contact</script>').mission,false)});
