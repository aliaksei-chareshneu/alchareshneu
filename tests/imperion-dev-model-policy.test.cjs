'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../scripts/imperion-dev-model-policy.cjs');
test('existing cloud Qwen remains exact default and second CPU candidate is opt-in',()=>{
  assert.equal(P.selectedModel({}),P.DEFAULT_MODEL);
  assert.equal(P.selectedModel({IMPERION_DEV_MODEL:''}),P.DEFAULT_MODEL);
  assert.equal(P.selectedModel({IMPERION_DEV_MODEL:'qwen3.5:4b'}),'qwen3.5:4b');
  assert.deepEqual(P.ALLOWED_MODELS,['qwen3:4b-instruct','qwen3.5:4b']);
});
test('reject unknown models, CLI injection, paid API fallback, malformed values',()=>{
  for(const value of ['gpt-4o','https://api.example.invalid','qwen3:9b',
    'qwen3.5:4b; echo unsafe','qwen3:4b-instruct\nNEXT',' QWEN3:4B-INSTRUCT',null,17]){
    assert.throws(()=>P.selectedModel({IMPERION_DEV_MODEL:value}),
      /IMPERION_DEV_MODEL_NOT_ALLOWED/);
  }
});
test('workflow has fail-closed model check and selected model is pulled on CPU',()=>{
  const fs=require('node:fs');
  const y=fs.readFileSync(require('node:path').join(__dirname,
    '../.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
  assert.match(y,/IMPERION_DEV_MODEL/);
  assert.match(y,/node scripts\/imperion-dev-model-policy\.cjs/);
  assert.match(y,/ollama pull "\$IMPERION_DEV_MODEL"/);
  assert.doesNotMatch(y,/sk-proj-|OPENAI_API_KEY|auto.merge.*true/i);
});
