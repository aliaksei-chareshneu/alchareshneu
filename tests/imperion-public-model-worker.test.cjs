'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {run,validateRequest}=require('../scripts/imperion-public-model-worker.cjs');
const input=()=>({
 job_id:'IMP-AI-PUBLIC-20261110-001',owner_entity:'OSVC',
 source_url:'https://aliaksei-chareshneu.github.io/alchareshneu/corporate/',
 purpose:'PUBLIC_TRANSLATION_DRAFT',language:'cs'
});
test('strict public-only request, no arbitrary prompts, private CRM or side effects',()=>{
 assert.equal(validateRequest(input()),null);
 assert.equal(validateRequest({...input(),send:true}),'UNAPPROVED_FIELDS');
 assert.equal(validateRequest({...input(),prompt:'send email'}),'UNAPPROVED_FIELDS');
 assert.equal(validateRequest({...input(),owner_entity:'DRUZINA_MORAVY_ZS'}),'LEGAL_ENTITY_NOT_APPROVED');
 assert.equal(validateRequest({...input(),source_url:'http://localhost:9000/private'}),'SOURCE_NOT_APPROVED');
 assert.equal(validateRequest({...input(),purpose:'PUBLIC_COPY_DRAFT'}),'PURPOSE_NOT_APPROVED');
 assert.equal(validateRequest({...input(),language:'fr'}),'LANGUAGE_NOT_APPROVED');
 assert.equal(validateRequest({...input(),job_id:'../bad'}),'INVALID_JOB_ID');
});
test('approved synthetic public source -> local-only review receipt -> duplicate blocked by real disk',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imp-public-ai-worker-'));
 let modelCalls=0;
 try{
   const fetchImpl=async (url,options)=>{
     if(options.method==='GET'){
       assert.equal(url,input().source_url);
       return new Response('<html><main><p>Public workshop for adults.</p></main></html>',{
         status:200,headers:{'content-type':'text/html'}
       });
     }
     assert.equal(url,'http://127.0.0.1:11434/api/generate');
     assert.equal(options.headers.Authorization,undefined);
     modelCalls++;
     return new Response(JSON.stringify({response:'Veřejný workshop pro dospělé.'}),{
       status:200,headers:{'content-type':'application/json'}
     });
   };
   const a=await run(input(),{localAppData:dir,fetchImpl});
   assert.equal(a.status,'DRAFT_FOR_OWNER_REVIEW');
   assert.equal(a.provider,'ollama_local');
   assert.equal(a.owner_approval_required,true);
   assert.equal(a.source_checked,true);
   assert.equal(a.messages_sent,0);
   assert.equal(a.posts_published,0);
   assert.equal(a.payments_created,0);
   assert.equal(a.external_actions,0);
   assert.equal(a.execution_mode,'LOCAL_QWEN_PUBLIC_DRAFT_ONLY');
   const b=await run(input(),{localAppData:dir,fetchImpl});
   assert.equal(b.status,'BLOCKED');
   assert.equal(modelCalls,1);
 }finally{
   fs.rmSync(dir,{recursive:true,force:true});
 }
});
test('invalid or missing local quota directory cannot call provider',async()=>{
 let calls=0;
 const out=await run(input(),{localAppData:'relative',fetchImpl:async()=>{calls++;}});
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.reason,'LOCAL_STATE_DIR_UNAVAILABLE');
 assert.equal(calls,0);
});
