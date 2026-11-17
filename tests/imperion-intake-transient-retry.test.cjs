'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('imperion-intake-sync.gs', 'utf8');
const helperMatch = source.match(/function impOpenCrmWithRetry_\(sheetId\)\{[\s\S]*?\n\}/);
assert.ok(helperMatch, 'the bounded Google Sheets retry helper must exist');

function harness(messages) {
  const failures = [...messages];
  const calls = [];
  const sleeps = [];
  const context = {
    SpreadsheetApp: {
      openById(id) {
        calls.push(id);
        const next = failures.shift();
        if (next) throw new Error(next);
        return { id };
      }
    },
    Utilities: { sleep(ms) { sleeps.push(ms); } },
    Math
  };
  const open = vm.runInNewContext(helperMatch[0] + '\nimpOpenCrmWithRetry_;', context);
  return { open, calls, sleeps };
}

test('private sync opens the existing CRM through the read-only retry helper', () => {
  assert.match(source, /function imperionSyncPrivateIntake\(\)\{[\s\S]*?impOpenCrmWithRetry_\(cfg\.sheetId\)/);
  const h = harness([]);
  assert.equal(h.open('existing-crm').id, 'existing-crm');
  assert.deepEqual(h.calls, ['existing-crm']);
  assert.deepEqual(h.sleeps, []);
});

test('two transient spreadsheet/storage failures recover without changing the sheet ID', () => {
  const h = harness([
    'Exception: Service Spreadsheets failed while accessing document with id existing-crm',
    "We're sorry, a server error occurred while reading from storage. Error code INTERNAL"
  ]);
  assert.equal(h.open('existing-crm').id, 'existing-crm');
  assert.deepEqual(h.calls, ['existing-crm', 'existing-crm', 'existing-crm']);
  assert.equal(h.sleeps.length, 2);
  assert.ok(h.sleeps[0] >= 1000 && h.sleeps[0] < 1250);
  assert.ok(h.sleeps[1] >= 2000 && h.sleeps[1] < 2250);
});

test('persistent transient failure stops after three attempts and propagates the error', () => {
  const h = harness(Array(3).fill('Service Spreadsheets timed out while accessing document with id existing-crm'));
  assert.throws(() => h.open('existing-crm'), /Service Spreadsheets timed out/);
  assert.equal(h.calls.length, 3);
  assert.equal(h.sleeps.length, 2);
});

test('permission and configuration failures are never retried', () => {
  for (const error of ['Authorization is required', 'You do not have permission', 'Missing existing CRM spreadsheet ID']) {
    const h = harness([error]);
    assert.throws(() => h.open('existing-crm'), /.+/);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.sleeps, []);
  }
});
