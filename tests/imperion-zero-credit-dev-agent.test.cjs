'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../scripts/imperion-zero-credit-dev-agent.cjs');
const V=require('../scripts/imperion-zero-credit-dev-validate.cjs');
const src="const baseSource=parsed;\nconst utmSuffix=utmLabels.join('_');";
const fixed="const source=utmLabels.length?(baseSource.slice(0,Math.max(2,65-2-utmLabels.join('_').length))+'__'+utmLabels.join('_')).slice(0,65):baseSource;";
test('issue #195 prompt is restricted to public data',()=>{
 const prompt=A.taskPrompt(src);
 assert.match(prompt,/65-character baseSource/);
 assert.match(prompt,/PUBLIC B2B/);
 assert.match(prompt,/no-network container/);
 assert.throws(()=>A.taskPrompt('private CRM'),/PUBLIC_SOURCE_UNVERIFIED/);
 assert.throws(()=>A.parseCandidate('not JSON'),/MODEL_JSON_INVALID/);
 assert.throws(()=>A.parseCandidate(JSON.stringify({source_statement:"const source=fetch('https://example.com');"})),/CODE_SAFETY_REJECTED/);
});
test('mocked Ollama proposal reports model, cost and separate sandbox gate',async()=>{
 const calls=[];
 const result=await A.run({readFile:()=>src,
  fetchImpl:async(url,opt)=>{
   calls.push({url,body:JSON.parse(opt.body)});
   return {ok:true,redirected:false,json:async()=>({
     model:A.MODEL,done:true,response:JSON.stringify({source_statement:fixed}),
     prompt_eval_count:194,eval_count:53,total_duration:4500000
   })};
  }});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,A.ENDPOINT);
 assert.equal(calls[0].body.options.num_gpu,0);
 assert.equal(result.external_api_cost_czk,0);
 assert.equal(result.model_created_pr,false);
 assert.equal(result.status,'MODEL_CODE_PROPOSED_PENDING_SANDBOX');
 assert.equal(result.prompt_tokens,194);
 assert.equal(V.validate(result).cases_passed,7);
});
test('legacy code fails synthetic acceptance instead of being marked complete',()=>{
 const evidence={model:A.MODEL,status:'MODEL_CODE_PROPOSED_PENDING_SANDBOX',code:A.OLD};
 assert.throws(()=>V.validate(evidence),/preserve UTM/);
});
