'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'imperion-intake-sync.gs'), 'utf8');

function fixture(messages = []) {
  const start = source.indexOf('function impStartupReadWithRetry_(');
  const end = source.indexOf('/** Run manually once first, then enable owner-created time triggers. */', start);
  assert.ok(start > 0 && end > start, 'bounded read-only startup retry present');
  const calls = [], sleeps = [], warnings = [], errors = [...messages];
  const sandbox = {
    Utilities: {sleep: ms => sleeps.push(ms)},
    console: {warn: text => warnings.push(text)}
  };
  vm.runInNewContext(source.slice(start, end), sandbox);
  const run = operation => sandbox.impStartupReadWithRetry_(() => {
    calls.push('READ');
    const failure = errors.shift();
    if (failure) throw Error(failure);
    return operation();
  });
  return {run, calls, sleeps, warnings};
}

test('canonical Apps Script source parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(source));
});

test('only private config and existing spreadsheet open are wrapped', () => {
  assert.match(source, /var cfg=impStartupReadWithRetry_\(function\(\)\{return impPrivateConfig_\(\);\}\)/);
  assert.match(source, /ss=impStartupReadWithRetry_\(function\(\)\{return SpreadsheetApp.openById\(cfg.sheetId\);\}\)/);
  assert.equal((source.match(/impStartupReadWithRetry_\(/g) || []).length, 3);
  assert.doesNotMatch(source, /impStartupReadWithRetry_\(function\(\)\{return impPrivateFetch_/);
});

test('first successful read is attempted exactly once', () => {
  const f = fixture();
  assert.equal(f.run(() => 'READY'), 'READY');
  assert.equal(f.calls.length, 1);
  assert.equal(f.sleeps.length, 0);
});

test('transient config storage error recovers without a write', () => {
  const f = fixture(["We're sorry, a server error occurred while reading from storage. Error code INTERNAL"]);
  assert.equal(f.run(() => 'CONFIG'), 'CONFIG');
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.sleeps, [500]);
});

test('two transient spreadsheet failures retry at most twice', () => {
  const f = fixture([
    'Service Spreadsheets failed while accessing document with id existing-crm',
    'Service Spreadsheets timed out while accessing document with id existing-crm'
  ]);
  assert.equal(f.run(() => 'CRM'), 'CRM');
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.sleeps, [500, 1500]);
  assert.equal(f.warnings.length, 2);
});

test('permission and configuration errors fail closed without retry', () => {
  for (const error of ['Authorization is required', 'You do not have permission', 'Missing existing CRM spreadsheet ID']) {
    const f = fixture([error]);
    assert.throws(() => f.run(() => 'NO'), new RegExp(error));
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.sleeps, []);
  }
});

test('persistent transient errors rethrow after max three attempts', () => {
  const f = fixture(Array(3).fill('server error occurred'));
  assert.throws(() => f.run(() => 'NO'), /server error occurred/);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.sleeps, [500, 1500]);
});
