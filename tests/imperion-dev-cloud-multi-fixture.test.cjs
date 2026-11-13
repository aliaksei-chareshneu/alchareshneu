'use strict';
// Independent green baseline for controlled, two-file cloud Qwen acceptance.
const test=require('node:test');
const assert=require('node:assert/strict');
const {netPrice}=require('../ops/imperion-dev-cloud-fixture/multi-price.cjs');
const {totalWithDelivery}=require('../ops/imperion-dev-cloud-fixture/multi-shipping.cjs');
test('price fixture is deterministic for empty and positive quantities',()=>{
  assert.equal(netPrice(13,3),39);
  assert.equal(netPrice(0,3),0);
  assert.equal(netPrice(13,0),0);
});
test('delivery fixture adds a known optional component',()=>{
  assert.equal(totalWithDelivery(39,6),45);
  assert.equal(totalWithDelivery(39,0),39);
  assert.equal(totalWithDelivery(0,6),6);
});
