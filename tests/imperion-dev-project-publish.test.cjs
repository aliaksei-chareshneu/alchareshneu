'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const P=require('../scripts/imperion-dev-project-control.cjs');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const S=require('../scripts/imperion-dev-project-publish.cjs');
const R=require('../scripts/imperion-dev-project-runner.cjs');
const src='ops/imperion-dev-cloud-fixture/multi-price.cjs';
const testFile='tests/imperion-dev-cloud-three-fixture.test.cjs';
const goal='Plan two safe public synthetic arithmetic milestones with no production writes or deployment.';
const command='/imperion-dev project\nscope: ops/imperion-dev-cloud-fixture\ntest: '+
  testFile+'\ngoal: '+goal;
const e={action:'created',repository:{full_name:W.REPO},sender:{login:'aliaksei-chareshneu'},
  issue:{number:245,state:'open',user:{login:'aliaksei-chareshneu'}},
  comment:{id:799999888,author_association:'OWNER',user:{login:'aliaksei-chareshneu'},body:command}};
const task=P.taskFromEvent(e);
const c=A.candidateSources({...task,mode:'AUTO_OWNER_ISSUE',department:true},process.cwd());
const plan=P.sealPlan(task,P.validateMilestones({milestones:[
  {goal:'Clarify public pricing comments without changing any computed results.',
   acceptance:'Existing independent arithmetic fixture passes.',files:[src]},
  {goal:'Clarify public shipping comments while preserving existing outputs.',
   acceptance:'Existing shipping behavior and trusted tests pass.',
   files:['ops/imperion-dev-cloud-fixture/multi-shipping.cjs']}
]},c,task),c);
const proposal={selected:[src],generated_file:'tests/generated/imperion-dev-project-'+
  task.project_id+'-s1.test.cjs',task:{...task,project_stage:1}};
function stageFiles(planValue=plan,proofValue={plan}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'project-publisher-'));
 fs.writeFileSync(path.join(dir,'imperion-dev-project-plan.json'),JSON.stringify(planValue));
 fs.writeFileSync(path.join(dir,'imperion-dev-project-stage-proof.json'),JSON.stringify(proofValue));
 return dir;
}
test('only review-verified Stage1 source/advisory/plan paths may be committed',()=>{
 const wanted=S.expectedPaths(plan,proposal);
 assert.deepEqual(wanted,[src,
  R.planPath(task.project_id),
  'tests/generated/imperion-dev-project-'+task.project_id+'-s1.test.cjs'].sort());
 assert.equal(S.validateDiff(wanted.slice().reverse(),wanted),true);
 assert.throws(()=>S.validateDiff([src,'secrets.env'],wanted),
  /PROJECT_PUBLISH_UNEXPECTED_DIFF/);
 assert.throws(()=>S.validateDiff([...wanted,src],wanted),
  /PROJECT_PUBLISH_UNEXPECTED_DIFF/);
 assert.throws(()=>S.expectedPaths(plan,{...proposal,selected:[src,src]}),
  /PROJECT_PUBLISH_DUPLICATE_PATH/);
 assert.ok(!W.safeSourceFile('scripts/imperion-dev-project-runner.cjs'));
 assert.ok(!W.safeSourceFile('scripts/imperion-dev-department.cjs'));
 assert.ok(!W.safeSourceFile('scripts/imperion-dev-groq-quota.cjs'));
 assert.ok(W.safeSourceFile(src));
});
test('stage 2 expected paths omit plan and retain separate named advisory file',()=>{
 const second={...proposal,selected:['ops/imperion-dev-cloud-fixture/multi-shipping.cjs'],
  generated_file:'tests/generated/imperion-dev-project-'+task.project_id+'-s2.test.cjs',
  task:{...proposal.task,project_stage:2}};
 const list=S.expectedPaths(plan,second);
 assert.equal(list.length,2);
 assert.ok(!list.includes(R.planPath(task.project_id)));
});
test('publisher rejects plan mismatch, unexpected paths and symlink surprises',()=>{
 const dir=stageFiles();
 try{
  assert.equal(S.stageArtifact(dir).plan.plan_sha256,plan.plan_sha256);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'project-publish-work-'));
  try{
   assert.equal(S.writePlan(dir,root,1),R.planPath(task.project_id));
   assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,R.planPath(task.project_id)))),
    plan);
   assert.throws(()=>S.writePlan(dir,root,1),/PROJECT_PUBLISH_PLAN_DEST_REJECTED/);
   assert.equal(S.writePlan(dir,root,2),null);
  }finally{fs.rmSync(root,{recursive:true,force:true})}
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
 const bad=stageFiles(plan,{plan:{...plan,plan_sha256:'a'.repeat(64)}});
 try{assert.throws(()=>S.stageArtifact(bad),/PROJECT_PUBLISH_PLAN_RECEIPT_MISMATCH/)}
 finally{fs.rmSync(bad,{recursive:true,force:true})}
});
test('even a syntactically valid project proof cannot publish with spoofed owner',async()=>{
 const dir=stageFiles(plan,{owner_event:e,plan,stage:1,readback:[]});
 const fake=async(url,opts)=>({
   ok:true,redirected:false,text:async()=>JSON.stringify(
    url.includes('/issues/comments/')?
     {id:task.comment,user:{login:'attacker'},author_association:'OWNER',
      issue_url:'https://api.github.com/repos/'+W.REPO+'/issues/'+task.issue,body:command}:
     {number:task.issue,state:'open',user:{login:'aliaksei-chareshneu'}})
 });
 try{
  await assert.rejects(()=>S.verifyPublish(dir,process.cwd(),e,'mock-token',fake),
   /RUNNER_OWNER_PROVENANCE_REJECTED/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
