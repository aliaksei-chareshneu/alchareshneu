'use strict';
// Existing Developer #1: one bounded, read-only Project PR scan per scheduled run.
// POST dispatch only (never a code edit, merge, payment or deployment).
const R=require('./imperion-dev-project-runner.cjs');
const W=require('./imperion-dev-cloud-issue.cjs');
const BASE='https://api.github.com/repos/'+W.REPO;
const OWNER='aliaksei-chareshneu';
function block(s){throw Error(s)}
function candidateProjects(pulls){
 if(!Array.isArray(pulls)||pulls.length>=100)block('PROJECT_WATCH_INCOMPLETE_LIST');
 const map=new Map();
 for(const p of pulls){
  const m=/^agent\/imperion-dev-project-(\d{1,12})-(\d{1,15})-s([1-4])$/.exec(p.head?.ref||'');
  if(!m)continue;
  const id=m[1]+'-'+m[2],stage=Number(m[3]);
  if(p.user?.login!=='github-actions[bot]'||
     p.head?.repo?.full_name!==W.REPO||
     p.draft!==true||p.state!=='open'||p.merged_at!==null||
     typeof p.body!=='string'||!p.body.includes('imperion-dev-project:'+id+' stage:'+stage+' plan:'))
    continue;
  const expectedBase=stage===1?'main':'agent/imperion-dev-project-'+id+'-s'+(stage-1);
  if(p.base?.ref!==expectedBase)continue;
  if(!map.has(id))map.set(id,new Map());
  const stages=map.get(id);
  if(stages.has(stage)){stages.set(stage,null);continue}
  stages.set(stage,p);
 }
 const ready=[];
 for(const [id,stages] of map){
  const first=stages.get(1);
  if(!first)continue;
  const found=/^Planned stages: ([2-4])$/m.exec(first.body);
  if(!found)continue;
  const total=Number(found[1]);
  if([...stages.keys()].some(s=>s>total)||[...stages.values()].some(v=>!v))
   continue;
  let missing=0;
  for(let n=2;n<=total;n++){
   if(!stages.has(n)){missing=n;break}
  }
  if(!missing)continue;
  if([...stages.keys()].some(s=>s>missing))continue;
  const [issue,comment]=id.split('-').map(Number);
  if(!Number.isSafeInteger(issue)||!Number.isSafeInteger(comment))continue;
  ready.push({issue,comment,stage:missing,project_id:id,origin_pr:first.number});
 }
 return ready.sort((a,b)=>a.issue-b.issue||a.comment-b.comment).slice(0,10);
}
const MAX_STAGE_ATTEMPTS=2;
const RETRY_COOLDOWN_MS=24*60*60*1000;
const MAX_HISTORY_PAGES=40, HISTORY_PAGE_SIZE=5;
const MAX_OPEN_PULL_PAGES=25, OPEN_PULL_PAGE_SIZE=4;
function runTitle(c){
 return 'IMPERION DEV project '+c.project_id+' stage '+c.stage;
}
function gateAttempts(candidate,runs,now){
 if(!Array.isArray(runs)||!Number.isFinite(now))
  block('PROJECT_WATCH_HISTORY_INVALID');
 const relevant=runs.filter(x=>x &&
  x.workflow_id===412528588 &&
  x.name===runTitle(candidate) &&
  x.display_title===runTitle(candidate) &&
  x.event==='repository_dispatch' &&
  x.actor?.login==='github-actions[bot]' &&
  x.repository?.full_name===W.REPO &&
  x.head_branch==='main');
 if(relevant.some(x=>!Number.isSafeInteger(x.id)||
    !Number.isFinite(Date.parse(x.created_at||''))||
    Date.parse(x.created_at)>now+60000 ||
    !['queued','in_progress','completed','waiting','pending','requested'].includes(x.status)))
  block('PROJECT_WATCH_HISTORY_UNTRUSTED');
 if(new Set(relevant.map(x=>x.id)).size!==relevant.length)
  block('PROJECT_WATCH_DUPLICATE_HISTORY');
 const sorted=relevant.slice().sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 if(relevant.length>=MAX_STAGE_ATTEMPTS)
  return {status:'BLOCKED_STAGE_RETRY_LIMIT',attempts:relevant.length};
 if(relevant.some(x=>x.status!=='completed'))
  return {status:'WAIT_EXISTING_STAGE_RUN',attempts:relevant.length};
 if(relevant.some(x=>x.conclusion==='success'))
  return {status:'BLOCKED_SUCCESS_WITHOUT_DRAFT',attempts:relevant.length};
 if(relevant.some(x=>!['failure','cancelled','timed_out'].includes(x.conclusion)))
  return {status:'BLOCKED_UNKNOWN_STAGE_RESULT',attempts:relevant.length};
 if(sorted.length>0&&now-Date.parse(sorted[0].created_at)<RETRY_COOLDOWN_MS)
  return {status:'PAUSED_STAGE_RETRY_COOLDOWN',attempts:relevant.length};
 return {status:'ELIGIBLE_STAGE_ATTEMPT',attempts:relevant.length};
}
async function readRunHistory(token,fetcher=globalThis.fetch){
 const url=BASE+'/actions/workflows/imperion-dev-cloud-issue.yml/runs?event=repository_dispatch&per_page='+
  HISTORY_PAGE_SIZE;
 const runs=[];
 let expectedTotal=null;
 for(let page=1;page<=MAX_HISTORY_PAGES;page++){
  const result=await R.getJson(url+'&page='+page,token,fetcher);
  if(!Array.isArray(result?.workflow_runs)||
     !Number.isSafeInteger(result.total_count)||result.total_count<0||
     result.workflow_runs.length>HISTORY_PAGE_SIZE)
   block('PROJECT_WATCH_INCOMPLETE_HISTORY');
  if(expectedTotal===null)expectedTotal=result.total_count;
  if(result.total_count!==expectedTotal)
   block('PROJECT_WATCH_MOVING_HISTORY');
  runs.push(...result.workflow_runs);
  if(runs.length===expectedTotal)break;
  if(result.workflow_runs.length!==HISTORY_PAGE_SIZE)
   block('PROJECT_WATCH_INCOMPLETE_HISTORY');
 }
 if(runs.length!==expectedTotal||new Set(runs.map(x=>x.id)).size!==runs.length)
  block('PROJECT_WATCH_HISTORY_LIMIT_REACHED');
 return runs;
}
async function readOpenPulls(token,fetcher=globalThis.fetch){
 const all=[];
 for(let page=1;page<=MAX_OPEN_PULL_PAGES;page++){
  const items=await R.getJson(BASE+'/pulls?state=open&per_page='+OPEN_PULL_PAGE_SIZE+
    '&page='+page,token,fetcher);
  if(!Array.isArray(items)||items.length>OPEN_PULL_PAGE_SIZE)
   block('PROJECT_WATCH_PULLS_PAGE_INVALID');
  all.push(...items);
  if(items.length<OPEN_PULL_PAGE_SIZE)break;
 }
 if(all.length>=MAX_OPEN_PULL_PAGES*OPEN_PULL_PAGE_SIZE||
    new Set(all.map(p=>p.number)).size!==all.length)
  block('PROJECT_WATCH_PULLS_INCOMPLETE_OR_DUPLICATE');
 return all;
}
async function dispatchOne(token,fetcher=globalThis.fetch,now=Date.now()){
 if(typeof token!=='string'||token.length<8)block('PROJECT_WATCH_AUTH_REJECTED');
 const list=await readOpenPulls(token,fetcher);
 const candidates=candidateProjects(list);
 if(!candidates.length)return {status:'NO_ELIGIBLE_DRAFT_PROJECT'};
 const history=await readRunHistory(token,fetcher);
 let next=null;
 const deferred=[];
 for(const candidate of candidates){
  const gate=gateAttempts(candidate,history,now);
  if(gate.status==='ELIGIBLE_STAGE_ATTEMPT'){next=candidate;break}
  deferred.push({project_id:candidate.project_id,stage:candidate.stage,
   status:gate.status,attempts:gate.attempts});
 }
 if(!next)return {status:'NO_ELIGIBLE_STAGE_AFTER_HISTORY_CHECK',
  deferred,auto_merge:false,paid_api_czk:0};
 const payload={event_type:'imperion-dev-project-resume',
  client_payload:{issue:next.issue,comment:next.comment,stage:next.stage}};
 let res;
 try{res=await fetcher(BASE+'/dispatches',{
  method:'POST',redirect:'error',credentials:'omit',
  headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json',
    'content-type':'application/json','x-github-api-version':'2022-11-28'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
 })}catch{block('PROJECT_WATCH_DISPATCH_NETWORK_BLOCKED')}
 if(res?.status!==204||res.redirected)block('PROJECT_WATCH_DISPATCH_NOT_ACCEPTED');
 return {status:'DISPATCH_ACCEPTED_PENDING_LIVE_READBACK',project_id:next.project_id,
  estimated_stage:next.stage,owner_review_required:true,
  auto_merge:false,paid_api_czk:0};
}
async function cli(){
 if(process.argv[2]!=='--watch'||process.env.GITHUB_EVENT_NAME!=='schedule'||
    process.env.GITHUB_REPOSITORY!==W.REPO||!process.env.GITHUB_TOKEN)
  block('PROJECT_WATCH_SCHEDULE_CONTEXT_REQUIRED');
 const result=await dispatchOne(process.env.GITHUB_TOKEN);
 console.log(JSON.stringify(result));
}
if(require.main===module)cli().catch(e=>{
 console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'PROJECT_WATCH_FAIL_CLOSED');
 process.exitCode=9;
});
module.exports={candidateProjects,dispatchOne,runTitle,gateAttempts,readRunHistory,readOpenPulls,
 MAX_STAGE_ATTEMPTS,RETRY_COOLDOWN_MS,OPEN_PULL_PAGE_SIZE,HISTORY_PAGE_SIZE};
