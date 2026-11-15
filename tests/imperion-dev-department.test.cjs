'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const D=require('../scripts/imperion-dev-department.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const rootScope='ops/imperion-dev-cloud-fixture';
const source1=rootScope+'/multi-price.cjs';
const source2=rootScope+'/multi-shipping.cjs';
const source3=rootScope+'/multi-discount.cjs';
const trusted='tests/imperion-dev-cloud-three-fixture.test.cjs';
const goal='Clarify existing full-line source comments while preserving all exports and arithmetic results.';
const command='/imperion-dev department\nscope: '+rootScope+'\ntest: '+trusted+'\ngoal: '+goal;
const evt={
 action:'created',repository:{full_name:W.REPO},
 sender:{login:'aliaksei-chareshneu'},
 issue:{number:245,state:'open',user:{login:'aliaksei-chareshneu'}},
 comment:{id:998871234,author_association:'OWNER',user:{login:'aliaksei-chareshneu'},body:command}
};
function workspace(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dev-department-'));
 for(const f of [source1,source2,source3,trusted]){
  const dest=path.join(root,f);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(__dirname,'..',f),dest);
 }
 fs.writeFileSync(path.join(root,'event.json'),JSON.stringify(evt));
 return root;
}
function mock(options={}){
 const seen=[];
 const fetchImpl=async(url,request)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/generate');
  assert.equal(request.redirect,'error');
  const msg=JSON.parse(request.body),prompt=msg.prompt;
  seen.push(prompt);
  let answer;
  if(prompt.includes('ROLE: independent PLANNER')){
   answer= options.malformedPlan?{files:[source1,'scripts/secrets.cjs'],steps:[],acceptance:'Pass independent test'}:
   {files:[source1,source2],
    steps:[
     {file:source1,change:'Clarify price fixture comment without changing executable behavior.',risk:'low'},
     {file:source2,change:'Clarify delivery fixture comment without changing exports.',risk:'low'}
    ],
    acceptance:'Existing independently maintained three-module arithmetic test must pass unchanged.'};
  }else if(prompt.includes('You are a careful coding assistant editing ONE PUBLIC')){
   const data=JSON.parse(prompt.split('SOURCE_JSON:').at(-1).trim());
   const originals={
    [source1]:'// Public synthetic fixture, not application pricing logic.',
    [source2]:'// Public synthetic fixture, not an actual shipping offer.'
   };
   assert.ok(originals[data.file],data.file);
   answer={old:originals[data.file],
    new:'// Public synthetic arithmetic helper; independent behavior remains unchanged.'};
  }else if(prompt.includes('Suggest ONLY JSON data for a human-review advisory')){
   answer={file:source1,export:'netPrice',
    cases:[{name:'positive_qty',args:[13,3],expected:39},
     {name:'zero_qty',args:[13,0],expected:0}]};
  }else if(prompt.includes('ROLE: independent REVIEWER OF CODE PROPOSAL')){
   answer=options.blockReview?{verdict:'BLOCK',findings:['Proposed change was not sufficient for the requested owner goal.'],
    checks:['Trusted test passed but code review found a blocker.']}:
   {verdict:'PASS',findings:[],checks:[
    'Independent trusted arithmetic test passed on patched source.',
    'Only comment text changed and exports remain identical.'
   ]};
  }else throw Error('MOCK_DEPT_UNKNOWN_MODEL_PROMPT');
  return {ok:true,redirected:false,json:async()=>({
   done:true,model:W.MODEL,response:JSON.stringify(answer)})};
 };
 return {fetchImpl,seen};
}
function withEvent(root,fn){
 const prior=process.env.GITHUB_EVENT_PATH;
 process.env.GITHUB_EVENT_PATH=path.join(root,'event.json');
 return Promise.resolve().then(fn).finally(()=>{
  if(prior===undefined)delete process.env.GITHUB_EVENT_PATH;
  else process.env.GITHUB_EVENT_PATH=prior;
 });
}
async function staged(root,options={}){
 const m=mock(options);
 const task=D.taskFromEvent(evt);
 const result=await D.stage(task,root,m.fetchImpl);
 return {...result,m};
}
function receipt(p){
 return {status:'AUTO_ISOLATED_TRUSTED_AND_ADVISORY_PASS',
 issue:p.task.issue,comment:p.task.comment,files:p.selected,
 independent_test:p.task.test,advisory_test:p.generated_file,
 advisory_sha256:p.generated_sha256,model:p.model,
 auto_merge:false,paid_api_czk:0,advisory_not_independent:true};
}
test('existing autonomous owner command remains compatible; department requires exact owner',()=>{
 assert.equal(A.parseCommand(evt.comment.body).department,true);
 assert.equal(D.taskFromEvent(evt).department,true);
 assert.equal(A.parseCommand(evt.comment.body.replace('department','autonomous')).department,undefined);
 assert.throws(()=>D.taskFromEvent({...evt,comment:{...evt.comment,body:evt.comment.body.replace('department','autonomous')}}),
  /DEPT_OWNER_COMMAND_REQUIRED/);
 for(const e of [
  {...evt,sender:{login:'stranger'}},
  {...evt,comment:{...evt.comment,author_association:'COLLABORATOR'}},
  {...evt,issue:{...evt.issue,pull_request:{}}},
  {...evt,action:'edited'}
 ])assert.throws(()=>D.taskFromEvent(e),/AUTO_UNTRUSTED_TRIGGER_REJECTED/);
});
test('planner, coder, trusted tests, reviewer and immutable signed plan complete end-to-end offline',async()=>{
 const root=workspace();
 try{
  await withEvent(root,async()=>{
   const {plan,proposal,m}=await staged(root);
   assert.equal(m.seen.filter(x=>x.includes('ROLE: independent PLANNER')).length,1);
   assert.equal(m.seen.filter(x=>x.includes('You are a careful coding assistant editing ONE PUBLIC')).length,2);
   assert.equal(m.seen.filter(x=>x.includes('Suggest ONLY JSON data')).length,1);
   assert.deepEqual(plan.selected,[source1,source2]);
   assert.deepEqual(proposal.selected,plan.selected);
   assert.equal(plan.auto_merge,false);
   assert.equal(A.verifyManifest(proposal,root).updates.length,2);
   const base={...process.env};delete base.NODE_TEST_CONTEXT;
   const baseline=cp.spawnSync(process.execPath,['--test',trusted],
    {cwd:root,env:base,encoding:'utf8',timeout:18000});
   assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
   const patched=workspace();
   try{
    A.apply(proposal,patched);
    const proof=cp.spawnSync(process.execPath,['--test',trusted,proposal.generated_file],
     {cwd:patched,env:base,encoding:'utf8',timeout:18000});
    assert.equal(proof.status,0,proof.stdout+proof.stderr);
    assert.match(proof.stdout,/# fail 0/);
   }finally{fs.rmSync(patched,{recursive:true,force:true})}
   const qa=receipt(proposal);
   const docs={plan,proposal,qa};
   for(const [k,v] of Object.entries(docs)){
    const name={plan:D.PLAN_FILE,proposal:D.PROPOSAL_FILE,qa:D.QA_FILE}[k];
    fs.writeFileSync(path.join(root,name),JSON.stringify(v));
   }
   assert.equal(D.verifyProof(plan,proposal,qa,root).updates.length,2);
   const out=await D.review(root,root,m.fetchImpl);
   assert.equal(m.seen.filter(x=>x.includes('ROLE: independent REVIEWER')).length,1);
   assert.equal(out.status,'DEPARTMENT_REVIEW_PASS');
   assert.equal(out.independent_trusted_test_passed,true);
   assert.equal(out.reviewer_is_same_provider,true);
   assert.equal(out.auto_merge,false);
   fs.writeFileSync(path.join(root,D.REVIEW_FILE),JSON.stringify(out));
   assert.equal(D.verifyDirectory(root,root).issue,245);
   assert.throws(()=>D.verifyReview(plan,proposal,qa,{...out,plan_sha256:'bad'},root),
    /DEPT_REVIEW_PROOF_REJECTED/);
   assert.throws(()=>D.verifyReview(plan,proposal,qa,{...out,verdict:'BLOCK'},root),
    /DEPT_REVIEW_PROOF_REJECTED/);
   assert.throws(()=>D.verifyProof(plan,{...proposal,selected:[source2,source1]},qa,root),
    /AUTO_|DEPT_/);
  });
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('untrusted planning, changed source and reviewer block fail closed',async()=>{
 const root=workspace();
 try{
  await withEvent(root,async()=>{
   await assert.rejects(()=>staged(root,{malformedPlan:true}),/DEPT_PLAN_|AUTO_FILE_SELECTION_REJECTED/);
   const {plan,proposal}=await staged(root);
   fs.appendFileSync(path.join(root,source1),'// altered after planning\n');
   assert.throws(()=>D.verifyPlan(plan,root),/DEPT_PLAN_SOURCE_CHANGED/);
   fs.writeFileSync(path.join(root,source1),
    fs.readFileSync(path.join(__dirname,'..',source1)));
   fs.writeFileSync(path.join(root,D.PLAN_FILE),JSON.stringify(plan));
   fs.writeFileSync(path.join(root,D.PROPOSAL_FILE),JSON.stringify(proposal));
   fs.writeFileSync(path.join(root,D.QA_FILE),JSON.stringify(receipt(proposal)));
   const blocking=await D.review(root,root,mock({blockReview:true}).fetchImpl);
   assert.equal(blocking.status,'DEPARTMENT_REVIEW_BLOCK');
   assert.throws(()=>D.verifyReview(plan,proposal,receipt(proposal),blocking,root),
    /DEPT_REVIEW_PROOF_REJECTED/);
   assert.throws(()=>D.validateReviewData({verdict:'PASS',findings:['Known code blocker'],
    checks:['Rejected a security problem.']}),/DEPT_REVIEW_UNRESOLVED_FINDINGS/);
   assert.throws(()=>D.validateReviewData({verdict:'BLOCK',findings:['Bearer sk-proj-X'],
    checks:['Rejected secrets.']}),/DEPT_UNSAFE_TEXT_REJECTED/);
  });
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('department workflow requires independent Docker, reviewed receipt, draft-only publisher',()=>{
 const yaml=fs.readFileSync(path.join(__dirname,'../.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
 const qa=yaml.indexOf('Independently verify autonomous patch and advisory test in no-network Docker');
 const review=yaml.indexOf('Independent-from-coder advisory reviewer after trusted QA');
 const upload=yaml.indexOf('Retain bounded public review proof for 3 days');
 const publish=yaml.indexOf('Publish only verified autonomous code and advisory test as a bot Draft PR');
 assert.ok(qa>=0&&qa<review&&review<upload&&upload<publish);
 assert.match(yaml,/imperion-dev-department\.cjs --check-event/);
 assert.match(yaml,/imperion-dev-department\.cjs --stage/);
 assert.match(yaml,/imperion-dev-department\.cjs --review/);
 assert.match(yaml,/imperion-dev-department\.cjs --verify-review/);
 assert.match(yaml,/imperion-dev-department-review\.json/);
 assert.match(yaml,/--network none --read-only --cap-drop ALL/);
 assert.match(yaml,/gh pr create --draft/);
 assert.doesNotMatch(yaml,/gh pr merge|git push origin main/);
});
