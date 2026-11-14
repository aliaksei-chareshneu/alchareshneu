'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const P=require('../scripts/imperion-dev-model-policy.cjs');
test('Project00 Groq GPT-OSS 120B becomes default; Qwen remains explicit reserve',()=>{
 assert.equal(P.selectedProvider({}),'groq');
 assert.equal(P.selectedModel({}),'openai/gpt-oss-120b');
 assert.equal(P.selectedModel({IMPERION_DEV_MODEL:'qwen/qwen3.8-27b'}),'qwen/qwen3.8-27b');
 assert.equal(P.selectedModel({IMPERION_DEV_PROVIDER:'ollama'}),'qwen3:4b-instruct');
 assert.equal(P.selectedModel({IMPERION_DEV_PROVIDER:'ollama',IMPERION_DEV_MODEL:'qwen3.5:4b'}),'qwen3.5:4b');
});
test('wrong provider, unknown paid models and cross-provider selection fail closed',()=>{
 for(const value of ['openrouter','https://api.groq.com','codex',null,55])
  assert.throws(()=>P.selectedProvider({IMPERION_DEV_PROVIDER:value}),/PROVIDER_NOT_ALLOWED/);
 for(const value of ['claude-opus-4-6','qwen3:4b-instruct','sk-something','gpt-4o','qwen3.8-27b',null,55])
  assert.throws(()=>P.selectedModel({IMPERION_DEV_MODEL:value}),/MODEL_NOT_ALLOWED/);
 assert.throws(()=>P.selectedModel({IMPERION_DEV_PROVIDER:'ollama',IMPERION_DEV_MODEL:'openai/gpt-oss-120b'}),/MODEL_NOT_ALLOWED/);
});
test('no Groq key/free-only gate, untrusted GH trigger and arbitrary provider never invoke',()=>{
 const valid={IMPERION_DEV_PROVIDER:'groq',GROQ_API_KEY:'synthetic',
  GROQ_VERIFIED_FREE_PLAN:'true',IMPERION_DEV_FREE_ONLY:'FREE-ONLY',
  GITHUB_REPOSITORY:'aliaksei-chareshneu/alchareshneu',GITHUB_EVENT_NAME:'issue_comment'};
 assert.deepEqual(P.assertRuntimeAccess(valid),{provider:'groq',model:'openai/gpt-oss-120b'});
 for(const key of ['GROQ_API_KEY','GROQ_VERIFIED_FREE_PLAN','IMPERION_DEV_FREE_ONLY']){
  assert.throws(()=>P.assertRuntimeAccess({...valid,[key]:''}),/GROQ_FREE_ACCESS_NOT_VERIFIED/);
 }
 assert.throws(()=>P.assertRuntimeAccess({...valid,GITHUB_EVENT_NAME:'push'}),/GROQ_TRUSTED_GITHUB_EVENT_REQUIRED/);
 assert.throws(()=>P.assertRuntimeAccess({...valid,GITHUB_REPOSITORY:'evil/other'}),/GROQ_TRUSTED_GITHUB_EVENT_REQUIRED/);
 assert.deepEqual(P.assertRuntimeAccess({IMPERION_DEV_PROVIDER:'ollama'}),{provider:'ollama',model:'qwen3:4b-instruct'});
});
test('workflow uses existing Groq secret, conservative usage gate and reserve-only Ollama',()=>{
 const y=fs.readFileSync(path.join(__dirname,'../.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
 assert.match(y,/IMPERION_DEV_PROVIDER:/);
 assert.match(y,/secrets\.GROQ_API_KEY/);
 assert.match(y,/imperion-dev-groq-quota\.cjs/);
 assert.match(y,/imperion-dev-model-policy\.cjs --runtime/);
 assert.match(y,/env\.IMPERION_DEV_PROVIDER == 'ollama'/);
 assert.match(y,/ollama pull "\$selected_model"/);
 assert.doesNotMatch(y,/OPENAI_API_KEY|sk-proj-|auto.merge.*true/);
});
