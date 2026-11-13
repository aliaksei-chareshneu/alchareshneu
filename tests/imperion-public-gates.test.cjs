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


test('verified Academy-capable form passes, arbitrary external form fails closed', () => {
  const root = path.resolve(__dirname, '..');
  const docs = Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  assert.ok(!runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
  const known='https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform';
  docs['academy/index.html']=docs['academy/index.html'].replace(/(id="navBookBtn"[^>]*href=")[^"]*"/, '$1https://docs.google.com/forms/d/e/unknown/viewform"');
  assert.ok(runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
});
test('catalogue-first Academy is allowed only with verified course contacts', () => {
  const root=path.resolve(__dirname,'..');
  const docs=Object.fromEntries(REQUIRED.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
  assert.ok(!runAudit(docs).errors.some(x=>x.id==='academy:relevant-contact'));
  const original=docs['academy/courses/index.html'];
  docs['academy/courses/index.html']=original.replaceAll('https://wa.me/420702914842?text=','https://example.invalid/contact?text=');
  assert.ok(runAudit(docs).errors.some(x=>x.id==='academy:relevant-contact'),'catalogue cannot lead to arbitrary/unverified contact');
  docs['academy/courses/index.html']=original.replaceAll('https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform','https://example.invalid/intake');
  assert.ok(runAudit(docs).errors.some(x=>x.id==='academy:relevant-contact'),'catalogue must retain verified fallback form');
  docs['academy/courses/index.html']=original;
  docs['academy/index.html']=docs['academy/index.html'].replace('href="courses/?lang=cs"','href="https://example.invalid/"');
  assert.ok(runAudit(docs).errors.some(x=>x.id==='academy:relevant-contact'),'external shortcut fails closed');
});
test('an Academy WhatsApp number other than the verified one is blocked', () => {
  const root=path.resolve(__dirname,'..');
  const docs=Object.fromEntries(REQUIRED.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
  docs['academy/index.html']=docs['academy/index.html'].replace(/(id="navBookBtn"[^>]*href=")[^"]*"/,'$1https://wa.me/000000000000?text=Academy%20enquiry"');
  assert.ok(runAudit(docs).errors.some(x=>x.id==='academy:relevant-contact'));
});
test('an Academy-specific WhatsApp enquiry is an allowed alternative', () => {
  const root = path.resolve(__dirname, '..');
  const docs = Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const known='https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform';
  docs['academy/index.html']=docs['academy/index.html'].replace(/(id="navBookBtn"[^>]*href=")[^"]*"/, '$1https://wa.me/420702914842?text=Academy%20enquiry"');
  assert.ok(!runAudit(docs).errors.some(x => x.id === 'academy:relevant-contact'));
});

const loadPages = () => {
  const root = path.resolve(__dirname, '..');
  return Object.fromEntries(REQUIRED.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
};
test('homepage is consumer-first and every intent keeps its guarded destination', () => {
  const docs = loadPages();
  const home = docs['index.html'];
  assert.equal(linkWithId(home,'heroCta'), 'https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform');
  assert.equal(linkWithId(home,'intentDruzinaCta'), 'register/?lang=en');
  assert.equal(linkWithId(home,'intentWalkersCta'), 'register/en/');
  assert.equal(linkWithId(home,'intentBusinessCta'), 'corporate/');
  assert.equal(linkWithId(home,'heroCorporateCta'), 'start/?lang=en');
  assert.equal(runAudit(docs).status, 'PASS');
});
test('public home blocks redirect to arbitrary third-party sales or booking pages', () => {
  for (const [id,invalid,check] of [
    ['heroCta','https://example.com/fake-booking','root:academy-route'],
    ['intentDruzinaCta','https://example.com/checkout','root:druzina-route'],
    ['intentWalkersCta','https://example.com/checkout','root:walkers-route'],
    ['intentBusinessCta','https://example.com/agency','root:corporate-route'],
    ['heroCorporateCta','https://example.com/catalog','root:audience-route']
  ]) {
    const docs = loadPages();
    const original = linkWithId(docs['index.html'],id);
    docs['index.html'] = docs['index.html'].replace('href="'+original+'"'+(id==='intentBusinessCta'?' data-intent="business"':''),
      'href="'+invalid+'"'+(id==='intentBusinessCta'?' data-intent="business"':''));
    // Ensure the mutation actually targets the audited anchor, not another link.
    assert.equal(linkWithId(docs['index.html'],id),invalid,id);
    assert.ok(runAudit(docs).errors.some(e=>e.id===check), id+' missing '+check);
  }
});
test('home review proof link cannot silently claim a hard-coded rating', () => {
  const docs=loadPages();
  docs['index.html']=docs['index.html'].replace('data-intent="reviews">Read customer reviews on Google','data-intent="reviews">50+ Google reviews · 5.0');
  assert.ok(runAudit(docs).errors.some(e=>e.id==='root:review-link'));
});
