'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const child=require('node:child_process');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const D=require('../scripts/imperion-dev-draft-tests.cjs');
const good={export:'total',cases:[
 {name:'empty_rows',args:[[]],expected:0},
 {name:'one_row',args:[[{price:6,quantity:4}]],expected:24},
 {name:'two_rows',args:[[{price:7,quantity:0},{price:3,quantity:5}]],expected:15}
]};
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'imperion-draft-cases-'));
 for(const file of [W.FIXTURE_FILE,W.FIXTURE_TEST])
  fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'../'+W.FIXTURE_FILE),path.join(root,W.FIXTURE_FILE));
 fs.copyFileSync(path.join(__dirname,'../'+W.FIXTURE_TEST),path.join(root,W.FIXTURE_TEST));
 const source=fs.readFileSync(path.join(root,W.FIXTURE_FILE),'utf8');
 const proof={schema:'imperion-dev-cloud-task-v1',status:'MODEL_PROPOSAL_ONLY',
  task:{mode:'FIXTURE',file:W.FIXTURE_FILE,test:W.FIXTURE_TEST,comment:0},
  source_sha256:W.sha(source),model:W.MODEL,
  patch:{old:'sum + row.price',new:'sum + row.price * row.quantity'}};
 return {root,proof,source};
}
test('data-only Qwen draft cases validate math and diverse inputs',()=>{
 assert.deepEqual(D.parseDraftVectors(JSON.stringify(good)),good);
 assert.equal(D.DEST,'tests/generated/imperion-dev-cloud-preview.test.cjs');
});
test('malicious and incoherent model vectors fail closed',()=>{
 for(const c of [
  {...good,export:'constructor'},
  {...good,cases:good.cases.slice(1)},
  {...good,cases:[good.cases[0],good.cases[0],good.cases[2]]},
  {...good,cases:[good.cases[0],{...good.cases[1],expected:2},good.cases[2]]},
  {...good,cases:[good.cases[0],{...good.cases[1],name:'../../shell'},good.cases[2]]},
  {...good,cases:[good.cases[0],{...good.cases[1],args:[[{price:-1,quantity:3}]]},good.cases[2]]},
  {...good,cases:[good.cases[0],{...good.cases[1],args:[[{price:1,quantity:3,__proto__:null,command:'delete'}]]},good.cases[2]]},
  {...good,cases:[good.cases[0],good.cases[1],{...good.cases[2],args:[[{price:1,quantity:3,__proto__:null,command:'delete'}]]}]},
  {...good,extra:'require("child_process")'}
 ])assert.throws(()=>D.parseDraftVectors(JSON.stringify(c)),/TEST_VECTOR_/);
 for(const raw of ['not-json','[]','null','{"export":"total"}','a'.repeat(7000)])
  assert.throws(()=>D.parseDraftVectors(raw),/TEST_VECTOR_/);
});
test('test script is trusted template with no evaluated model code',()=>{
 const text=D.renderDraftTest({file:W.FIXTURE_FILE,mode:'FIXTURE'},good);
 assert.match(text,/Qwen draft:/);
 assert.match(text,/assert\.deepStrictEqual/);
 assert.match(text,/require\("\.\.\/\.\.\/ops\/imperion-dev-cloud-fixture\/normalize\.cjs"\)/);
 assert.doesNotMatch(text,/execSync|child_process|GITHUB_TOKEN|eval\(/);
 const bad={...good,cases:[{...good.cases[0],name:'x"); process.exit(1);//'},...good.cases.slice(1)]};
 assert.throws(()=>D.parseDraftVectors(JSON.stringify(bad)),/TEST_VECTOR_/);
 assert.throws(()=>D.renderDraftTest({mode:'OWNER_ISSUE',file:W.FIXTURE_FILE},good),/SOURCE_SCOPE/);
});
test('only original anchored source SHA allows advisory draft',()=>{
 const {root,source,proof}=fixture();
 try{
  assert.match(D.checkPreviewProof(proof,source),/row\.price \* row\.quantity/);
  assert.throws(()=>D.checkPreviewProof({...proof,source_sha256:'0'.repeat(64)},source),/PROOF_MISMATCH/);
  assert.throws(()=>D.checkPreviewProof({...proof,task:{...proof.task,file:'scripts/payment.cjs'}},source),/PROOF_MISMATCH/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('mocked Qwen creates temporary review test; trusted baseline is not rewritten',async()=>{
 const {root,proof}=fixture();
 const before=fs.readFileSync(path.join(root,W.FIXTURE_FILE),'utf8');
 let calls=0;
 try{
  const result=await D.writePreview(proof,root,async(_url,opts)=>{
   calls++;
   assert.equal(JSON.parse(opts.body).model,W.MODEL);
   assert.match(JSON.parse(opts.body).prompt,/sum \+ row\.price \* row\.quantity/);
   return {ok:true,redirected:false,json:async()=>({done:true,model:W.MODEL,
    response:JSON.stringify(good)})};
  });
  assert.equal(calls,1);
  assert.equal(result.status,'UNTRUSTED_TEST_DRAFT_ONLY');
  assert.equal(result.paid_api_czk,0);
  assert.equal(fs.readFileSync(path.join(root,W.FIXTURE_FILE),'utf8'),before);
  const generated=fs.readFileSync(path.join(root,D.DEST),'utf8');
  assert.match(generated,/two_rows/);
  assert.throws(()=>fs.writeFileSync(path.join(root,D.DEST),'overwrite',{flag:'wx'}),/EEXIST/);
  // Running against the deliberately broken original must FAIL, proving non-triviality.
  const baseline=child.spawnSync(process.execPath,['--test',D.DEST],{cwd:root,encoding:'utf8',timeout:10000});
  assert.notEqual(baseline.status,0);
  // A validated patch makes the exact generated test pass.
  const changed=W.applyCandidate(before,proof.patch);
  fs.writeFileSync(path.join(root,W.FIXTURE_FILE),changed);
  const passing=child.spawnSync(process.execPath,['--test',D.DEST],{cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(passing.status,0,passing.stderr);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('invalid model output gets one bounded retry and no test file without passing schema',async()=>{
 const {root,proof}=fixture();
 let n=0;
 try{
  const result=await D.writePreview(proof,root,async()=>({
   ok:true,redirected:false,json:async()=>({done:true,model:W.MODEL,
    response:JSON.stringify((++n===1)?{...good,cases:[good.cases[0]]}:good)})}));
  assert.equal(n,2);
  assert.equal(result.model_invocations,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 const f=fixture();n=0;
 try{
  await assert.rejects(D.writePreview(f.proof,f.root,async()=>({
   ok:true,redirected:false,json:async()=>({done:true,model:W.MODEL,
    response:JSON.stringify({export:'total',cases:[good.cases[0]]})})})),/TEST_VECTOR_/);
  assert.equal(fs.existsSync(path.join(f.root,D.DEST)),false);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('workflow runs advisory draft only in pull-request preview, cannot auto-merge',()=>{
 const y=fs.readFileSync(path.join(__dirname,'../.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
 assert.match(y,/Generate advisory Qwen test vectors on public synthetic PR preview/);
 assert.match(y,/UNTRUSTED_TEST_DRAFT_ONLY/);
 assert.match(y,/--network none --read-only --cap-drop ALL/);
 assert.doesNotMatch(y,/git push origin main|gh pr merge|auto-merge: true/);
});
