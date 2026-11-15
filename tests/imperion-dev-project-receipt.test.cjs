'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const P=require('../scripts/imperion-dev-project-control.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const scope='ops/imperion-dev-cloud-fixture';
const trusted='tests/imperion-dev-cloud-three-fixture.test.cjs';
const goal='Plan a public two-stage fixture comments project to be reviewed through independent Docker tests.';
const ownerEvent={action:'created',repository:{full_name:W.REPO},sender:{login:'aliaksei-chareshneu'},
 issue:{number:245,state:'open',user:{login:'aliaksei-chareshneu'}},
 comment:{id:779999123,author_association:'OWNER',user:{login:'aliaksei-chareshneu'},
  body:'/imperion-dev project\nscope: '+scope+'\ntest: '+trusted+'\ngoal: '+goal}};
const task=P.taskFromEvent(ownerEvent);
const c=A.candidateSources({...task,department:true,mode:'AUTO_OWNER_ISSUE'},process.cwd());
const milestones=P.validateMilestones({milestones:[
  {goal:'Clarify only the synthetic pricing helper comments preserving all executable logic.',
   acceptance:'Existing independent price assertions still pass.',files:[scope+'/multi-price.cjs']},
  {goal:'Clarify only the synthetic shipping helper comments preserving all exported numeric results.',
   acceptance:'Existing independent shipping assertions still pass.',files:[scope+'/multi-shipping.cjs']}
]},c,task);
const plan=P.sealPlan(task,milestones,c);
const stage=1,sha='4'.repeat(40),runId=888777666;
const spec=P.stageSpec(plan,stage);
const marker='GitHub workflow receipt: run='+runId+' stage=1 sha='+sha+' plan='+plan.plan_sha256;
const pr={number:801,head:{ref:spec.head,sha},base:{ref:spec.base},
 user:{login:'github-actions[bot]'},draft:true,state:'open',merged_at:null,
 body:spec.marker+'\nPlanned stages: 2\n'+marker};
function gh(override={}){
 const run={id:runId,workflow_id:412528588,name:'IMPERION DEV cloud issue coding (review only)',
   event:'issue_comment',head_branch:'main',run_attempt:1,
   repository:{full_name:W.REPO},actor:{login:'aliaksei-chareshneu'},
   status:'completed',conclusion:'success',...override.run};
 const jobs={jobs:[
  {name:'task-preflight',status:'completed',conclusion:'success'},
  {name:'cloud-model-coding (Groq Free primary; Ollama reserve)',
   status:'completed',conclusion:'success'},
  {name:'draft-review-pr',status:'completed',conclusion:'success'}
 ]};
 const artifacts={artifacts:[
  {name:P.stageArtifactName(plan,stage,sha),expired:false,
    size_in_bytes:256,workflow_run:{id:runId}}
 ]};
 return {get:async(url)=>{
  if(url.endsWith('/actions/runs/'+runId))return run;
  if(url.endsWith('/actions/runs/'+runId+'/jobs?per_page=100'))return override.jobs||jobs;
  if(url.endsWith('/actions/runs/'+runId+'/artifacts?per_page=100'))return override.artifacts||artifacts;
  throw Error('MOCK_UNEXPECTED_URL '+url);
 },run,jobs,artifacts};
}
test('SHA-bound GitHub Actions model+QA+review artifact is accepted if PR checks are suppressed',async()=>{
 assert.match(P.stageArtifactName(plan,stage,sha),
  /imperion-dev-project-stage-245-779999123-s1-4{40}-[a-f0-9]{12}$/);
 assert.equal(await P.providerStageReceipt(pr,plan,stage,gh().get),'SUCCESS');
 const pending=gh({artifacts:{artifacts:[]}});
 assert.equal(await P.providerStageReceipt(pr,plan,stage,pending.get),'PENDING');
 const failed=gh({run:{conclusion:'failure'}});
 assert.equal(await P.providerStageReceipt(pr,plan,stage,failed.get),'FAILURE');
});
test('misbound SHA, owner, workflow, missing job or repeated marker fail closed',async()=>{
 const wrong={...pr,body:pr.body.replace('sha='+sha,'sha='+'5'.repeat(40))};
 await assert.rejects(()=>P.providerStageReceipt(wrong,plan,stage,gh().get),
  /PROJECT_RECEIPT_IDENTITY_REJECTED/);
 await assert.rejects(()=>P.providerStageReceipt({...pr,body:pr.body+'\n'+marker},plan,stage,gh().get),
  /PROJECT_RECEIPT_DUPLICATE_MARKER/);
 await assert.rejects(()=>P.providerStageReceipt(pr,plan,stage,
  gh({run:{actor:{login:'attacker'}}}).get),/PROJECT_RECEIPT_RUN_PROVENANCE_REJECTED/);
 assert.equal(await P.providerStageReceipt(pr,plan,stage,
  gh({jobs:{jobs:[{name:'task-preflight',status:'completed',conclusion:'success'}]}}).get),
  'FAILURE');
 await assert.rejects(()=>P.providerStageReceipt(pr,plan,stage,
  gh({artifacts:{artifacts:[{name:P.stageArtifactName(plan,stage,sha),
   expired:true,size_in_bytes:256,workflow_run:{id:runId}}]}}).get),
  /PROJECT_RECEIPT_ARTIFACT_INVALID/);
});
test('an explicit negative pull_request check outranks even valid provider artifact',()=>{
 assert.equal(P.ciFromRuns(sha,[{id:9,event:'pull_request',name:'Site quality',
  head_sha:sha,status:'completed',conclusion:'failure'}]),'FAILURE');
 assert.equal(P.ciFromRuns(sha,[]),'PENDING');
 assert.equal(P.ciFromRuns(sha,['Site quality',
  'IMPERION DEV cloud issue coding (review only)'].map((name,i)=>({
    id:9+i,name,event:'pull_request',head_sha:sha,status:'completed',conclusion:'success'
  }))),'SUCCESS');
});
test('actual GH REST workflow receipt replaces absent bot PR check, enabling Stage2 safely',async()=>{
 const get=gh().get;
 const fetcher=async(url,opts)=>{
  assert.equal(opts.method,'GET');
  let payload;
  if(url.includes('/pulls?'))payload=url.includes('-s1')?[pr]:[];
  else if(url.includes('/actions/runs?head_sha='))payload={workflow_runs:[]};
  else payload=await get(url);
  return {ok:true,redirected:false,text:async()=>JSON.stringify(payload)};
 };
 const records=await P.githubReadback(plan,fetcher,'mock-github-token');
 assert.equal(records.length,1);
 assert.equal(records[0].ci,'SUCCESS');
 assert.equal(records[0].ci_evidence,'ORIGIN_ACTIONS_ARTIFACT');
 assert.equal(P.readback(plan,records).status,'NEXT_DRAFT_STAGE');
 assert.equal(P.readback(plan,records).stage,2);
});

test('exact provider workflow ID, run title and stage-specific trigger prevent false acceptance',async()=>{
 await assert.rejects(()=>P.providerStageReceipt(pr,plan,1,
  gh({run:{workflow_id:1}}).get),/PROJECT_RECEIPT_RUN_PROVENANCE_REJECTED/);
 await assert.rejects(()=>P.providerStageReceipt(pr,plan,1,
  gh({run:{event:'repository_dispatch',name:'IMPERION DEV project '+
    plan.project_id+' stage 1',actor:{login:'github-actions[bot]'}}}).get),
  /PROJECT_RECEIPT_RUN_PROVENANCE_REJECTED/);
 const secondSha='5'.repeat(40),second=P.stageSpec(plan,2);
 const otherPr={...pr,head:{ref:second.head,sha:secondSha},
  base:{ref:second.base},
  body:second.marker+'\nGitHub workflow receipt: run='+runId+
   ' stage=2 sha='+secondSha+' plan='+plan.plan_sha256};
 const g=gh({run:{event:'repository_dispatch',
   name:'IMPERION DEV project '+plan.project_id+' stage 2',
   actor:{login:'github-actions[bot]'}},
  artifacts:{artifacts:[{name:P.stageArtifactName(plan,2,secondSha),
    expired:false,size_in_bytes:256,workflow_run:{id:runId}}]}});
 assert.equal(await P.providerStageReceipt(otherPr,plan,2,g.get),'SUCCESS');
 await assert.rejects(()=>P.providerStageReceipt(otherPr,plan,2,
  gh({run:{event:'repository_dispatch',actor:{login:'github-actions[bot]'}}}).get),
  /PROJECT_RECEIPT_RUN_PROVENANCE_REJECTED/);
});
