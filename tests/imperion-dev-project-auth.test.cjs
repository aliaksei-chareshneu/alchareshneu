'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const D=require('../scripts/imperion-dev-department.cjs');
const P=require('../scripts/imperion-dev-project-control.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const scope='ops/imperion-dev-cloud-fixture';
const tst='tests/imperion-dev-cloud-three-fixture.test.cjs';
const owner='aliaksei-chareshneu';
const command='/imperion-dev project\nscope: '+scope+'\ntest: '+tst+
  '\ngoal: Build a safe three-stage improvement to synthetic arithmetic documentation and examples.';
const e={action:'created',repository:{full_name:W.REPO},sender:{login:owner},
  issue:{number:245,state:'open',user:{login:owner}},
  comment:{id:7788990111,author_association:'OWNER',user:{login:owner},body:command}};
const sources=[
  scope+'/multi-price.cjs',scope+'/multi-shipping.cjs',scope+'/multi-discount.cjs'
];
const milestoneData={milestones:[
  {goal:'Clarify the public synthetic price helper documentation without changing any executable lines.',
   acceptance:'The independently checked arithmetic contract stays green.',files:[sources[0]]},
  {goal:'Clarify the public synthetic shipping helper comments while keeping all exports unchanged.',
   acceptance:'The existing independent shipping contract stays green.',files:[sources[1]]},
  {goal:'Clarify the public synthetic discount helper comments without altering any exported function.',
   acceptance:'The existing discount and combined arithmetic checks pass.',files:[sources[2]]}
]};
function setup(){
  const task=P.taskFromEvent(e);
  const c=A.candidateSources({...task,department:true,mode:'AUTO_OWNER_ISSUE'},process.cwd());
  const milestones=P.validateMilestones(milestoneData,c,task);
  return {task,plan:P.sealPlan(task,milestones,c)};
}
function record(plan,stage){
  const spec=P.stageSpec(plan,stage);
  return {origin:'GITHUB_API',stage,pr:401+stage,sha:String(stage).repeat(40),
    head:spec.head,base:spec.base,marker:spec.marker,draft:true,state:'open',
    merged:false,ci:'SUCCESS'};
}
function bot(){
  return {action:'imperion-dev-project-resume',repository:{full_name:W.REPO},
    sender:{login:'github-actions[bot]'},
    client_payload:{issue:e.issue.number,comment:e.comment.id}};
}
function withProof(proof,live,fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'project-auth-'));
  const proofFile=path.join(root,'imperion-dev-project-stage-proof.json');
  const eventFile=path.join(root,'event.json');
  fs.writeFileSync(proofFile,JSON.stringify(proof));
  fs.writeFileSync(eventFile,JSON.stringify(live));
  const prev={RUNNER_TEMP:process.env.RUNNER_TEMP,
    GITHUB_EVENT_PATH:process.env.GITHUB_EVENT_PATH,
    IMPERION_DEV_PROJECT_STAGE_PROOF:process.env.IMPERION_DEV_PROJECT_STAGE_PROOF};
  process.env.RUNNER_TEMP=root;
  process.env.GITHUB_EVENT_PATH=eventFile;
  process.env.IMPERION_DEV_PROJECT_STAGE_PROOF=proofFile;
  try{return fn()}
  finally{
    for(const [k,v] of Object.entries(prev)){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
    fs.rmSync(root,{recursive:true,force:true});
  }
}
test('stage one authorized by actual owner command; no fabricated department message',()=>{
  const {plan}=setup();
  const proof={owner_event:e,plan,stage:1,readback:[]};
  const task=P.authorizeStage(proof,e,process.cwd());
  assert.equal(task.project_id,'245-7788990111');
  assert.equal(task.project_stage,1);
  assert.equal(task.goal,milestoneData.milestones[0].goal);
  assert.deepEqual(task.project_files,[sources[0]]);
  assert.equal(task.department,true);
  const live=withProof(proof,e,()=>{
    const a=A.taskFromEvent(e);
    assert.deepEqual(a,task);
    assert.deepEqual(D.taskFromEvent(e),task);
    const c=D.checkTask(task,process.cwd());
    assert.deepEqual(c.files.map(x=>x.file),[sources[0]]);
    return A.generatedPath(task);
  });
  assert.equal(live,'tests/generated/imperion-dev-project-245-7788990111-s1.test.cjs');
  assert.throws(()=>D.taskFromEvent(e),/AUTO_COMMAND_FORMAT_REJECTED/);
});
test('stage two resumes only after exact verified previous Draft PR and owner provenance',()=>{
  const {plan}=setup();
  const proof={owner_event:e,plan,stage:2,readback:[record(plan,1)]};
  const task=P.authorizeStage(proof,bot(),process.cwd());
  assert.equal(task.project_stage,2);
  assert.deepEqual(task.project_files,[sources[1]]);
  assert.equal(withProof(proof,bot(),()=>A.generatedPath(A.taskFromEvent(bot()))),
    'tests/generated/imperion-dev-project-245-7788990111-s2.test.cjs');
  assert.equal(withProof(proof,bot(),()=>D.checkTask(D.taskFromEvent(bot()),process.cwd()).files[0].file),
    sources[1]);
  const altered={...proof,readback:[{...record(plan,1),ci:'PENDING'}]};
  assert.throws(()=>P.authorizeStage(altered,bot(),process.cwd()),
    /PROJECT_AUTH_STAGE_NOT_READY/);
  assert.throws(()=>P.authorizeStage({...proof,readback:[]},bot(),process.cwd()),
    /PROJECT_AUTH_STAGE_NOT_READY/);
});
test('forged model stage, wrong GH actor, untrusted issue and altered plan stop before code',()=>{
  const {plan}=setup();
  const first={owner_event:e,plan,stage:1,readback:[]};
  const second={owner_event:e,plan,stage:2,readback:[record(plan,1)]};
  for(const b of [
    {...e,comment:{...e.comment,body:command.replace('three-stage','four-stage')}},
    {...e,sender:{login:'someone-else'}}
  ])assert.throws(()=>P.authorizeStage(first,b,process.cwd()),/PROJECT_/);
  assert.throws(()=>P.authorizeStage(second,{...bot(),sender:{login:'evil'}},process.cwd()),
    /PROJECT_AUTH_DISPATCH_REJECTED/);
  assert.throws(()=>P.authorizeStage(second,{...bot(),client_payload:{issue:1,comment:2}},process.cwd()),
    /PROJECT_AUTH_DISPATCH_REJECTED/);
  assert.throws(()=>P.authorizeStage({...first,plan:{...plan,plan_sha256:'f'.repeat(64)}},
    e,process.cwd()),/PROJECT_PLAN_TAMPERED/);
  assert.throws(()=>P.authorizeStage({...second,plan:{...plan,goal:'malicious'}},
    bot(),process.cwd()),/PROJECT_RESUME_PLAN_REJECTED/);
  assert.throws(()=>P.authorizeStage({...first,stage:5},e,process.cwd()),/PROJECT_AUTH_STAGE_REJECTED/);
});
test('proof path and stage scope cannot be supplied by arbitrary files or env',()=>{
  const {plan}=setup(),proof={owner_event:e,plan,stage:1,readback:[]};
  const task=P.authorizeStage(proof,e,process.cwd());
  assert.throws(()=>D.checkTask({...task,project_files:['scripts/secrets.cjs']},process.cwd()),
    /DEPT_PROJECT_FILE_SCOPE_REJECTED/);
  assert.throws(()=>A.generatedPath({...task,project_stage:99}),/AUTO_PROJECT_GENERATED_PATH_REJECTED/);
  assert.throws(()=>P.authorizedTaskFromEnvironment(process.cwd()),
    /PROJECT_PROOF_CONTEXT_REJECTED/);
  const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),'project-proof-'));
  try{
    process.env.IMPERION_DEV_PROJECT_STAGE_PROOF=path.join(testRoot,'evil.json');
    process.env.GITHUB_EVENT_PATH=path.join(testRoot,'event.json');
    process.env.RUNNER_TEMP=testRoot;
    assert.throws(()=>P.authorizedTaskFromEnvironment(process.cwd()),
      /PROJECT_PROOF_CONTEXT_REJECTED/);
  }finally{
    delete process.env.IMPERION_DEV_PROJECT_STAGE_PROOF;
    delete process.env.GITHUB_EVENT_PATH;
    delete process.env.RUNNER_TEMP;
    fs.rmSync(testRoot,{recursive:true,force:true});
  }
});
