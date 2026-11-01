'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REQUIRED, runAudit, linkWithId } = require('../ops/imperion-public-gates.cjs');

test('attribute order in CTA tags does not matter', () => {
  assert.equal(linkWithId('<a class="btn" href="corporate/" id="heroCorporateCta">Companies</a>', 'heroCorporateCta'), 'corporate/');
});
test('real public pages pass entrypoint and safety checks', () => {
  const root = path.resolve(__dirname, '..');
  const docs = Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const report = runAudit(docs);
  assert.equal(report.status, 'PASS', JSON.stringify(report.errors));
  assert.equal(report.cash_verified, false);
  assert.equal(report.production_verified, false);
});
test('precise unverified business location is a blocker', () => {
  const root = path.resolve(__dirname, '..');
  const docs = Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  docs['index.html'] = docs['index.html'].replace('"areaServed": "Brno"', '"areaServed": "Brno", "streetAddress":"unverified-address"');
  // Ensure the test exercises a structured address regardless of source formatting.
  docs['index.html'] = docs['index.html'].replace('"@type": "ProfessionalService"', '"@type": "ProfessionalService", "streetAddress": "unverified-address"');
  const report = runAudit(docs);
  assert.ok(report.errors.some(item => item.id === 'schema:unverified-address'), JSON.stringify(report.errors));
});
