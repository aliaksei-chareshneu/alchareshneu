'use strict';
// Existing Developer Agent #1: conservative, durable FREE inference admission.
// GitHub Actions history is the reservation source; no separate CRM or DB.
const fs=require('node:fs');
const policy=require('./imperion-dev-model-policy.cjs');
const REPO='aliaksei-chareshneu/alchareshneu';
const WORKFLOW='imperion-dev-cloud-issue.yml';
const ACTIVATED_UTC='2026-11-14T18:00:00Z';
// Eight controlled review-only runs at <=20k estimated tokens each give a
// software ceiling of <=160k reserved tokens/24h, below Groq's published
// 200k TPD reference for GPT-OSS120B; provider/account limits may be lower.
const MAX_GROQ_WORKFLOW_RUNS_24H=8;
const PREVIEW_NO_MODEL_AFTER='2026-11-15T06:54:27Z';
const MAX_HISTORY_PAGES=3;
function reject(s){throw Error(s)}
function gateEnv(env){
 if(env.IMPERION_DEV_PROVIDER==='ollama')return false;
 policy.assertRuntimeAccess(env);
 if(env.GITHUB_RUN_ATTEMPT!=='1'||!/^\d{5,20}$/.test(env.GITHUB_RUN_ID||'')||
    !env.GITHUB_TOKEN||!env.GITHUB_ENV||!env.GITHUB_STEP_SUMMARY||
    !env.RUNNER_TEMP)reject('GROQ_QUOTA_GITHUB_CONTEXT_REQUIRED');
 return true;
}
async function admit(env=process.env,fetcher=globalThis.fetch,now=Date.now()){
 if(!gateEnv(env))return {status:'LOCAL_OLLAMA_NO_GROQ_QUOTA'};
 const cutoff=Math.max(now-86400000,Date.parse(ACTIVATED_UTC));
 const since=new Date(cutoff).toISOString().slice(0,10);
 const runs=[];
 let total=null;
 for(let page=1;page<=MAX_HISTORY_PAGES;page++){
  const url='https://api.github.com/repos/'+REPO+'/actions/workflows/'+WORKFLOW+
   '/runs?per_page=100&created='+encodeURIComponent('>='+since)+'&page='+page;
  let response;
  try{response=await fetcher(url,{method:'GET',redirect:'error',credentials:'omit',
   headers:{authorization:'Bearer '+env.GITHUB_TOKEN,
    accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'},
   signal:AbortSignal.timeout(12000)})}
  catch{reject('GROQ_QUOTA_HISTORY_UNAVAILABLE')}
  if(!response?.ok||response.redirected)reject('GROQ_QUOTA_GITHUB_HTTP_REJECTED');
  let payload;
  try{payload=await response.json()}catch{reject('GROQ_QUOTA_GITHUB_INVALID')}
  if(!Array.isArray(payload?.workflow_runs)||!Number.isSafeInteger(payload.total_count)||
     payload.total_count<0||payload.workflow_runs.length>100)
   reject('GROQ_QUOTA_GITHUB_INCOMPLETE');
  if(total===null)total=payload.total_count;
  // Counts may grow when other public PR previews start; never use an
  // inconsistent pagination snapshot to admit paid-provider opportunities.
  if(payload.total_count!==total)reject('GROQ_QUOTA_HISTORY_CHANGED');
  runs.push(...payload.workflow_runs);
  if(runs.length>=total)break;
  if(payload.workflow_runs.length!==100)reject('GROQ_QUOTA_HISTORY_INCOMPLETE');
 }
 if(total>MAX_HISTORY_PAGES*100||runs.length!==total||
    new Set(runs.map(x=>x.id)).size!==runs.length)
  reject('GROQ_QUOTA_GITHUB_INCOMPLETE');
 const runId=Number(env.GITHUB_RUN_ID),self=runs.find(x=>x.id===runId);
 if(!self||self.event!==env.GITHUB_EVENT_NAME||
    !Number.isFinite(Date.parse(self.created_at)))reject('GROQ_QUOTA_SELF_NOT_VERIFIED');
 const started=Date.parse(self.created_at);
 if(started<cutoff)reject('GROQ_QUOTA_STALE_RUN_REJECTED');
 const prior=runs.filter(x=>x.id!==runId&&
   (x.event==='issue_comment'||
    (x.event==='pull_request'&&
     Date.parse(x.created_at)<Date.parse(PREVIEW_NO_MODEL_AFTER)))&&
   Number.isFinite(Date.parse(x.created_at))&&
   Date.parse(x.created_at)>=cutoff&&
   (Date.parse(x.created_at)<started||
    (Date.parse(x.created_at)===started&&x.id<runId)));
 // ONLY workflows that passed the Groq quota gate actually reserved a paid-provider
 // opportunity. Old CPU-Qwen previews and blocked/failed preflight MUST NOT count.
 // We inspect GitHub provider-owned job receipts, not model-provided text.
 if(prior.length>80)reject('GROQ_QUOTA_HISTORY_TOO_MANY_RUNS');
 let admitted=0;
 for(const previous of prior){
  const jobsUrl='https://api.github.com/repos/'+REPO+'/actions/runs/'+previous.id+'/jobs?per_page=100';
  let jobsResponse;
  try{jobsResponse=await fetcher(jobsUrl,{method:'GET',redirect:'error',credentials:'omit',
   headers:{authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json',
    'x-github-api-version':'2022-11-28'},signal:AbortSignal.timeout(12000)})}
  catch{reject('GROQ_QUOTA_JOBS_HISTORY_UNAVAILABLE')}
  if(!jobsResponse?.ok||jobsResponse.redirected)reject('GROQ_QUOTA_JOBS_HTTP_REJECTED');
  let jobs;
  try{jobs=await jobsResponse.json()}catch{reject('GROQ_QUOTA_JOBS_INVALID')}
  if(!Array.isArray(jobs?.jobs)||jobs.jobs.length>=100)
   reject('GROQ_QUOTA_JOBS_INCOMPLETE');
  if(jobs.jobs.some(job=>Array.isArray(job.steps)&&job.steps.some(step=>
     step.name==='Require Free-only Groq key and provider quota (no paid fallback)'&&
     step.conclusion==='success'))){
   admitted++;
   if(admitted>=MAX_GROQ_WORKFLOW_RUNS_24H)
    reject('GROQ_FREE_DAILY_RUN_LIMIT_REACHED');
  }
 }
 return {status:'GROQ_FREE_GITHUB_QUOTA_ADMITTED',prior:admitted,
  max_runs:MAX_GROQ_WORKFLOW_RUNS_24H,
  run_id:runId,model:policy.selectedModel(env),billing_proof:'NOT_VERIFIED'};
}
async function main(){
 const env=process.env,r=await admit(env);
 if(r.status!=='GROQ_FREE_GITHUB_QUOTA_ADMITTED'){console.log(r.status);return}
 fs.appendFileSync(env.GITHUB_ENV,'IMPERION_DEV_GROQ_QUOTA_APPROVED=true\n');
 fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
  'DEV Groq free-only quota accepted: '+r.prior+' earlier workflow runs in rolling 24h; '+
  'billing not independently verified; no paid fallback.\n');
 console.log(JSON.stringify(r));
}
if(require.main===module)main().catch(e=>{
 console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'GROQ_GATE_BLOCKED');
 process.exitCode=9;
});
module.exports={REPO,WORKFLOW,ACTIVATED_UTC,PREVIEW_NO_MODEL_AFTER,MAX_HISTORY_PAGES,MAX_GROQ_WORKFLOW_RUNS_24H,admit,gateEnv};
