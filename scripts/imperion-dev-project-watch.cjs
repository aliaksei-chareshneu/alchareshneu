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
async function dispatchOne(token,fetcher=globalThis.fetch){
 if(typeof token!=='string'||token.length<8)block('PROJECT_WATCH_AUTH_REJECTED');
 const list=await R.getJson(BASE+'/pulls?state=open&per_page=100',token,fetcher);
 const candidates=candidateProjects(list);
 if(!candidates.length)return {status:'NO_ELIGIBLE_DRAFT_PROJECT'};
 const next=candidates[0];
 const payload={event_type:'imperion-dev-project-resume',
  client_payload:{issue:next.issue,comment:next.comment}};
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
module.exports={candidateProjects,dispatchOne};
