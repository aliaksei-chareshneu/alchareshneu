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
test('approved public source -> persisted draft -> identical replay without extra model call',async()=>{
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
   assert.deepEqual(b,a);
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

test('a completed job cannot be replayed with a different language or corrupted receipt',async()=>{
 const crypto=require('node:crypto');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imp-ai-replay-collision-'));
 let requests=0;
 const fetchImpl=async(url,opts)=>{
   requests++;
   if(opts.method==='GET')
     return new Response('<html><main>Public workshop for adults.</main></html>',{
       status:200,headers:{'content-type':'text/html'}
     });
   return new Response(JSON.stringify({response:'Veřejný workshop pro dospělé.'}),{
     status:200,headers:{'content-type':'application/json'}
   });
 };
 try {
   const first=await run(input(),{localAppData:dir,fetchImpl});
   assert.equal(first.status,'DRAFT_FOR_OWNER_REVIEW');
   const firstCalls=requests;
   const conflict=await run({...input(),language:'en'},{localAppData:dir,fetchImpl});
   assert.equal(conflict.status,'BLOCKED');
   assert.equal(conflict.reason,'LOCAL_RECEIPT_INTEGRITY_OR_JOB_COLLISION');
   assert.equal(requests,firstCalls,'colliding task cannot reach model or HTTP source');
   const receiptPath=path.join(dir,'IMPERION','public-ai-results-v1',
     crypto.createHash('sha256').update(input().job_id).digest('hex')+'.json');
   const record=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
   record.result.draft='modified after completion';
   fs.writeFileSync(receiptPath,JSON.stringify(record));
   const invalid=await run(input(),{localAppData:dir,fetchImpl});
   assert.equal(invalid.status,'BLOCKED');
   assert.equal(invalid.reason,'LOCAL_RECEIPT_INTEGRITY_OR_JOB_COLLISION');
   assert.equal(requests,firstCalls);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
