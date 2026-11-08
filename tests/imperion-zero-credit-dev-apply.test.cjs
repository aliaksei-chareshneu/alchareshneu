'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../scripts/imperion-zero-credit-dev-apply.cjs');
const V=require('../scripts/imperion-zero-credit-dev-validate.cjs');
const original="const utmSuffix=utmLabels.join('_');\nconst source=utmSuffix\n  ? (baseSource.slice(0,Math.max(2,65-2-utmSuffix.length))+'__'+utmSuffix).slice(0,65)\n  : baseSource;\n const body={source};";
const modelCode="const source=utmLabels.length?(baseSource.slice(0,Math.max(2,65-2-utmLabels.join('_').length)))+'__'+utmLabels.join('_'):baseSource;";
const proof=()=>V.validate({model:'qwen3:4b-instruct',status:'MODEL_CODE_PROPOSED_PENDING_SANDBOX',code:modelCode});
test('sandbox model output safely becomes a review-only change in the existing source',()=>{
 const data=proof();
 assert.equal(data.cases_passed,7);
 const after=A.apply(original,data);
 assert.match(after,/const source=\(\(\)=>/);
 assert.match(after,/source\.slice\(0,65\)/);
 assert.match(after,/const utmSuffix=utmLabels\.join/);
 assert.match(after,/const body=\{source\}/);
 assert.ok(after.length>original.length);
});
test('refuses missing proof, wrong model, dangerous expression and source drift',()=>{
 const p=proof();
 for(const mutation of [
  {...p,status:'DRAFT_ONLY'}, {...p,model:'paid-model'},
  {...p,production_effects:1},{...p,cases_passed:6},
  {...p,review_code:"const source=fetch('https://example.com');"},
  {...p,review_code:"const source=2;process.exit(1);"}
 ])assert.throws(()=>A.apply(original,mutation),/REQUIRED|RESTRICTED/);
 assert.throws(()=>A.apply(original.replace('const source=utmSuffix','const source=other'),p),/ANCHOR/);
 assert.throws(()=>A.apply(original+original,p),/ANCHOR_NOT_UNIQUE/);
 assert.throws(()=>A.apply('nothing here',p),/ANCHOR/);
});
