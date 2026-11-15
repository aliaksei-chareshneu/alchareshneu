'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../scripts/imperion-dev-groq-quota.cjs');
const T=require('../scripts/imperion-dev-provider.cjs');
const now=Date.parse('2026-11-15T14:05:00Z');
const runId=1234567890;
function env(){return {
  IMPERION_DEV_PROVIDER:'groq',
  IMPERION_DEV_MODEL:'openai/gpt-oss-120b',
  GROQ_API_KEY:'SYNTHETIC',GROQ_VERIFIED_FREE_PLAN:'true',
  IMPERION_DEV_FREE_ONLY:'FREE-ONLY',
  GITHUB_REPOSITORY:'aliaksei-chareshneu/alchareshneu',
  GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_RUN_ID:String(runId),GITHUB_RUN_ATTEMPT:'1',
  GITHUB_TOKEN:'SYNTHETIC',GITHUB_ENV:'/tmp/unused',GITHUB_STEP_SUMMARY:'/tmp/unused',
  RUNNER_TEMP:'/tmp'
}}
const self={id:runId,event:'issue_comment',created_at:'2026-11-15T14:00:00Z'};
const newPreview=i=>({id:30000+i,event:'pull_request',created_at:'2026-11-15T12:00:00Z'});
const oldPreview={id:21000,event:'pull_request',created_at:'2026-11-15T06:20:00Z'};
const issue=i=>({id:22000+i,event:'issue_comment',created_at:'2026-11-15T12:40:00Z'});
function history(runs,{changed=false,confirmedIds=[21000,22001,22002]}={}){
 const logs=[],seen=[];
 const fn=async(url,options)=>{
  assert.equal(options.redirect,'error');
  assert.ok(options.headers.authorization.startsWith('Bearer '));
  const match=/\/actions\/runs\/(\d+)\/jobs/.exec(url);
  if(match){
   const id=Number(match[1]);logs.push(id);
   return {ok:true,redirected:false,json:async()=>({jobs:[
    {steps:[{name:'Require Free-only Groq key and provider quota (no paid fallback)',
      conclusion:confirmedIds.includes(id)?'success':'failure'}]}]})};
  }
  const page=Number(new URL(url).searchParams.get('page'));
  seen.push(page);
  const start=(page-1)*100;
  const subset=runs.slice(start,start+100);
  return {ok:true,redirected:false,json:async()=>({
    total_count:runs.length+(changed&&page===2?1:0),
    workflow_runs:subset})};
 };
 return {fn,logs,seen};
}
test('eight owner Free runs reserve at most 160k estimated tokens against public 200k TPD reference',()=>{
 assert.equal(Q.MAX_GROQ_WORKFLOW_RUNS_24H,8);
 assert.equal(T.MAX_RESERVATION_TOKENS,20000);
 assert.equal(T.MAX_CALLS_PER_RUN,10);
 assert.ok(Q.MAX_GROQ_WORKFLOW_RUNS_24H*T.MAX_RESERVATION_TOKENS<=160000);
 assert.ok(Q.MAX_GROQ_WORKFLOW_RUNS_24H*T.MAX_RESERVATION_TOKENS<200000);
});
test('paginated GitHub public previews do not consume Free tokens after model-free policy activation',async()=>{
 const previews=Array.from({length:145},(_,i)=>newPreview(i));
 const runs=[self,...previews,issue(1),issue(2),oldPreview];
 const f=history(runs);
 const result=await Q.admit(env(),f.fn,now);
 assert.equal(result.status,'GROQ_FREE_GITHUB_QUOTA_ADMITTED');
 assert.equal(result.prior,3);
 assert.equal(result.max_runs,8);
 assert.deepEqual(f.seen,[1,2]);
 assert.deepEqual(f.logs.sort((a,b)=>a-b),[21000,22001,22002]);
});
test('a changed/incomplete GitHub pagination snapshot blocks before any model request',async()=>{
 const previews=Array.from({length:105},(_,i)=>newPreview(i));
 const runs=[self,...previews];
 await assert.rejects(()=>Q.admit(env(),history(runs,{changed:true}).fn,now),
  /GROQ_QUOTA_HISTORY_CHANGED/);
 const huge=[self,...Array.from({length:301},(_,i)=>newPreview(i))];
 await assert.rejects(()=>Q.admit(env(),history(huge).fn,now),
  /GROQ_QUOTA_GITHUB_INCOMPLETE/);
});
test('Free cap applies to eight confirmed owner issue admissions; skipped PRs cannot bypass or be billed',async()=>{
 const runs=[self,...Array.from({length:8},(_,i)=>issue(i+1)),
 ...Array.from({length:30},(_,i)=>newPreview(i))];
 const ids=Array.from({length:8},(_,i)=>22000+i+1);
 await assert.rejects(()=>Q.admit(env(),history(runs,{confirmedIds:ids}).fn,now),
  /GROQ_FREE_DAILY_RUN_LIMIT_REACHED/);
});

test('resumed project repository_dispatch consumes same eight-run Free admission budget',async()=>{
 const dispatch=i=>({id:35000+i,event:'repository_dispatch',
  created_at:'2026-11-15T12:45:00Z'});
 const runs=[{...self,event:'repository_dispatch'},...Array.from({length:7},(_,i)=>dispatch(i+1))];
 const synthetic={...env(),GITHUB_EVENT_NAME:'repository_dispatch',GITHUB_ACTOR:'github-actions[bot]'};
 const ids=Array.from({length:7},(_,i)=>35000+i+1);
 const result=await Q.admit(synthetic,history(runs,{confirmedIds:ids}).fn,now);
 assert.equal(result.prior,7);
 const full=[{...self,event:'repository_dispatch'},...Array.from({length:8},(_,i)=>dispatch(i+1))];
 const ids8=Array.from({length:8},(_,i)=>35000+i+1);
 await assert.rejects(()=>Q.admit(synthetic,history(full,{confirmedIds:ids8}).fn,now),
  /GROQ_FREE_DAILY_RUN_LIMIT_REACHED/);
});
