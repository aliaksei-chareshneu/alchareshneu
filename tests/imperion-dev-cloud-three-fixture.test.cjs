'use strict';
// Pre-existing independent oracle for three synthetic PUBLIC arithmetic modules.
// The model cannot edit this file or invent expected values.
const test=require('node:test');
const assert=require('node:assert/strict');
const {netPrice}=require('../ops/imperion-dev-cloud-fixture/multi-price.cjs');
const {totalWithDelivery}=require('../ops/imperion-dev-cloud-fixture/multi-shipping.cjs');
const {reduceByAmount}=require('../ops/imperion-dev-cloud-fixture/multi-discount.cjs');
test('three-file synthetic price behavior',()=>{
 assert.equal(netPrice(13,3),39);
 assert.equal(netPrice(13,0),0);
});
test('three-file synthetic delivery behavior',()=>{
 assert.equal(totalWithDelivery(39,6),45);
 assert.equal(totalWithDelivery(0,6),6);
});
test('three-file synthetic reduction behavior',()=>{
 assert.equal(reduceByAmount(45,5),40);
 assert.equal(reduceByAmount(0,0),0);
});
