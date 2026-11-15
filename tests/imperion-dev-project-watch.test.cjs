'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../scripts/imperion-dev-project-watch.cjs');
const repo='aliaksei-chareshneu/alchareshneu';
const id='245-777123456';
function pr(stage,planned=3){
 return {number:500+stage,state:'open',draft:true,merged_at:null,
  user:{login:'github-actions[bot]'},
  head:{ref:'agent/imperion-dev-project-'+id+'-s'+stage,repo:{full_name:repo}},
  base:{ref:stage===1?'main':'agent/imperion-dev-project-'+id+'-s'+(stage-1)},
  body:'imperion-dev-project:'+id+' stage:'+stage+' plan:'+'f'.repeat(64)+
   '\nPlanned stages: '+planned+'\nHuman review required.'};
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
test('watch emits exactly one whitelisted repository_dispatch and no merge/deploy',async()=>{
 const calls=[];
 const fetcher=async(url,init)=>{
  calls.push({url,init});
  if(init.method==='GET')return {
   ok:true,redirected:false,text:async()=>JSON.stringify([pr(1)])
  };
  assert.equal(init.method,'POST');
  assert.equal(url,'https://api.github.com/repos/'+repo+'/dispatches');
  assert.equal(init.credentials,'omit');
  assert.equal(init.redirect,'error');
  assert.deepEqual(JSON.parse(init.body),{
   event_type:'imperion-dev-project-resume',
   client_payload:{issue:245,comment:777123456}
  });
  return {status:204,redirected:false};
 };
 const result=await S.dispatchOne('mock-github-token',fetcher);
 assert.equal(result.status,'DISPATCH_ACCEPTED_PENDING_LIVE_READBACK');
 assert.equal(result.auto_merge,false);
 assert.equal(result.paid_api_czk,0);
 assert.equal(calls.length,2);
 assert.equal(calls.filter(x=>x.init.method==='POST').length,1);
});
test('nothing to resume does not dispatch, and failed dispatch fails closed',async()=>{
 let count=0;
 const idle=async(_url,req)=>{count++;assert.equal(req.method,'GET');
  return {ok:true,redirected:false,text:async()=>JSON.stringify([])};};
 assert.equal((await S.dispatchOne('mock-token',idle)).status,'NO_ELIGIBLE_DRAFT_PROJECT');
 assert.equal(count,1);
 const fail=async(_url,req)=>req.method==='GET'?
  {ok:true,redirected:false,text:async()=>JSON.stringify([pr(1)])}:
  {status:403,redirected:false};
 await assert.rejects(()=>S.dispatchOne('mock-token',fail),
  /PROJECT_WATCH_DISPATCH_NOT_ACCEPTED/);
});
