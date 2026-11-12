'use strict';
/**
 * Owner-device diagnostic ONLY. Synthetic Groq 429 -> REAL loopback Ollama.
 * Reads first-party repository HTML (NOT production HTTP), no live Groq key,
 * no paid endpoints, no private CRM, no outbound messages or publications.
 * Not an unattended production quota mechanism or a scheduled agent.
 */
const fs=require('node:fs');
const path=require('node:path');
const {draftPublicTask}=require('../ops/imperion-free-model-router.cjs');
const SOURCE='https://aliaksei-chareshneu.github.io/alchareshneu/corporate/';
const GROQ='https://api.groq.com/openai/v1/chat/completions';
const LOCAL='http://127.0.0.1:11434/api/generate';
const ALLOWED_FLAG='--public-fallback-diagnostic';
function response(status,body,media='application/json'){
 return new Response(typeof body==='string'?body:JSON.stringify(body),
   {status,headers:{'content-type':media}});
}
async function run(){
 if(process.argv.length!==3||process.argv[2]!==ALLOWED_FLAG)
   throw Error('REFUSE_WITHOUT_EXPLICIT_PUBLIC_DIAGNOSTIC_FLAG');
 const html=fs.readFileSync(path.join(__dirname,'../corporate/index.html'),'utf8');
 if(html.length<500||html.length>65000)throw Error('SOURCE_FIXTURE_LENGTH_INVALID');
 const task={
  job_id:'PUBLIC-LOCAL-SMOKE-20261109',
  owner_entity:'OSVC',data_classification:'PUBLIC_APPROVED',
  public_source_approved:true,external_ai_approved:true,
  source_url:SOURCE,purpose:'PUBLIC_TRANSLATION_DRAFT',language:'cs'
 };
 const providers=[],utc=new Date().toISOString();
 const start=Date.now();
 const fetchImpl=async (url,opts)=>{
   if(url===SOURCE&&opts.method==='GET')return response(200,html,'text/html');
   if(url===GROQ&&opts.method==='POST'){
     providers.push('SIMULATED_GROQ_429_NOT_NETWORK');
     return response(429,{error:'simulated testing limit'});
   }
   if(url===LOCAL&&opts.method==='POST'){
     providers.push('REAL_LOCAL_OLLAMA');
     if(opts.headers.Authorization)throw Error('LOCAL_AUTH_HEADER_NOT_ALLOWED');
     return fetch(url,opts);
   }
   throw Error('UNAPPROVED_FETCH_DESTINATION');
 };
 let n=0;
 const out=await draftPublicTask(task,{
   env:{
     GROQ_API_KEY:'NO_REAL_KEY_SIMULATED_429',
     GROQ_VERIFIED_FREE_PLAN:'true',
     OLLAMA_LOCAL_ENABLED:'true',
     OLLAMA_LOCAL_MODEL:'imperion-qwen35:4b'
   },
   fetchImpl,
   // Single-use test-only callback; NEVER production durability.
   reserveQuota:async ({provider})=>(++n<=2&&['groq','ollama_local'].includes(provider))
 });
 const proof={
   checked_at_utc:utc,
   source:'FIRST_PARTY_REPOSITORY_FIXTURE_NOT_LIVE_HTTP',
   primary:'SIMULATED_GROQ_RATE_LIMIT_NO_EXTERNAL_CALL',
   fallbacks:providers,
   status:out.status,
   provider:out.provider||null,
   elapsed_ms:Date.now()-start,
   source_checked:out.source_checked===true,
   owner_approval_required:out.owner_approval_required===true,
   draft_chars:out.draft?.length||0,
   messages_sent:out.messages_sent,
   posts_published:out.posts_published,
   payments_created:out.payments_created,
   reason:out.reason||null,failures:out.failures||[]
 };
 console.log(JSON.stringify(proof,null,2));
 if(out.status!=='DRAFT_FOR_OWNER_REVIEW'||out.provider!=='ollama_local'||
    out.messages_sent!==0||out.posts_published!==0||out.payments_created!==0||
    out.owner_approval_required!==true||providers.length!==2)
   process.exitCode=1;
}
run().catch(e=>{console.error('DIAGNOSTIC_BLOCKED '+String(e.message).slice(0,120));process.exitCode=1});
