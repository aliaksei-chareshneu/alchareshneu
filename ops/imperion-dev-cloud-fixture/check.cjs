'use strict';
// Trusted deterministic acceptance: failing baseline -> model patch -> passing tests.
const assert = require('node:assert/strict');
const {total} = require('./normalize.cjs');
assert.equal(total([]), 0);
assert.equal(total([{price:7, quantity:3}]), 21);
assert.equal(total([{price:11, quantity:2},{price:4, quantity:5}]), 42);
console.log('IMPERION_CLOUD_MODEL_FIXTURE_3_OF_3_PASS');
