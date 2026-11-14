'use strict';
// AUTO-GENERATED ADVISORY TEST: model data, trusted template; review before merge.
const test=require('node:test');
const assert=require('node:assert/strict');
const mod=require("../../ops/imperion-dev-cloud-fixture/multi-price.cjs");
const cases=[{"name":"positive_quantity","args":[13,3],"expected":39},{"name":"zero_quantity","args":[13,0],"expected":0},{"name":"negative_quantity","args":[13,-5],"expected":0}];
const name="netPrice";
for(const c of cases){
 test("AI advisory: "+c.name,()=>{
  assert.equal(typeof mod[name],"function");
  assert.deepStrictEqual(mod[name](...c.args),c.expected);
 });
}
