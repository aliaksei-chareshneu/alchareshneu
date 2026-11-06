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


function replaceAcademyNavHref(html, destination) {
  const anchor = html.match(/<a\b(?=[^>]*\bid=["']navBookBtn["'])[^>]*>/i);
  assert.ok(anchor, 'Academy navBookBtn must exist');
  const next = anchor[0].replace(/\bhref=(["'])[^"']*\1/i, 'href="' + destination + '"');
  assert.notEqual(next, anchor[0], 'Academy navBookBtn href must change');
  return html.replace(anchor[0], next);
}

test('verified Academy routes pass but an unknown form fails closed', () => {
  const root = path.resolve(__dirname, '..');
  const docs = Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const actual = linkWithId(docs['academy/index.html'], 'navBookBtn');
  assert.ok(actual.startsWith('https://wa.me/420702914842?'), 'Current Academy nav link changed; review the test');
  const known = 'https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform';
  docs['academy/index.html'] = replaceAcademyNavHref(docs['academy/index.html'], known);
  assert.ok(!runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
  const unknown = 'https://docs.google.com/forms/d/e/unknown/viewform';
  docs['academy/index.html'] = replaceAcademyNavHref(docs['academy/index.html'], unknown);
  assert.equal(linkWithId(docs['academy/index.html'], 'navBookBtn'), unknown);
  assert.ok(runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
});
test('an Academy-specific WhatsApp enquiry is allowed; unrelated WhatsApp is blocked', () => {
  const root = path.resolve(__dirname, '..');
  const docs = Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const known = 'https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform';
  docs['academy/index.html'] = replaceAcademyNavHref(docs['academy/index.html'], known);
  docs['academy/index.html'] = replaceAcademyNavHref(docs['academy/index.html'], 'https://wa.me/420702914842?text=Academy%20enquiry');
  assert.ok(!runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
  docs['academy/index.html'] = replaceAcademyNavHref(docs['academy/index.html'], 'https://wa.me/420702914842?text=General%20enquiry');
  assert.ok(runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
  docs['academy/index.html'] = replaceAcademyNavHref(docs['academy/index.html'], 'https://wa.me/420999999999?text=Academy%20enquiry');
  assert.ok(runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'), 'A plausible Academy message must not allow a different recipient');
});
