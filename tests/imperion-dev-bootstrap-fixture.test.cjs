'use strict';
// Independent trusted owner test for a NEW module. The acceptance switch keeps
// the repository's normal test suite green before the new module exists.
const test=require('node:test');
const assert=require('node:assert/strict');
if(process.env.IMPERION_DEV_BOOTSTRAP_ACCEPTANCE==='1'){
 const {bonusPoints}=require('../ops/imperion-dev-cloud-fixture/multi-bonus.cjs');
 test('bonusPoints adds positive integer values',()=>{
  assert.equal(bonusPoints(7,3),10);
  assert.equal(bonusPoints(0,5),5);
 });
 test('bonusPoints permits negative deltas',()=>{
  assert.equal(bonusPoints(8,-3),5);
  assert.equal(bonusPoints(0,0),0);
 });
}else{
 test('new module acceptance is opt-in and no module is imported', {skip:true},()=>{});
}
