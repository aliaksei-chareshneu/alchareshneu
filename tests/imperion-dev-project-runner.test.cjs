'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const P=require('../scripts/imperion-dev-project-control.cjs');
const R=require('../scripts/imperion-dev-project-runner.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const OWNER='aliaksei-chareshneu',REPO=W.REPO,BASE='https://api.github.com/repos/'+REPO;
const scope='ops/imperion-dev-cloud-fixture',trusted='tests/imperion-dev-cloud-three-fixture.test.cjs';
const goal='Build an independent three-stage project to clarify public arithmetic helper comments while preserving every existing export and result.';
const command='/imperion-dev project\nscope: '+scope+'\ntest: '+trusted+'\ngoal: '+goal;
const origin={action:'created',repository:{full_name:REPO},sender:{login:OWNER},
  issue:{number:245,state:'open',user:{login:OWNER}},
  comment:{id:777123456,author_association:'OWNER',user:{login:OWNER},body:command}};
const task=P.taskFromEvent(origin);
const milestones=[
  {goal:'Clarify existing public price helper comments while keeping all exports and behavior unchanged.',
   acceptance:'Existing independent arithmetic checks pass unchanged.',
   files:[scope+'/multi-price.cjs']},
  {goal:'Clarify existing public shipping helper comments while retaining original numeric outputs.',
   acceptance:'Existing public shipping tests remain passing.',
   files:[scope+'/multi-shipping.cjs']},
  {goal:'Clarify existing public discount helper comments while preserving original exports and calculations.',
   acceptance:'Existing public discount fixture assertions remain passing.',
   files:[scope+'/multi-discount.cjs']}
];
const candidates=A.candidateSources({...task,mode:'AUTO_OWNER_ISSUE',department:true},process.cwd());
function plan(){
  return P.sealPlan(task,P.validateMilestones({milestones},candidates,task),candidates);
}
function mock(p,options={}){
  const seen=[];
  const dispatch={action:'imperion-dev-project-resume',repository:{full_name:REPO},
    sender:{login:'github-actions[bot]'},
    client_payload:{issue:task.issue,comment:task.comment,stage:2}};
  const response=(value,code=200)=>({ok:code===200,redirected:false,
    text:async()=>JSON.stringify(value)});
  const fetcher=async(url,init)=>{
    seen.push({url,init});
    if(url===BASE+'/issues/'+task.issue)
      return response({number:task.issue,state:'open',user:{login:OWNER}});
    if(url===BASE+'/issues/comments/'+task.comment)
      return response({id:task.comment,user:{login:options.badOwner?'attacker':OWNER},
        author_association:'OWNER',issue_url:BASE+'/issues/'+task.issue,body:command});
    if(url.includes('/contents/')){
      const [name,rawref]=url.split('?ref=');
      assert.equal(name,BASE+'/contents/'+R.planPath(task.project_id));
      assert.equal(rawref,'1'.repeat(40));
      return response({type:'file',path:R.planPath(task.project_id),
        encoding:'base64',content:Buffer.from(JSON.stringify(options.badPlan?
          {...p,goal:'unrelated'}:p)).toString('base64')});
    }
    if(url.includes('/pulls?')){
      const n=Number((decodeURIComponent(url).match(/-s([1-4])$/)||[])[1]);
      const spec=P.stageSpec(p,n);
      return response(n>1?[]:[{
        number:401,user:{login:'github-actions[bot]'},
        head:{ref:spec.head,sha:'1'.repeat(40)},
        base:{ref:spec.base},body:'Evidence: '+spec.marker,
        draft:!options.nondraft,state:'open',merged_at:null
      }]);
    }
    if(url.includes('/actions/runs?')){
      const sha=new URL(url).searchParams.get('head_sha');
      return response({workflow_runs:[
        {name:'IMPERION DEV cloud issue coding (review only)',id:500,
          head_sha:sha,event:'pull_request',status:'completed',
          conclusion:'success'},
        ...(!options.missingSite?[{name:'Site quality',id:501,
          head_sha:sha,event:'pull_request',status:'completed',
          conclusion:options.failSite?'failure':'success'}]:[])
      ]});
    }
    throw Error('MOCK_UNKNOWN_ENDPOINT '+url);
  };
  return {fetcher,dispatch,seen};
}
test('project intake validates existing owner and independent test before model',()=>{
  assert.deepEqual(R.validateBeforeModel(origin,process.cwd()),{
    status:'OWNER_PROJECT_PREFLIGHT_PASS',issue:task.issue,
    comment:task.comment,candidates:3
  });
  assert.equal(R.planPath(task.project_id),
    'docs/imperion-dev/projects/245-777123456.json');
  assert.throws(()=>R.planPath('../other'),/RUNNER_PROJECT_ID_REJECTED/);
  assert.throws(()=>R.validateBeforeModel({...origin,sender:{login:'attacker'}},process.cwd()),
    /PROJECT_OWNER_EVENT_REJECTED/);
});
test('the existing GPT-OSS model architect prepares a sealed first milestone, never a merge',async()=>{
  let calls=0;
  const model=async(_url,options)=>{
    calls++;
    assert.match(JSON.parse(options.body).prompt,/PROJECT ARCHITECT/);
    return {ok:true,redirected:false,json:async()=>({
      done:true,model:W.MODEL,response:JSON.stringify({milestones})
    })};
  };
  const start=await R.beginProject(origin,process.cwd(),model);
  assert.equal(calls,1);
  assert.equal(start.status,'VERIFIED_FIRST_STAGE');
  assert.equal(start.plan.milestones.length,3);
  assert.equal(start.proof.stage,1);
  assert.equal(start.proof.plan.auto_merge,false);
  assert.equal(start.proof.plan.production_deploy,false);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'project-runner-'));
  try{
    const env={GITHUB_TOKEN:'mock-free-only-token',RUNNER_TEMP:dir,
      GITHUB_EVENT_PATH:path.join(dir,'event.json'),GITHUB_ENV:path.join(dir,'job.env')};
    const dest=R.writeFirst(start,env);
    assert.equal(JSON.parse(fs.readFileSync(dest.planFile)).plan_sha256,
      start.plan.plan_sha256);
    assert.equal(JSON.parse(fs.readFileSync(dest.proofFile)).stage,1);
    assert.match(fs.readFileSync(env.GITHUB_ENV,'utf8'),/IMPERION_DEV_PROJECT_STAGE_PROOF/);
    assert.throws(()=>R.writeFirst(start,env),/EEXIST/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('repository dispatch recovers exact original owner command, plan and GitHub CI',async()=>{
  const p=plan(),m=mock(p),r=await R.resolveResume(m.dispatch,'mock-free-only-token',m.fetcher);
  assert.equal(r.status,'VERIFIED_NEXT_STAGE');
  assert.equal(r.stage,2);
  assert.equal(r.base_sha,'1'.repeat(40));
  assert.equal(r.base_branch,P.stageSpec(p,1).head);
  assert.equal(r.task.project_id,task.project_id);
  assert.equal(r.proof.owner_event.comment.body,command);
  assert.equal(r.proof.readback[0].ci,'SUCCESS');
  assert.equal(P.authorizeStage(r.proof,m.dispatch,process.cwd()).project_stage,2);
  assert.ok(m.seen.every(x=>x.init.method==='GET'&&x.init.redirect==='error'));
  assert.ok(m.seen.every(x=>x.init.headers.authorization==='Bearer mock-free-only-token'));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'project-runner-'));
  try{
    const env={GITHUB_TOKEN:'mock-free-only-token',RUNNER_TEMP:dir,
      GITHUB_EVENT_PATH:path.join(dir,'event.json'),GITHUB_ENV:path.join(dir,'job.env')};
    R.safeWriteProof(r,env);
    const saved=JSON.parse(fs.readFileSync(path.join(dir,'imperion-dev-project-stage-proof.json')));
    assert.deepEqual(saved,r.proof);
    assert.match(fs.readFileSync(env.GITHUB_ENV,'utf8'),/IMPERION_DEV_PROJECT_BASE_SHA=1111/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('missing PR CI, failing Site Quality or missing Draft means no duplicate/model call',async()=>{
  const p=plan();
  for(const scenario of [{missingSite:true,status:'WAIT_CI'},
    {failSite:true,status:'BLOCKED_CI'}]){
    const m=mock(p,scenario);
    const r=await R.resolveResume(m.dispatch,'mock-free-only-token',m.fetcher);
    assert.equal(r.blocked,true);
    assert.equal(r.status,scenario.status);
    assert.throws(()=>R.safeWriteProof(r,{}),/RUNNER_GITHUB_CONTEXT_REQUIRED/);
  }
  const m=mock(p,{nondraft:true});
  await assert.rejects(()=>R.resolveResume(m.dispatch,'mock-free-only-token',m.fetcher),
    /RUNNER_STAGE1_DRAFT_READBACK_REJECTED/);
});
test('failed owner provenance, wrong plan and untrusted external endpoint stop',async()=>{
  const p=plan();
  for(const kind of [{badOwner:true,error:'RUNNER_OWNER_PROVENANCE_REJECTED'},
    {badPlan:true,error:'RUNNER_PLAN_IDENTITY_REJECTED'}]){
    const m=mock(p,kind);
    await assert.rejects(()=>R.resolveResume(m.dispatch,'mock-free-only-token',m.fetcher),
      new RegExp(kind.error));
  }
  const m=mock(p);
  await assert.rejects(()=>R.resolveResume({...m.dispatch,sender:{login:'attacker'}},
    'mock-free-only-token',m.fetcher),/RUNNER_DISPATCH_REJECTED/);
  await assert.rejects(()=>R.getJson('https://untrusted.example/test','mock-token',m.fetcher),
    /RUNNER_ENDPOINT_REJECTED/);
  await assert.rejects(()=>R.getJson(BASE+'/issues/1','bad',m.fetcher),
    /RUNNER_TOKEN_CONTEXT_REJECTED/);
});
