'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const root=path.resolve(__dirname,'..');
const source='ops/imperion-dev-cloud-fixture/multi-price.cjs';
const fixture=A.fixtureTask();
function proof(goal,patch){
 const task={...fixture,goal};
 const orig=W.safeFileRead(root,source);
 const trusted=W.safeFileRead(root,task.test,false,true);
 const test_draft={file:source,export:'netPrice',cases:[
  {name:'unchanged_positive',args:[1,2],expected:2}]};
 return {schema:'imperion-dev-autonomous-v1',status:'AUTO_MODEL_PROPOSAL_ONLY',
  task,model:W.MODEL,selected:[source],
  sources:[{file:source,source_sha256:W.sha(orig),patch}],
  trusted_test_sha256:W.sha(trusted),generated_file:A.generatedPath(task),
  test_draft,generated_sha256:W.sha(A.renderTest(task,test_draft)),
  paid_api_czk:0,auto_merge:false,advisory_test_not_independent:true};
}
test('comment-only fixture does not require a changed behavior witness',()=>{
 const p=proof('Clarify the existing comment only without changing outputs',
  {old:'// Public synthetic fixture, not application pricing logic.',
   new:'// Public synthetic arithmetic helper, never actual prices.'});
 assert.equal(A.requiresBehaviorWitness(p,root),false);
});
test('changed executable behavior needs a baseline-failing advisory test',()=>{
 const p=proof('Correct negative quantity to return zero in netPrice',
  {old:'return unitPrice * quantity;',
   new:'return quantity < 0 ? 0 : unitPrice * quantity;'});
 assert.equal(A.requiresBehaviorWitness(p,root),true);
 assert.deepEqual(A.verifyManifest(p,root).updates.map(x=>x.file),[source]);
});
test('advisory can be revised ONCE with model JSON, no source or trusted-test writes',async()=>{
 const p=proof('Correct negative quantity to return zero in netPrice',
  {old:'return unitPrice * quantity;',
   new:'return quantity < 0 ? 0 : unitPrice * quantity;'});
 const original=fs.readFileSync(path.join(root,source),'utf8');
 const trusted=fs.readFileSync(path.join(root,fixture.test),'utf8');
 let calls=0;
 const fetchImpl=async(_url,req)=>{
  calls++;
  const body=JSON.parse(req.body);
  assert.equal(body.model,W.MODEL);
  assert.match(body.prompt,/FAILS against the ORIGINAL|BEFORE/);
  return {ok:true,redirected:false,json:async()=>({done:true,model:W.MODEL,
   response:JSON.stringify({file:source,export:'netPrice',cases:[
     {name:'negative_qty',args:[3,-2],expected:0}]})})};
 };
 const revised=await A.retryAdvisory(p,root,fetchImpl);
 assert.equal(calls,1);
 assert.equal(revised.advisory_retry_done,true);
 assert.notEqual(revised.generated_sha256,p.generated_sha256);
 assert.match(A.renderTest(revised.task,revised.test_draft),/negative_qty/);
 assert.equal(A.verifyManifest(revised,root).test.file,revised.generated_file);
 await assert.rejects(()=>A.retryAdvisory(revised,root,fetchImpl),/AUTO_ADVISORY_RETRY_LIMIT/);
 assert.equal(fs.readFileSync(path.join(root,source),'utf8'),original);
 assert.equal(fs.readFileSync(path.join(root,fixture.test),'utf8'),trusted);
});
test('tampered hashes and invalid model test data fail closed',async()=>{
 const p=proof('Correct negative quantity to return zero in netPrice',
  {old:'return unitPrice * quantity;',
   new:'return quantity < 0 ? 0 : unitPrice * quantity;'});
 const fetchImpl=async()=>({ok:true,redirected:false,json:async()=>({
  done:true,model:W.MODEL,response:JSON.stringify({file:source,export:'eval',cases:[
   {name:'bad_case',args:[],expected:0}]})
 })});
 assert.throws(()=>A.requiresBehaviorWitness({...p,sources:[{...p.sources[0],source_sha256:'0'.repeat(64)}]},root),
  /AUTO_SOURCE_SHA_MISMATCH/);
 await assert.rejects(()=>A.retryAdvisory(p,root,fetchImpl),/AUTO_TEST_DRAFT_REJECTED/);
});
test('witness runs only in Docker and cannot ignore a green original test',()=>{
 const sh=fs.readFileSync(path.join(root,'scripts/imperion-dev-witness.sh'),'utf8');
 const yaml=fs.readFileSync(path.join(root,'.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
 assert.match(sh,/--network none --read-only --cap-drop ALL/);
 assert.match(sh,/--security-opt no-new-privileges/);
 assert.match(sh,/ADVISORY_DID_NOT_DETECT_NEW_BEHAVIOR/);
 assert.match(sh,/--retry-advisory/);
 assert.match(yaml,/bash scripts\/imperion-dev-witness\.sh/);
 assert.match(yaml,/needs: cloud-qwen-coding/);
});
