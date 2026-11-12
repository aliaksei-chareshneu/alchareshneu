'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createLocalQuota}=require('../ops/imperion-free-local-quota.cjs');
async function fixture(fn){
 const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'imp-free-quota-'));
 try{return await fn(dir);}finally{await fs.promises.rm(dir,{recursive:true,force:true});}
}
const entry=(job_id,provider='groq',model='openai/gpt-oss-120b',daily_ceiling=2)=>
 ({provider,model,job_id,daily_ceiling});
test('first local reservation persists and a repeated job is rejected even after restart',async()=>{
 await fixture(async dir=>{
  const clock=()=>new Date('2026-11-09T18:00:00Z');
  assert.equal(await createLocalQuota({directory:dir,clock})(entry('PUBLIC-A-001')),true);
  assert.equal(await createLocalQuota({directory:dir,clock})(entry('PUBLIC-A-001')),false);
  assert.equal((await fs.promises.readdir(path.join(dir,'jobs'))).length,1);
  assert.equal((await fs.promises.readdir(path.join(dir,'daily','2026-11-09'))).length,1);
 });
});
test('cannot exceed daily limit, and reservations persist across restart',async()=>{
 await fixture(async dir=>{
  const reserve=createLocalQuota({directory:dir,clock:()=>new Date('2026-11-09T18:00:00Z')});
  assert.equal(await reserve(entry('PUBLIC-A-002')),true);
  assert.equal(await reserve(entry('PUBLIC-A-003')),true);
  const newInstance=createLocalQuota({directory:dir,clock:()=>new Date('2026-11-09T21:00:00Z')});
  assert.equal(await newInstance(entry('PUBLIC-A-004')),false);
  assert.equal(await createLocalQuota({directory:dir,clock:()=>new Date('2026-11-10T00:01:00Z')})(entry('PUBLIC-A-005')),true);
  assert.equal(await createLocalQuota({directory:dir,clock:()=>new Date('2026-11-10T00:02:00Z')})(entry('PUBLIC-A-002')),false);
 });
});
test('simultaneous requests cannot both pass a one-request daily ceiling',async()=>{
 await fixture(async dir=>{
  const reserve=createLocalQuota({directory:dir,clock:()=>new Date('2026-11-09T00:00:00Z')});
  const results=await Promise.all([reserve(entry('PUBLIC-B-001','groq','openai/gpt-oss-120b',1)),reserve(entry('PUBLIC-B-002','groq','openai/gpt-oss-120b',1))]);
  assert.deepEqual(results.sort(),[false,true]);
 });
});
test('a stale lock or filesystem anomaly blocks without cleanup or provider call',async()=>{
 await fixture(async dir=>{
  const lock=path.join(dir,'.quota.lock');
  await fs.promises.mkdir(lock);
  const reserve=createLocalQuota({directory:dir,clock:()=>new Date('2026-11-09T00:00:00Z')});
  assert.equal(await reserve(entry('PUBLIC-C-001')),false);
  assert.equal(fs.existsSync(lock),true);
 });
});
test('invalid quota schema rejected; 0 and over 600 never bypass limit',async()=>{
 await fixture(async dir=>{
  const reserve=createLocalQuota({directory:dir});
  assert.equal(await reserve(entry('PUBLIC-D-001','groq','openai/gpt-oss-120b',0)),false);
  assert.equal(await reserve(entry('PUBLIC-D-002','groq','openai/gpt-oss-120b',601)),false);
  assert.equal(await reserve(entry('oops/../secret')),false);
  assert.equal(await reserve(entry('PUBLIC-D-004','gROQ!')),false);
  assert.equal(await reserve(entry('PUBLIC-D-005','groq','x')),false);
 });
});

test('real router injects durable local reservation: second draft is blocked without model call',async()=>{
 const {draftPublicTask}=require('../ops/imperion-free-model-router.cjs');
 await fixture(async dir=>{
   const task={
    job_id:'PUBLIC-E2E-20261109',
    owner_entity:'OSVC',data_classification:'PUBLIC_APPROVED',
    public_source_approved:true,external_ai_approved:true,
    source_url:'https://aliaksei-chareshneu.github.io/alchareshneu/corporate/',
    purpose:'PUBLIC_TRANSLATION_DRAFT',language:'cs'
   };
   let modelCalls=0;
   const fetched=async(url,opts)=>{
     if(opts.method==='GET')return new Response('<main><p>Open public workshop for adults.</p></main>',{status:200,headers:{'content-type':'text/html'}});
     modelCalls++;
     return new Response(JSON.stringify({response:'Veřejný workshop pro dospělé.'}),{status:200,headers:{'content-type':'application/json'}});
   };
   const config={
     env:{OLLAMA_LOCAL_ENABLED:'true',OLLAMA_LOCAL_MODEL:'imperion-qwen35:4b'},
     reserveQuota:createLocalQuota({directory:dir,clock:()=>new Date('2026-11-09T15:00:00Z')}),
     fetchImpl:fetched
   };
   const first=await draftPublicTask(task,config);
   const second=await draftPublicTask(task,config);
   assert.equal(first.status,'DRAFT_FOR_OWNER_REVIEW');
   assert.equal(first.owner_approval_required,true);
   assert.equal(first.messages_sent,0);
   assert.equal(second.status,'BLOCKED');
   assert.equal(modelCalls,1);
 });
});

test('different approved provider may reserve a failover for same public job',async()=>{
 await fixture(async dir=>{
  const reserve=createLocalQuota({directory:dir,clock:()=>new Date('2026-11-09T00:00:00Z')});
  assert.equal(await reserve(entry('PUBLIC-E-001','groq','openai/gpt-oss-120b',1)),true);
  assert.equal(await reserve(entry('PUBLIC-E-001','ollama_local','imperion-qwen35:4b',1)),true);
  assert.equal(await reserve(entry('PUBLIC-E-001','ollama_local','imperion-qwen35:4b',1)),false);
 });
});
