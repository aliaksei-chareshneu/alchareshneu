'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'imperion-intake-sync.gs'), 'utf8');

function fixture() {
  const start = source.indexOf('function impIntakeTransientGoogleRetry_(');
  const end = source.indexOf('function impPrivateConfig_(){', start);
  assert.ok(start > 0 && end > start, 'startup retry helper present');
  const sleeps = [], logs = [];
  const sandbox = {
    Utilities: {sleep: ms => sleeps.push(ms)},
    console: {warn: message => logs.push(message)}
  };
  vm.runInNewContext(source.slice(start, end), sandbox);
  return {call: sandbox.impIntakeTransientGoogleRetry_, sleeps, logs};
}

test('GAS source parses as V8 JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(source));
});

test('only read-only config and spreadsheet open calls are wrapped', () => {
  assert.match(source, /var cfg=impIntakeTransientGoogleRetry_\(function\(\)\{return impPrivateConfig_\(\);\}\)/);
  assert.match(source, /ss=impIntakeTransientGoogleRetry_\(function\(\)\{return SpreadsheetApp.openById\(cfg.sheetId\);\}\)/);
  assert.doesNotMatch(source, /impIntakeTransientGoogleRetry_\(function\(\)\{return impPrivateFetch_/);
});

test('transient Google service failures get at most two bounded retries', () => {
  const f = fixture(); let calls = 0;
  assert.equal(f.call(() => {
    if (++calls < 3) throw new Error('Service Spreadsheets failed while accessing document with id fake');
    return 'OK';
  }), 'OK');
  assert.equal(calls, 3);
  assert.deepEqual(f.sleeps, [350, 1000]);
  assert.equal(f.logs.length, 2);
});

test('non-transient permission or schema failures fail immediately', () => {
  const f = fixture(); let calls = 0;
  assert.throws(() => f.call(() => { calls++; throw Error('Missing CRM column'); }), /Missing CRM column/);
  assert.equal(calls, 1);
  assert.equal(f.sleeps.length, 0);
});

test('persistent internal storage errors remain surfaced to the existing trigger', () => {
  const f = fixture(); let calls = 0;
  assert.throws(() => f.call(() => {
    calls++; throw Error('We are sorry, a server error occurred while reading from storage. Error code INTERNAL');
  }), /Error code INTERNAL/);
  assert.equal(calls, 3);
  assert.deepEqual(f.sleeps, [350, 1000]);
});
