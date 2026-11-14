'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const T=require('../scripts/imperion-dev-provider.cjs');
const Q=require('../scripts/imperion-dev-groq-quota.cjs');
function env(root,more={}){
 return {IMPERION_DEV_PROVIDER:'groq',IMPERION_DEV_MODEL:'openai/gpt-oss-120b',
  IMPERION_DEV_FREE_ONLY:'FREE-ONLY',GROQ_VERIFIED_FREE_PLAN:'true',GROQ_API_KEY:'SYNTHETIC-NOT-SECRET',
  GITHUB_REPOSITORY:'aliaksei-chareshneu/alchareshneu',GITHUB_EVENT_NAME:'issue_comment',
  GITHUB_RUN_ID:'1234567890',GITHUB_RUN_ATTEMPT:'1',GITHUB_TOKEN:'SYNTHETIC-NOT-SECRET',
  GITHUB_ENV:path.join(root,'github-env'),GITHUB_STEP_SUMMARY:path.join(root,'summary'),
  RUNNER_TEMP:root,IMPERION_DEV_GROQ_QUOTA_APPROVED:'true',...more};
}
const request=()=>({method:'POST',redirect:'error',credentials:'omit',headers:{'content-type':'application/json'},
 body:JSON.stringify({model:'openai/gpt-oss-120b',stream:false,format:'json',think:false,
  prompt:'Modify public synthetic function: add negative quantity clamp.',
  options:{temperature:0.1}})});
const completion=(model='openai/gpt-oss-120b',content='{"old":"return price * count;","new":"return price * Math.max(0,count);"}')=>
 ({model,choices:[{finish_reason:'stop',message:{content}}]});
test('Groq model is transported via existing controller without leaking secret into prompt',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dev-groq-'));
 try{
  const e=env(tmp);let seen=0;
  const tx=T.createTransport(e,async(url,options)=>{
   seen++;assert.equal(url,T.GROQ_ENDPOINT);
   assert.equal(options.headers.authorization,'Bearer '+e.GROQ_API_KEY);
   const data=JSON.parse(options.body);
   assert.equal(data.model,'openai/gpt-oss-120b');
   assert.equal(data.reasoning_effort,'low');
   assert.equal(data.response_format.type,'json_object');
   assert.equal(data.messages[1].content,'Modify public synthetic function: add negative quantity clamp.');
   assert.equal(options.body.includes(e.GROQ_API_KEY),false);
   return {ok:true,redirected:false,json:async()=>completion()};
  });
  const response=await tx(T.OLLAMA_ENDPOINT,request());
  assert.equal(response.ok,true);
  const normalized=await response.json();
  assert.equal(normalized.done,true);
  assert.equal(normalized.model,'openai/gpt-oss-120b');
  assert.match(normalized.response,/Math\.max/);
  assert.equal(seen,1);
  const usage=JSON.parse(fs.readFileSync(path.join(tmp,'imperion-dev-groq-usage.json'),'utf8'));
  assert.equal(usage.calls,1);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('missing free approvals and untrusted endpoint block BEFORE provider',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dev-groq-'));
 try{
  for(const overrides of [{GROQ_API_KEY:''},{GROQ_VERIFIED_FREE_PLAN:'false'},
    {IMPERION_DEV_FREE_ONLY:'CHARGED'},{GITHUB_EVENT_NAME:'push'}])
   assert.throws(()=>T.createTransport(env(tmp,overrides),async()=>{throw Error('SHOULD_NOT_CALL')}),/GROQ_|GITHUB_/);
  let called=0;
  const tx=T.createTransport(env(tmp),async()=>{called++;throw Error('SHOULD_NOT_CALL')});
  await assert.rejects(()=>tx('https://evil.example/api',request()),/MODEL_TRANSPORT_UNTRUSTED/);
  await assert.rejects(()=>tx(T.OLLAMA_ENDPOINT,{...request(),body:JSON.stringify({...JSON.parse(request().body),model:'other'})}),/MODEL_TRANSPORT_BAD_REQUEST/);
  assert.equal(called,0);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('HTTP429 and mismatched model are hard stops with NO paid/implicit fallback',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dev-groq-'));
 try{
  const denied=T.createTransport(env(tmp),async()=>({ok:false,status:429,redirected:false}));
  await assert.rejects(()=>denied(T.OLLAMA_ENDPOINT,request()),/GROQ_FREE_QUOTA_REACHED/);
  const wrong=T.createTransport(env(tmp),async()=>({ok:true,redirected:false,json:async()=>completion('incorrect-model')}));
  await assert.rejects(()=>wrong(T.OLLAMA_ENDPOINT,request()),/GROQ_MODEL_RESPONSE_REJECTED/);
  const unfinished=T.createTransport(env(tmp),async()=>({ok:true,redirected:false,json:async()=>({
   model:'openai/gpt-oss-120b',choices:[{finish_reason:'length',message:{content:'{}'}}]})}));
  await assert.rejects(()=>unfinished(T.OLLAMA_ENDPOINT,request()),/GROQ_MODEL_RESPONSE_REJECTED/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('per-run reservation denies 11th request even if provider still responds',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dev-groq-'));
 try{
  let calls=0;
  const tx=T.createTransport(env(tmp),async()=>{calls++;return {ok:true,redirected:false,json:async()=>completion()}});
  for(let i=0;i<T.MAX_CALLS_PER_RUN;i++)assert.equal((await tx(T.OLLAMA_ENDPOINT,request())).ok,true);
  await assert.rejects(()=>tx(T.OLLAMA_ENDPOINT,request()),/GROQ_FREE_BUDGET_EXHAUSTED/);
  assert.equal(calls,T.MAX_CALLS_PER_RUN);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('local CPU model remains a separate exact-ID route (never misidentified as Groq)',async()=>{
 const e={IMPERION_DEV_PROVIDER:'ollama',IMPERION_DEV_MODEL:'qwen3:4b-instruct'};
 let n=0;
 const tx=T.createTransport(e,async(url,options)=>{n++;assert.equal(url,T.OLLAMA_ENDPOINT);return {ok:true,redirected:false,json:async()=>({done:true,model:'qwen3:4b-instruct',response:'{}'})}});
 const body=request(),raw=JSON.parse(body.body);raw.model='qwen3:4b-instruct';body.body=JSON.stringify(raw);
 assert.equal((await tx(T.OLLAMA_ENDPOINT,body)).ok,true);
 assert.equal(n,1);
});
test('durable GitHub run history admits only three Groq executions per rolling day',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dev-groq-'));
 try{
  const now=Date.parse('2026-11-15T12:00:00Z');
  const self={id:1234567890,event:'issue_comment',created_at:'2026-11-15T11:59:00Z'};
  const earlier=i=>({id:2000+i,event:'issue_comment',created_at:'2026-11-15T10:00:00Z'});
  const fake=(others=[])=>async()=>({ok:true,redirected:false,json:async()=>({
   total_count:1+others.length,workflow_runs:[self,...others]})});
  const e=env(tmp);
  assert.equal((await Q.admit(e,fake([earlier(1),earlier(2)]),now)).status,'GROQ_FREE_GITHUB_QUOTA_ADMITTED');
  await assert.rejects(()=>Q.admit(e,fake([earlier(1),earlier(2),earlier(3)]),now),/GROQ_FREE_DAILY_RUN_LIMIT_REACHED/);
  await assert.rejects(()=>Q.admit({...e,GITHUB_RUN_ATTEMPT:'2'},fake([]),now),/GROQ_QUOTA_GITHUB_CONTEXT_REQUIRED/);
  await assert.rejects(()=>Q.admit(e,async()=>({ok:false,status:403,redirected:false}),now),/GROQ_QUOTA_GITHUB_HTTP_REJECTED/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
