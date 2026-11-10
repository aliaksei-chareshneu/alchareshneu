'use strict';
/** Existing IMPERION public-only model router adapter for owner PC BrowserBridge.
 * No shell selection, remote code, sends, private data, payments or cloud credential.
 * Receives one strictly validated task over stdin; outputs one review-only receipt.
 */
const path=require('node:path');
const {draftPublicTask}=require('../ops/imperion-free-model-router.cjs');
const {createLocalQuota}=require('../ops/imperion-free-local-quota.cjs');
const SOURCES=new Set([
 'https://aliaksei-chareshneu.github.io/alchareshneu/corporate/',
 'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/',
 'https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/feed.json'
]);
const LANGUAGES=new Set(['en','cs','ru','uk']);
function validateRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return 'INPUT_NOT_OBJECT';
 const required=['job_id','owner_entity','source_url','purpose','language'];
 if(Object.keys(input).sort().join('|')!==required.sort().join('|'))return 'UNAPPROVED_FIELDS';
 if(typeof input.job_id!=='string'|| !/^[A-Za-z0-9._-]{6,120}$/.test(input.job_id))return 'INVALID_JOB_ID';
 if(input.owner_entity!=='OSVC')return 'LEGAL_ENTITY_NOT_APPROVED';
 if(!SOURCES.has(input.source_url))return 'SOURCE_NOT_APPROVED';
 if(input.purpose!=='PUBLIC_TRANSLATION_DRAFT')return 'PURPOSE_NOT_APPROVED';
 if(!LANGUAGES.has(input.language))return 'LANGUAGE_NOT_APPROVED';
 return null;
}
function blocked(reason,job_id){return {status:'BLOCKED',reason,job_id:typeof job_id==='string'?job_id.slice(0,120):null,
 messages_sent:0,posts_published:0,payments_created:0,owner_approval_required:true};}
async function run(input,{localAppData=process.env.LOCALAPPDATA,fetchImpl,quotaReserve}={}){
 const why=validateRequest(input);
 if(why)return blocked(why,input?.job_id);
 if(typeof localAppData!=='string'||!path.isAbsolute(localAppData))return blocked('LOCAL_STATE_DIR_UNAVAILABLE',input.job_id);
 const quotaDir=path.join(localAppData,'IMPERION','public-ai-quota-v1');
 const task={...input,data_classification:'PUBLIC_APPROVED',public_source_approved:true,external_ai_approved:true};
 const options={
   env:{OLLAMA_LOCAL_ENABLED:'true',OLLAMA_LOCAL_MODEL:'imperion-qwen35:4b'},
   reserveQuota:quotaReserve||createLocalQuota({directory:quotaDir}),
   localTimeoutMs:60000,
   ...(fetchImpl?{fetchImpl}:{})
 };
 const result=await draftPublicTask(task,options);
 return {
   job_id:input.job_id,owner_entity:'OSVC',source_url:input.source_url,
   source_sha256:result.source_sha256||null,
   status:result.status,reason:result.reason||null,
   provider:result.provider||null,model:result.model||null,
   draft:typeof result.draft==='string'?result.draft.slice(0,5000):null,
   failures:(result.failures||[]).slice(0,3),
   owner_approval_required:true,source_checked:result.source_checked===true,
   messages_sent:0,posts_published:0,payments_created:0,
   external_actions:0,execution_mode:'LOCAL_QWEN_PUBLIC_DRAFT_ONLY'
 };
}
async function cli(){
 let input;
 try{
   const raw=require('node:fs').readFileSync(0,'utf8');
   if(raw.length>1800)throw Error('INPUT_TOO_LARGE');
   input=JSON.parse(raw);
 }catch{console.log(JSON.stringify(blocked('INPUT_JSON_INVALID')));process.exitCode=2;return;}
 let out;
 try{out=await run(input);}catch{out=blocked('LOCAL_ADAPTER_ERROR',input?.job_id);}
 console.log(JSON.stringify(out));
 if(!['DRAFT_FOR_OWNER_REVIEW','BLOCKED'].includes(out.status))process.exitCode=3;
}
if(require.main===module)cli();
module.exports={validateRequest,run};
