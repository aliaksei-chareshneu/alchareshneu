'use strict';
// IMPERION Developer #1: recover original owner authority and project plan from
// trusted GitHub provider readback. No new agent, DB, rights or deployment.
const fs=require('node:fs');
const path=require('node:path');
const P=require('./imperion-dev-project-control.cjs');
const A=require('./imperion-dev-autonomous.cjs');
const W=require('./imperion-dev-cloud-issue.cjs');
const MAX_JSON=100000;
const OWNER='aliaksei-chareshneu';
const REPO='aliaksei-chareshneu/alchareshneu';
const PLAN_DIR='docs/imperion-dev/projects';
function stop(s){throw Error(s)}
function planPath(projectId){
  if(!/^\d{1,12}-\d{1,15}$/.test(projectId||''))stop('RUNNER_PROJECT_ID_REJECTED');
  return PLAN_DIR+'/'+projectId+'.json';
}
function requireEnv(env){
  if(!env||!env.GITHUB_TOKEN||!env.RUNNER_TEMP||!env.GITHUB_EVENT_PATH)
    stop('RUNNER_GITHUB_CONTEXT_REQUIRED');
  return env;
}
function readEvent(env){
  const f=fs.lstatSync(env.GITHUB_EVENT_PATH);
  if(!f.isFile()||f.isSymbolicLink()||f.size>35000)stop('RUNNER_EVENT_FILE_REJECTED');
  return JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
}
async function getJson(url,token,fetcher=globalThis.fetch){
  if(typeof url!=='string'||!url.startsWith('https://api.github.com/repos/'+REPO+'/')||
     !/^https:\/\/api\.github\.com\/repos\/aliaksei-chareshneu\/alchareshneu\/[a-zA-Z0-9%?=&_./:-]+$/.test(url))
    stop('RUNNER_ENDPOINT_REJECTED');
  if(typeof token!=='string'||token.length<8)stop('RUNNER_TOKEN_CONTEXT_REJECTED');
  let response;
  try{response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',
    headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28'},signal:AbortSignal.timeout(15000)})}
  catch{stop('RUNNER_GITHUB_NETWORK_REJECTED')}
  if(!response?.ok||response.redirected)stop('RUNNER_GITHUB_HTTP_REJECTED');
  let body;
  try{body=await response.text()}catch{stop('RUNNER_GITHUB_READ_REJECTED')}
  if(Buffer.byteLength(body)>MAX_JSON)stop('RUNNER_GITHUB_BODY_TOO_LARGE');
  try{return JSON.parse(body)}catch{stop('RUNNER_GITHUB_JSON_REJECTED')}
}
async function originalOwnerEvent(issue,comment,token,fetcher=globalThis.fetch){
  if(!Number.isSafeInteger(issue)||issue<1||!Number.isSafeInteger(comment)||comment<1)
    stop('RUNNER_ORIGINAL_IDS_REJECTED');
  const base='https://api.github.com/repos/'+REPO;
  const [ownerIssue,ownerComment]=await Promise.all([
    getJson(base+'/issues/'+issue,token,fetcher),
    getJson(base+'/issues/comments/'+comment,token,fetcher)
  ]);
  if(ownerIssue.number!==issue||ownerIssue.user?.login!==OWNER||
     ownerIssue.state!=='open'||ownerIssue.pull_request||
     ownerComment.id!==comment||ownerComment.user?.login!==OWNER||
     ownerComment.author_association!=='OWNER'||
     ownerComment.issue_url!==base+'/issues/'+issue)
    stop('RUNNER_OWNER_PROVENANCE_REJECTED');
  const e={
    action:'created',repository:{full_name:REPO},sender:{login:OWNER},
    issue:{number:issue,state:'open',user:{login:OWNER}},
    comment:{id:comment,user:{login:OWNER},author_association:'OWNER',
      body:ownerComment.body}
  };
  P.taskFromEvent(e);
  return e;
}
function verifiedPlan(raw,task){
  if(!raw||raw.schema!==P.SCHEMA||raw.project_id!==task.project_id||
     raw.source_issue!==task.issue||raw.source_comment!==task.comment||
     raw.goal!==task.goal||raw.scope!==task.scope||raw.test!==task.test||
     raw.owner!==OWNER||raw.auto_merge!==false||raw.production_deploy!==false)
    stop('RUNNER_PLAN_IDENTITY_REJECTED');
  return raw;
}
async function fetchPlan(task,stage1Sha,token,fetcher=globalThis.fetch){
  if(!/^[a-f0-9]{40}$/.test(stage1Sha||''))stop('RUNNER_STAGE1_SHA_REJECTED');
  const url='https://api.github.com/repos/'+REPO+'/contents/'+planPath(task.project_id)+
    '?ref='+stage1Sha;
  const file=await getJson(url,token,fetcher);
  if(file.type!=='file'||file.encoding!=='base64'||
     typeof file.content!=='string'||file.content.length>47000||
     file.path!==planPath(task.project_id))
    stop('RUNNER_GITHUB_PLAN_FILE_REJECTED');
  let plan;
  try{
    const source=Buffer.from(file.content.replace(/\s+/g,''),'base64').toString('utf8');
    if(Buffer.byteLength(source)>35000)stop('RUNNER_PLAN_SIZE_REJECTED');
    plan=JSON.parse(source);
  }catch(e){
    if(e.message==='RUNNER_PLAN_SIZE_REJECTED')throw e;
    stop('RUNNER_PLAN_PARSE_REJECTED');
  }
  return verifiedPlan(plan,task);
}
function verifyDispatch(live){
  if(live?.action!=='imperion-dev-project-resume'||live.repository?.full_name!==REPO||
     ![OWNER,'github-actions[bot]'].includes(live.sender?.login)||
     !Number.isSafeInteger(live.client_payload?.issue)||live.client_payload.issue<1||
     !Number.isSafeInteger(live.client_payload?.comment)||live.client_payload.comment<1||
     Object.keys(live.client_payload).sort().join('|')!=='comment|issue')
    stop('RUNNER_DISPATCH_REJECTED');
  return {issue:live.client_payload.issue,comment:live.client_payload.comment};
}
async function resolveResume(live,token,fetcher=globalThis.fetch){
  const ids=verifyDispatch(live);
  const original=await originalOwnerEvent(ids.issue,ids.comment,token,fetcher);
  const task=P.taskFromEvent(original);
  // No project plan may be invented by a dispatch sender.
  const name='agent/imperion-dev-project-'+task.project_id+'-s1';
  const first=await getJson('https://api.github.com/repos/'+REPO+'/pulls?state=all&per_page=10&head='+
    encodeURIComponent(OWNER+':'+name),token,fetcher);
  if(!Array.isArray(first)||first.length!==1||first[0]?.head?.ref!==name||
     first[0]?.draft!==true||first[0]?.state!=='open'||
     first[0]?.merged_at!==null||first[0]?.user?.login!=='github-actions[bot]')
    stop('RUNNER_STAGE1_DRAFT_READBACK_REJECTED');
  const plan=await fetchPlan(task,first[0].head?.sha,token,fetcher);
  const records=await P.githubReadback(plan,fetcher,token);
  const status=P.readback(plan,records);
  if(status.status!=='NEXT_DRAFT_STAGE'||status.stage<2)
    return {status:status.status,stage:status.stage||null,task,plan,records,
      blocked:true,reason:'NO_VERIFIED_NEXT_STAGE'};
  const prior=records.find(x=>x.stage===status.stage-1);
  if(!prior||prior.ci!=='SUCCESS')stop('RUNNER_PREDECESSOR_CI_REJECTED');
  const proof={owner_event:original,plan,stage:status.stage,readback:records};
  return {status:'VERIFIED_NEXT_STAGE',stage:status.stage,base_sha:prior.sha,
    base_branch:prior.head,task,plan,records,proof,blocked:false};
}
function safeWriteProof(result,env){
  requireEnv(env);
  if(result.status!=='VERIFIED_NEXT_STAGE'||!result.proof||
     !/^[a-f0-9]{40}$/.test(result.base_sha||''))
    stop('RUNNER_CANNOT_RESUME_REJECTED');
  const name=path.resolve(env.RUNNER_TEMP,'imperion-dev-project-stage-proof.json');
  fs.writeFileSync(name,JSON.stringify(result.proof,null,2)+'\n',{flag:'wx',mode:0o600});
  fs.appendFileSync(env.GITHUB_ENV,
    'IMPERION_DEV_PROJECT_STAGE_PROOF='+name+'\n'+
    'IMPERION_DEV_PROJECT_BASE_SHA='+result.base_sha+'\n'+
    'IMPERION_DEV_PROJECT_BASE_BRANCH='+result.base_branch+'\n');
  return name;
}
async function beginProject(event,root,fetchModel){
  const task=P.taskFromEvent(event);
  const plan=await P.makePlan(task,root,fetchModel);
  const proof={owner_event:event,plan,stage:1,readback:[]};
  const authorized=P.authorizeStage(proof,event,root);
  if(authorized.project_stage!==1)stop('RUNNER_FIRST_STAGE_BLOCKED');
  return {status:'VERIFIED_FIRST_STAGE',task,plan,proof,
    stage:1,base_sha:null,blocked:false};
}
function writeFirst(result,env){
  requireEnv(env);
  if(result.status!=='VERIFIED_FIRST_STAGE'||result.stage!==1)
    stop('RUNNER_FIRST_RESULT_INVALID');
  const dir=path.resolve(env.RUNNER_TEMP);
  const planFile=path.join(dir,'imperion-dev-project-plan.json');
  const proofFile=path.join(dir,'imperion-dev-project-stage-proof.json');
  fs.writeFileSync(planFile,JSON.stringify(result.plan,null,2)+'\n',
    {flag:'wx',mode:0o600});
  fs.writeFileSync(proofFile,JSON.stringify(result.proof,null,2)+'\n',
    {flag:'wx',mode:0o600});
  fs.appendFileSync(env.GITHUB_ENV,'IMPERION_DEV_PROJECT_STAGE_PROOF='+proofFile+'\n');
  return {planFile,proofFile};
}
function validateBeforeModel(event,root){
  // Event validation must use existing independent public test, not AI text.
  const task=P.taskFromEvent(event);
  const candidates=A.candidateSources(
    {...task,mode:'AUTO_OWNER_ISSUE',department:true},root);
  if(candidates.files.length<1)stop('RUNNER_NO_PUBLIC_TESTED_SOURCES');
  return {status:'OWNER_PROJECT_PREFLIGHT_PASS',issue:task.issue,comment:task.comment,
    candidates:candidates.files.length};
}
async function cli(){
  const env=process.env,mode=process.argv[2];
  const event=readEvent(requireEnv(env));
  if(mode==='--check-owner'){
    console.log(JSON.stringify(validateBeforeModel(event,process.cwd())));
  }else if(mode==='--begin'){
    const r=await beginProject(event,process.cwd());
    writeFirst(r,env);
    console.log(JSON.stringify({status:r.status,project_id:r.plan.project_id,
      stages:r.plan.milestones.length,paid_api_czk:0,auto_merge:false}));
  }else if(mode==='--resolve'){
    const r=await resolveResume(event,env.GITHUB_TOKEN);
    if(r.blocked)stop('RUNNER_NO_READY_STAGE_'+r.status);
    safeWriteProof(r,env);
    console.log(JSON.stringify({status:r.status,stage:r.stage,base_sha:r.base_sha,
      project_id:r.plan.project_id}));
  }else stop('RUNNER_UNSUPPORTED_CLI_MODE');
}
if(require.main===module)cli().catch(e=>{
  console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'RUNNER_FAIL_CLOSED');
  process.exitCode=9;
});
module.exports={planPath,requireEnv,readEvent,getJson,originalOwnerEvent,
  verifiedPlan,fetchPlan,verifyDispatch,resolveResume,safeWriteProof,
  beginProject,writeFirst,validateBeforeModel};
