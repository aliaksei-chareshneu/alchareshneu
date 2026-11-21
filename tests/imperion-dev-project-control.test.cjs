'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../scripts/imperion-dev-project-control.cjs');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const scope='ops/imperion-dev-cloud-fixture';
const trusted='tests/imperion-dev-cloud-three-fixture.test.cjs';
const source=[
  scope+'/multi-price.cjs',
  scope+'/multi-shipping.cjs',
  scope+'/multi-discount.cjs'
];
const goal='Build a three-step public synthetic arithmetic improvement with independent review at each step.';
const command='/imperion-dev project\nscope: '+scope+'\ntest: '+trusted+'\ngoal: '+goal;
const event={action:'created',repository:{full_name:W.REPO},
  sender:{login:'aliaksei-chareshneu'},
  issue:{number:245,state:'open',user:{login:'aliaksei-chareshneu'}},
  comment:{id:7712345678,author_association:'OWNER',
    user:{login:'aliaksei-chareshneu'},body:command}};
const milestones=[
  {goal:'Clarify the public pricing helper comments without changing its exported calculations.',
   acceptance:'Existing independent arithmetic fixture tests remain green.',files:[source[0]]},
  {goal:'Clarify the public shipping helper comments without changing exported behavior.',
   acceptance:'Existing trusted delivery arithmetic assertions remain green.',files:[source[1]]},
  {goal:'Clarify the public discount helper comments while preserving all current exports.',
   acceptance:'Existing trusted discount and integration assertions remain green.',files:[source[2]]}
];
const candidate=()=>A.candidateSources({...P.taskFromEvent(event),
  department:true,mode:'AUTO_OWNER_ISSUE'},process.cwd());
const make=()=>P.sealPlan(P.taskFromEvent(event),
  P.validateMilestones({milestones},candidate(),P.taskFromEvent(event)),candidate());
function record(plan,stage,ci='SUCCESS',extra={}){
  const spec=P.stageSpec(plan,stage);
  return {origin:'GITHUB_API',stage,head:spec.head,base:spec.base,
    marker:spec.marker,pr:700+stage,sha:String(stage).repeat(40),
    draft:true,merged:false,state:'open',ci,...extra};
}
function workflowRuns(sha,ci='SUCCESS'){
  return ['Site quality','IMPERION DEV cloud issue coding (review only)'].map((name,i)=>({
    id:100+i,name,head_sha:sha,event:'pull_request',status:'completed',
    conclusion:ci==='SUCCESS'?'success':'failure'
  }));
}
function fakeGitHub(plan,count=3,options={}){
  const requested=[];
  const fetcher=async(url,init)=>{
    requested.push({url,init});
    let payload;
    const stage=Number((url.match(/-s([1-4])(?:$|%)/)||[])[1]);
    if(url.includes('/pulls?')){
      const spec=P.stageSpec(plan,stage);
      payload=stage<=count?[{
        number:700+stage,user:{login:'github-actions[bot]'},
        head:{ref:spec.head,sha:String(stage).repeat(40)},
        base:{ref:spec.base},body:'Proof: '+spec.marker,
        draft:true,state:'open',merged_at:null
      }]:[];
      if(options.badSource&&stage===2)payload[0].user.login='unknown';
    }else if(url.includes('/actions/runs?')){
      const sha=new URL(url).searchParams.get('head_sha');
      payload={workflow_runs:workflowRuns(sha,options.failed?'FAILURE':'SUCCESS')};
    }else throw Error('UNEXPECTED_GITHUB_ENDPOINT');
    return {ok:true,redirected:false,text:async()=>JSON.stringify(payload)};
  };
  return {requested,fetcher};
}
test('strict owner-only project intake reuses existing safe path policy',()=>{
  const t=P.taskFromEvent(event);
  assert.equal(t.project_id,'245-7712345678');
  assert.equal(t.goal,goal);
  assert.throws(()=>P.projectCommand('/imperion-dev project\nscope: scripts/secrets\n'+
    'test: '+trusted+'\ngoal: '+goal),/AUTO_|PROJECT_/);
  assert.throws(()=>P.projectCommand(command+'\nextra: deploy'),/AUTO_|PROJECT_/);
  assert.throws(()=>P.taskFromEvent({...event,sender:{login:'stranger'}}),
    /PROJECT_OWNER_EVENT_REJECTED/);
  assert.throws(()=>P.taskFromEvent({...event,comment:{...event.comment,
    author_association:'COLLABORATOR'}}),/PROJECT_OWNER_EVENT_REJECTED/);
  assert.throws(()=>P.taskFromEvent({...event,issue:{...event.issue,pull_request:{}}}),
    /PROJECT_OWNER_EVENT_REJECTED/);
  assert.throws(()=>P.taskFromEvent({...event,action:'edited'}),
    /PROJECT_OWNER_EVENT_REJECTED/);
});
test('architect returns validated sequential stages and SHA-bound immutable plan',async()=>{
  let calls=0;
  const fetchImpl=async(_url,options)=>{
    calls++;
    const payload=JSON.parse(options.body);
    assert.match(payload.prompt,/ROLE: PROJECT ARCHITECT/);
    return {ok:true,redirected:false,json:async()=>({
      done:true,model:W.MODEL,response:JSON.stringify({milestones})
    })};
  };
  const plan=await P.makePlan(P.taskFromEvent(event),process.cwd(),fetchImpl);
  assert.equal(calls,1);
  assert.deepEqual(plan.milestones.map(x=>x.depends_on),[[],[1],[2]]);
  assert.equal(plan.milestones.length,3);
  assert.equal(plan.auto_merge,false);
  assert.equal(plan.production_deploy,false);
  assert.equal(plan.paid_api_czk,0);
  assert.ok(plan.plan_sha256.length===64);
  assert.equal(P.verifyPlan(plan,P.taskFromEvent(event),candidate()),plan);
  assert.throws(()=>P.verifyPlan({...plan,goal:'wrong'},P.taskFromEvent(event),candidate()),
    /PROJECT_PLAN_PROOF_REJECTED/);
  assert.throws(()=>P.verifyPlan({...plan,plan_sha256:'0'.repeat(64)},
    P.taskFromEvent(event),candidate()),/PROJECT_PLAN_TAMPERED/);
  assert.throws(()=>P.verifyPlan({...plan,milestones:plan.milestones.slice().reverse()},
    P.taskFromEvent(event),candidate()),/PROJECT_PLAN_TAMPERED/);
  const bad={milestones:[{...milestones[0],files:['scripts/unknown.cjs']},milestones[1]]};
  assert.throws(()=>P.validateMilestones(bad,candidate(),P.taskFromEvent(event)),
    /PROJECT_SCOPE_REJECTED/);
});
test('dependant Draft PR stack resumes deterministically without duplicate jobs or merges',()=>{
  const p=make();
  const first=P.readback(p,[]);
  assert.equal(first.status,'NEXT_DRAFT_STAGE');
  assert.equal(first.stage,1);
  assert.equal(first.base,'main');
  assert.equal(first.auto_merge,false);
  const one=P.readback(p,[record(p,1)]);
  assert.equal(one.status,'NEXT_DRAFT_STAGE');
  assert.equal(one.stage,2);
  assert.equal(one.base,P.stageSpec(p,1).head);
  const two=P.readback(p,[record(p,1),record(p,2)]);
  assert.equal(two.status,'NEXT_DRAFT_STAGE');
  assert.equal(two.stage,3);
  const finished=P.readback(p,[record(p,1),record(p,2),record(p,3)]);
  assert.equal(finished.status,'DRAFT_STACK_READY_FOR_OWNER_REVIEW');
  assert.deepEqual(finished.prs,[701,702,703]);
  assert.equal(finished.production_deploy,false);
  assert.deepEqual(P.readback(p,[record(p,1),record(p,2)]),two);
  assert.throws(()=>P.readback(p,[record(p,1),record(p,1)]),
    /PROJECT_DUPLICATE_OR_UNTRUSTED_READBACK/);
  assert.equal(P.readback(p,[record(p,2)]).status,'BLOCKED_OUT_OF_ORDER');
});
test('quota, CI pending/failure, retarget, merge and changed SHA fail closed',()=>{
  const p=make();
  assert.equal(P.readback(p,[],'EXHAUSTED').status,'PAUSED_FREE_QUOTA');
  assert.equal(P.readback(p,[record(p,1)],'EXHAUSTED').status,'PAUSED_FREE_QUOTA');
  assert.equal(P.readback(p,[record(p,1,'PENDING')]).status,'WAIT_CI');
  assert.equal(P.readback(p,[record(p,1,'FAILURE')]).status,'BLOCKED_CI');
  for(const tamper of [{base:'main-wrong'},{draft:false},{merged:true},{sha:'bad'},
    {state:'closed'},{marker:'fake'}]){
    const result=()=>P.readback(p,[record(p,1,'SUCCESS',tamper)]);
    assert.equal(result().status,'BLOCKED_PR_INTEGRITY');
  }
  assert.throws(()=>P.readback(p,[record(p,1,'UNVERIFIED')]),/PROJECT_CI_EVIDENCE_REJECTED/);
  assert.equal(P.ciFromRuns('1'.repeat(40),workflowRuns('1'.repeat(40))),'SUCCESS');
  assert.equal(P.ciFromRuns('1'.repeat(40),workflowRuns('1'.repeat(40),'FAILURE')),'FAILURE');
  assert.equal(P.ciFromRuns('1'.repeat(40),[]),'PENDING');
});
test('cross-run recovery reads the GitHub PRs and exact-SHA workflow evidence',async()=>{
  const p=make();
  const remote=fakeGitHub(p,2);
  const records=await P.githubReadback(p,remote.fetcher,'mock-test-token');
  assert.deepEqual(records.map(x=>x.stage),[1,2]);
  assert.deepEqual(records.map(x=>x.ci),['SUCCESS','SUCCESS']);
  assert.equal(P.readback(p,records).status,'NEXT_DRAFT_STAGE');
  assert.equal(P.readback(p,records).stage,3);
  assert.equal(remote.requested.filter(x=>x.url.includes('/pulls?')).length,3);
  assert.ok(remote.requested.every(x=>x.init.method==='GET' &&
    x.init.redirect==='error' && x.init.credentials==='omit'));
  const retried=await P.githubReadback(p,remote.fetcher,'mock-test-token');
  assert.deepEqual(retried,records);
  const full=fakeGitHub(p,3);
  assert.equal(P.readback(p,await P.githubReadback(p,full.fetcher,'mock-test-token')).status,
    'DRAFT_STACK_READY_FOR_OWNER_REVIEW');
});
test('untrusted or failing GitHub results never produce a ready-for-code stage',async()=>{
  const p=make();
  await assert.rejects(()=>P.githubReadback(p,fakeGitHub(p,2,{badSource:true}).fetcher,
    'mock-test-token'),/PROJECT_GITHUB_PR_PROVENANCE_REJECTED/);
  const failed=fakeGitHub(p,2,{failed:true});
  const records=await P.githubReadback(p,failed.fetcher,'mock-test-token');
  assert.equal(P.readback(p,records).status,'BLOCKED_CI');
  await assert.rejects(()=>P.githubReadback(p,async()=>({
    ok:false,redirected:false,text:async()=>''}),'mock-test-token'),
    /PROJECT_GITHUB_READ_REJECTED/);
  await assert.rejects(()=>P.githubReadback(p,async()=>({
    ok:true,redirected:false,text:async()=>'{broken'}),'mock-test-token'),
    /PROJECT_GITHUB_JSON_REJECTED/);
});
