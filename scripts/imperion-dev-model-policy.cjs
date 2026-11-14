'use strict';
// Developer Agent #1: same controller, selectable verified FREE public-code provider.
// No consumer subscription, external agent account, paid tier or silent fallback.
const DEFAULT_PROVIDER='groq';
const DEFAULT_MODEL='openai/gpt-oss-120b';
const MODELS=Object.freeze({
  groq:Object.freeze(['openai/gpt-oss-120b','qwen/qwen3.8-27b']),
  ollama:Object.freeze(['qwen3:4b-instruct','qwen3.5:4b'])
});
const ALLOWED_MODELS=Object.freeze([...MODELS.groq,...MODELS.ollama]);
function selectedProvider(env=process.env){
 const value=env.IMPERION_DEV_PROVIDER;
 const provider=value===undefined||value===''?DEFAULT_PROVIDER:value;
 if(!Object.hasOwn(MODELS,provider))throw Error('IMPERION_DEV_PROVIDER_NOT_ALLOWED');
 return provider;
}
function selectedModel(env=process.env){
 const provider=selectedProvider(env), raw=env.IMPERION_DEV_MODEL;
 const model=raw===undefined||raw===''?(provider==='groq'?DEFAULT_MODEL:MODELS.ollama[0]):raw;
 if(typeof model!=='string'||!MODELS[provider].includes(model))
  throw Error('IMPERION_DEV_MODEL_NOT_ALLOWED');
 return model;
}
function assertRuntimeAccess(env=process.env){
 const provider=selectedProvider(env),model=selectedModel(env);
 if(provider==='groq'&&
    (!env.GROQ_API_KEY||env.GROQ_VERIFIED_FREE_PLAN!=='true'||
     env.IMPERION_DEV_FREE_ONLY!=='FREE-ONLY'))
  throw Error('GROQ_FREE_ACCESS_NOT_VERIFIED');
 if(provider==='groq'&&
    (!env.GITHUB_REPOSITORY||env.GITHUB_REPOSITORY!=='aliaksei-chareshneu/alchareshneu'||
     !['pull_request','issue_comment'].includes(env.GITHUB_EVENT_NAME)))
  throw Error('GROQ_TRUSTED_GITHUB_EVENT_REQUIRED');
 return {provider,model};
}
function check(){
 const provider=selectedProvider(),model=selectedModel();
 if(process.argv.includes('--runtime'))assertRuntimeAccess();
 console.log(JSON.stringify({status:'MODEL_ALLOWLIST_OK',provider,model,
  free_only:true,paid_fallback:false,billing_proof:'NOT_INDEPENDENTLY_VERIFIED'}));
}
if(require.main===module)try{check()}catch(e){
 console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'MODEL_POLICY_BLOCKED');
 process.exitCode=9;
};
module.exports={DEFAULT_PROVIDER,DEFAULT_MODEL,MODELS,ALLOWED_MODELS,
 selectedProvider,selectedModel,assertRuntimeAccess};
