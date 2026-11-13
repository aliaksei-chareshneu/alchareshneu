'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../ops/imperion-proof-auditor.cjs');
const sha='e'.repeat(40);
const clock=()=>Date.parse('2026-11-01T18:00:00Z');
function pr(change={}){return {number:154,base:{repo:{full_name:P.REPO}},
  head:{sha},state:'open',draft:true,merged_at:null,...change};}
function run(change={}){return {id:41281902202,repository:{full_name:P.REPO},
  head_sha:sha,status:'completed',conclusion:'success',...change};}
function api(v){return async (url,opts)=>{
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
  assert.match(url,/^https:\/\/api\.github\.com\/repos\/aliaksei-chareshneu\/alchareshneu\//);
  return {ok:true,redirected:false,json:async()=>v};
};}
const query=(change={})=>({repo:P.REPO,kind:'pull_request',id:154,
  claim:'PR_DRAFT_OPEN',expected_sha:sha,...change});
test('valid PR draft readback is verified but not deployed',async()=>{
  const r=await P.audit(query(),{fetchImpl:api(pr()),now:clock});
  assert.equal(r.verdict,'VERIFIED_PROVIDER_STATE');
  assert.equal(r.provider_state,'PR_DRAFT_OPEN');
  assert.equal(r.deployment_verified,false);
  assert.equal(r.checked_at,'2026-11-01T18:00:00.000Z');
});
test('false merged claim is contradicted, actual merged PR is verified',async()=>{
  assert.equal((await P.audit(query({claim:'PR_MERGED'}),{fetchImpl:api(pr())})).verdict,'CONTRADICTED');
  const merged=pr({state:'closed',draft:false,merged_at:'2026-10-31T10:00:00Z'});
  assert.equal((await P.audit(query({claim:'PR_MERGED'}),{fetchImpl:api(merged)})).verdict,'VERIFIED_PROVIDER_STATE');
});
test('a PR cannot prove DONE, LIVE, deployment, cash or publishing',async()=>{
  for(const claim of ['DONE','LIVE','DEPLOYED','PAID','PUBLISHED','BANK_VERIFIED']){
    const r=await P.audit(query({claim}),{fetchImpl:api(pr())});
    assert.equal(r.verdict,'UNVERIFIED');
    assert.equal(r.reason,'CLAIM_NEEDS_DIFFERENT_PROVIDER_PROOF');
  }
});
test('CI success requires exact provider run and expected HEAD SHA',async()=>{
  const q={repo:P.REPO,kind:'workflow_run',id:41281902202,claim:'CI_PASS',expected_sha:sha};
  assert.equal((await P.audit(q,{fetchImpl:api(run())})).verdict,'VERIFIED_PROVIDER_STATE');
  assert.equal((await P.audit({...q,expected_sha:'a'.repeat(40)},{fetchImpl:api(run())})).verdict,'UNVERIFIED');
  assert.equal((await P.audit({...q,expected_sha:undefined},{fetchImpl:api(run())})).reason,
    'EXPECTED_HEAD_SHA_REQUIRED_FOR_CI');
  assert.equal((await P.audit(q,{fetchImpl:api(run({conclusion:'failure'}))})).verdict,'CONTRADICTED');
  assert.equal((await P.audit(q,{fetchImpl:api(run({status:'in_progress'}))})).verdict,'CONTRADICTED');
});
test('incorrect provider identity, repo and SHA fail closed',async()=>{
  for(const row of [pr({number:155}),pr({base:{repo:{full_name:'other/repo'}}}),
    pr({head:{sha:'a'.repeat(40)}})]){
    assert.equal((await P.audit(query(),{fetchImpl:api(row)})).verdict,'UNVERIFIED');
  }
});
test('invalid input makes no network calls',async()=>{
  let count=0;const fetchImpl=async()=>{count++;throw Error('SHOULD_NOT_CALL');};
  for(const i of [query({repo:'other/repo'}),query({id:'154'}),query({id:0}),
    query({claim:'UNSUPPORTED'}),query({expected_sha:'bad'}),
    query({kind:'workflow_run',claim:'PR_DRAFT_OPEN'})]){
    const r=await P.audit(i,{fetchImpl});
    assert.equal(r.verdict,'UNVERIFIED');
    assert.equal(r.reason,'INVALID_INPUT');
  }
  assert.equal(count,0);
});
test('403, redirect and network error never become verified proof',async()=>{
  for(const fetchImpl of [async()=>({ok:false,status:403}),
    async()=>({ok:true,redirected:true}),async()=>{throw Error('offline');}]){
    const r=await P.audit(query(),{fetchImpl});
    assert.equal(r.verdict,'UNVERIFIED');
  }
});
