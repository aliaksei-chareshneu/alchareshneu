'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(process.env.INTAKE_HTML || path.join(__dirname, '../corporate/request/index.html'), 'utf8');
const cspTag = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
assert.ok(cspTag, 'intake has a CSP');
const policy = Object.fromEntries(cspTag[1].split(';').map(s => s.trim().split(/\s+/)).filter(p => p[0]).map(([key, ...values]) => [key, values]));
test('intake permits only own external shell scripts', () => {
  assert.deepEqual(policy['script-src'], ["'self'", "'unsafe-inline'"]);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
  assert.ok(scripts.some(s => s.includes('unified-shell.js')));
  for (const src of scripts) {
    assert.equal(new URL(src, 'https://example.test/corporate/request/').origin, 'https://example.test');
  }
});
test('intake keeps its network and native form restrictions', () => {
  assert.deepEqual(policy['default-src'], ["'none'"]);
  assert.deepEqual(policy['connect-src'], ['https://cmrknyhnnehyjpreehcf.supabase.co']);
  assert.deepEqual(policy['form-action'], ["'none'"]);
  assert.deepEqual(policy['base-uri'], ["'none'"]);
  assert.ok(!cspTag[1].includes('*'));
});
