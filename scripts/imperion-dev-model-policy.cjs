'use strict';
// Existing IMPERION Developer #1: selectable local CPU model, never an API key.
// A model switch is operator-controlled via GitHub repository variable only.
// No automatic fallback to a billable API or unverified remote endpoint.
const DEFAULT_MODEL='qwen3:4b-instruct';
const ALLOWED_MODELS=Object.freeze(['qwen3:4b-instruct','qwen3.5:4b']);
function selectedModel(env=process.env){
  const candidate=env.IMPERION_DEV_MODEL===undefined||env.IMPERION_DEV_MODEL===''?
    DEFAULT_MODEL:env.IMPERION_DEV_MODEL;
  if(typeof candidate!=='string'||!ALLOWED_MODELS.includes(candidate))
    throw Error('IMPERION_DEV_MODEL_NOT_ALLOWED');
  return candidate;
}
function check(){
  const model=selectedModel();
  // This is an allowlist check, not a claim the alternative model has passed hosted acceptance.
  process.stdout.write(JSON.stringify({status:'MODEL_ALLOWLIST_OK',model,
    transport:'LOCAL_OLLAMA_HTTP_ONLY',paid_api:false,auto_fallback:false})+'\n');
}
if(require.main===module){
  try{check()}catch(e){
    console.error(e.message==='IMPERION_DEV_MODEL_NOT_ALLOWED'?e.message:'MODEL_POLICY_BLOCKED');
    process.exitCode=9;
  }
}
module.exports={DEFAULT_MODEL,ALLOWED_MODELS,selectedModel};
