'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../scripts/imperion-dev-failure-feedback.cjs');
test('extracts only bounded failing test names and numeric oracle diff',()=>{
 const log='TAP version 13\n# Subtest: negative_quantity_is_zero\nnot ok 2 - negative_quantity_is_zero\n  ---\n  error: |-\n    Expected values to be strictly equal:\n    -6 !== 0\n  stack: /home/runner/work/work.js\n  ---\n# tests 2\n# pass 1\n# fail 1\n';
 const obj=JSON.parse(F.extractFeedback(log));
 assert.deepEqual(obj,{origin:'INDEPENDENT_TRUSTED_TEST',failCount:1,
  names:['negative_quantity_is_zero'],diffs:[{actual:'-6',expected:'0'}]});
});
test('never sends token, private path, stack traces, email or huge numeric secret to model',()=>{
 const leaked='sk-this-is-a-fake-secret-with-a-long-token';
 const log='not ok 1 - Bearer token leaked\nnot ok 2 - tests_positive\n  '+leaked+
  '\n  /home/runner/private/project/app.cjs\n  authorized: client@example.com\n  12345678901234 !== 0\n# fail 2\n';
 const out=F.extractFeedback(log);
 assert.equal(out.includes(leaked),false);
 assert.equal(out.includes('/home'),false);
 assert.equal(out.includes('@'),false);
 assert.equal(out.includes('Bearer'),false);
 assert.equal(out.includes('12345678901234'),false);
 assert.deepEqual(JSON.parse(out).names,['tests_positive']);
});
test('rejects green, malformed or oversized test log rather than invent diagnostics',()=>{
 assert.throws(()=>F.extractFeedback('# tests 3\n# pass 3\n# fail 0\n'),/AUTO_TRUSTED_LOG_NO_FAILURE_REJECTED/);
 assert.throws(()=>F.extractFeedback('private '+'x'.repeat(66000)),/AUTO_TRUSTED_LOG_SIZE_REJECTED/);
 assert.throws(()=>F.extractFeedback(null),/AUTO_TRUSTED_LOG_SIZE_REJECTED/);
 assert.equal(F.safeScalar('1000000'),null);
 assert.equal(F.safeScalar('0'), '0');
 assert.equal(F.safeScalar('false'), 'false');
});
