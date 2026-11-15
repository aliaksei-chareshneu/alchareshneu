'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../scripts/imperion-dev-project-watch.cjs');
const repo='aliaksei-chareshneu/alchareshneu',id='245-777123456';
const now=Date.parse('2026-11-15T18:00:00Z');
function pr(stage,planned=3,project=id){
 return {number:500+stage,state:'open',draft:true,merged_at:null,
  user:{login:'github-actions[bot]'},
  head:{ref:'agent/imperion-dev-project-'+project+'-s'+stage,repo:{full_name:repo}},
  base:{ref:stage===1?'main':'agent/imperion-dev-project-'+project+'-s'+(stage-1)},
  body:'imperion-dev-project:'+project+' stage:'+stage+' plan:'+'f'.repeat(64)+
   '\nPlanned stages: '+planned+'\nHuman review required.'};
}
function run(stage=2,override={}){
 return {id:100001+stage,workflow_id:412528588,
  name:'IMPERION DEV project '+id+' stage '+stage,
  display_title:'IMPERION DEV project '+id+' stage '+stage,
  event:'repository_dispatch',actor:{login:'github-actions[bot]'},
  repository:{full_name:repo},head_branch:'main',
  created_at:'2026-11-14T12:00:00Z',status:'completed',
  conclusion:'failure',...override};
}
function transport(pulls,history=[],postStatus=204){
 const calls=[];
 const fn=async(url,init)=>{
  calls.push({url,init});
  if(init.method==='GET'){
   if(url.includes('/pulls?')){
    const u=new URL(url),page=Number(u.searchParams.get('page'));
    return {ok:true,redirected:false,
      text:async()=>JSON.stringify(pulls.slice((page-1)*4,page*4))};
   }
   if(url.includes('/actions/workflows/')){
    const u=new URL(url),page=Number(u.searchParams.get('page'));
    const response={total_count:history.length,
      workflow_runs:history.slice((page-1)*5,page*5)};
    return {ok:true,redirected:false,text:async()=>JSON.stringify(response)};
   }
   throw Error('MOCK_GET_WRONG_ENDPOINT: '+url);
  }
  assert.equal(url,'https://api.github.com/repos/'+repo+'/dispatches');
  assert.equal(init.method,'POST');
  assert.equal(init.credentials,'omit');
  assert.equal(init.redirect,'error');
  return {status:postStatus,redirected:false};
 };
 return {fn,calls};
}
test('one owner project with one real Draft stage yields one bounded resume candidate',()=>{
 const c=S.candidateProjects([pr(1)]);
 assert.equal(c.length,1);
 assert.equal(c[0].issue,245);
 assert.equal(c[0].comment,777123456);
 assert.equal(c[0].stage,2);
 const two=S.candidateProjects([pr(1),pr(2)]);
 assert.equal(two.length,1);
 assert.equal(two[0].stage,3);
 assert.deepEqual(S.candidateProjects([pr(1),pr(2),pr(3)]),[]);
 assert.deepEqual(S.candidateProjects([pr(1,2),pr(2,2)]),[]);
});
test('forged author, missing marker, wrong base and duplicate Draft cannot schedule',()=>{
 const original=pr(1);
 for(const altered of [
  {...original,user:{login:'attacker'}},
  {...original,base:{ref:'bad'}},
  {...original,draft:false},
  {...original,body:'wrong plan'},
  {...original,head:{...original.head,repo:{full_name:'attacker/evil'}}},
  {...original,state:'closed'},
  {...original,merged_at:'2026-11-15T12:00:00Z'}
 ])assert.deepEqual(S.candidateProjects([altered]),[]);
 assert.deepEqual(S.candidateProjects([original,original]),[]);
 assert.throws(()=>S.candidateProjects(Array.from({length:100},()=>({}))),
  /PROJECT_WATCH_INCOMPLETE_LIST/);
});
test('watch emits one stage-specific whitelisted repository_dispatch, never merge/deploy',async()=>{
 const t=transport([pr(1)]);
 const result=await S.dispatchOne('mock-github-token',t.fn,now);
 assert.equal(result.status,'DISPATCH_ACCEPTED_PENDING_LIVE_READBACK');
 assert.equal(result.auto_merge,false);
 assert.equal(result.paid_api_czk,0);
 assert.equal(t.calls.length,3);
 const payload=JSON.parse(t.calls.find(c=>c.init.method==='POST').init.body);
 assert.deepEqual(payload,{event_type:'imperion-dev-project-resume',
  client_payload:{issue:245,comment:777123456,stage:2}});
 assert.ok(t.calls.filter(x=>x.init.method==='GET').every(x=>
  x.init.headers.authorization==='Bearer mock-github-token'));
});
test('watch reads GitHub run history, cools down after failure and caps retry twice',async()=>{
 const c=S.candidateProjects([pr(1)])[0];
 assert.equal(S.gateAttempts(c,[],now).status,'ELIGIBLE_STAGE_ATTEMPT');
 assert.equal(S.gateAttempts(c,[run()],now).status,'ELIGIBLE_STAGE_ATTEMPT');
 const recent=run(2,{created_at:'2026-11-15T15:00:00Z'});
 assert.equal(S.gateAttempts(c,[recent],now).status,'PAUSED_STAGE_RETRY_COOLDOWN');
 const running=run(2,{status:'in_progress',conclusion:null});
 assert.equal(S.gateAttempts(c,[running],now).status,'WAIT_EXISTING_STAGE_RUN');
 assert.equal(S.gateAttempts(c,[run(2,{conclusion:'success'})],now).status,
  'BLOCKED_SUCCESS_WITHOUT_DRAFT');
 const two=[run(),run(2,{id:123456,created_at:'2026-11-15T13:00:00Z'})];
 assert.equal(S.gateAttempts(c,two,now).status,'BLOCKED_STAGE_RETRY_LIMIT');
 const t=transport([pr(1)],two);
 const paused=await S.dispatchOne('mock-github-token',t.fn,now);
 assert.equal(paused.status,'NO_ELIGIBLE_STAGE_AFTER_HISTORY_CHECK');
 assert.equal(t.calls.filter(x=>x.init.method==='POST').length,0);
 assert.equal(paused.deferred[0].attempts,2);
 assert.equal(S.MAX_STAGE_ATTEMPTS,2);
 assert.equal(S.RETRY_COOLDOWN_MS,86400000);
});
test('no matching Draft means no dispatch; failed POST or incomplete history blocks',async()=>{
 const idle=transport([]);
 assert.equal((await S.dispatchOne('mock-token',idle.fn,now)).status,
  'NO_ELIGIBLE_DRAFT_PROJECT');
 assert.equal(idle.calls.length,1);
 const fail=transport([pr(1)],[],403);
 await assert.rejects(()=>S.dispatchOne('mock-token',fail.fn,now),
  /PROJECT_WATCH_DISPATCH_NOT_ACCEPTED/);
 const exceeded=transport([pr(1)],Array.from({length:201},(_,i)=>run(2,{
  id:i+1,display_title:'UNRELATED',created_at:'2026-11-15T15:00:00Z'
 })));
 await assert.rejects(()=>S.dispatchOne('mock-token',exceeded.fn,now),
  /PROJECT_WATCH_HISTORY_LIMIT_REACHED/);
});
test('stage3 resumes when only stage2 history failed; unrelated runs cannot exhaust stage',()=>{
 const c=S.candidateProjects([pr(1),pr(2)])[0];
 assert.equal(c.stage,3);
 assert.equal(S.gateAttempts(c,[run(2),run(2,{id:5,conclusion:'success'})],now).status,
  'ELIGIBLE_STAGE_ATTEMPT');
 assert.throws(()=>S.gateAttempts(c,[run(3),run(3)],now),
  /PROJECT_WATCH_DUPLICATE_HISTORY/);
 assert.throws(()=>S.gateAttempts(c,[run(3,{created_at:'not a date'})],now),
  /PROJECT_WATCH_HISTORY_UNTRUSTED/);
});

test('GitHub pagination handles more than one response without exceeding 100KB',async()=>{
 const unrelated=Array.from({length:10},(_,i)=>({number:10000+i,
  head:{ref:'unrelated-branch'}}));
 unrelated[9]=pr(1);
 const history=Array.from({length:12},(_,i)=>run(2,{
  id:1000+i,display_title:'UNRELATED PROJECT',name:'UNRELATED PROJECT'
 }));
 const t=transport(unrelated,history);
 const result=await S.dispatchOne('mock-github-token',t.fn,now);
 assert.equal(result.status,'DISPATCH_ACCEPTED_PENDING_LIVE_READBACK');
 assert.equal(t.calls.filter(x=>x.url.includes('/pulls?')).length,3);
 assert.equal(t.calls.filter(x=>x.url.includes('/actions/workflows/')).length,3);
 assert.equal(S.OPEN_PULL_PAGE_SIZE,4);
 assert.equal(S.HISTORY_PAGE_SIZE,5);
});
test('incomplete or duplicated paginated GitHub PR evidence fails closed',async()=>{
 const original=pr(1);
 const duplicate=transport([original,original]);
 await assert.rejects(()=>S.dispatchOne('mock-token',duplicate.fn,now),
  /PROJECT_WATCH_PULLS_INCOMPLETE_OR_DUPLICATE/);
 const full=transport(Array.from({length:100},(_,i)=>({
  number:i+1,head:{ref:'unrelated-'+i}
 })));
 await assert.rejects(()=>S.dispatchOne('mock-token',full.fn,now),
  /PROJECT_WATCH_PULLS_INCOMPLETE_OR_DUPLICATE/);
});
