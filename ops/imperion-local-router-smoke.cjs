'use strict';
// MANUAL, synthetic smoke only: real public URL + local Qwen via the existing router.
// The in-memory reservation below is forbidden for production scheduling.
// No emails, messages, CRM writes, posts, payments or secret/API calls.
const M=require('./imperion-free-model-router.cjs');
const task={
  job_id:'PUB-LOCAL-SMOKE-20261105',
  owner_entity:'OSVC',
  data_classification:'PUBLIC_APPROVED',
  public_source_approved:true,
  external_ai_approved:true,
  source_url:'https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/feed.json',
  purpose:'PUBLIC_TRANSLATION_DRAFT',
  language:'cs'
};
M.draftPublicTask(task,{
  env:{OLLAMA_LOCAL_ENABLED:'true',OLLAMA_LOCAL_MODEL:'imperion-qwen35:4b'},
  reserveQuota:async()=>true
}).then(x=>{
  console.log(JSON.stringify({
    status:x.status,reason:x.reason||null,provider:x.provider||null,
    model:x.model||null,source_checked:x.source_checked||false,
    source_sha256:x.source_sha256||null,
    draft_length:String(x.draft||'').length,
    draft_preview:String(x.draft||'').replace(/\s+/g,' ').slice(0,250),
    actions:x.external_actions||0,posts:x.posts_published||0,
    owner_approval_required:x.owner_approval_required||false,
    note:'MANUAL_SMOKE_ONLY_NO_DURABLE_QUOTA'
  }));
  if(x.status!=='DRAFT_FOR_OWNER_REVIEW')process.exitCode=1;
}).catch(e=>{console.error('SMOKE_FAILED',String(e));process.exitCode=2;});
