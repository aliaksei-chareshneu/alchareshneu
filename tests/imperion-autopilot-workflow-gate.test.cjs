'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const read = name => fs.readFileSync(path.resolve(__dirname, '../.github/workflows/', name), 'utf8');
const publisher = read('pages-production.yml');
const legacy = read('imperion-autopilot.yml');

test('one scheduled publisher: primary Pages Action refreshes the approved public feed', () => {
  assert.match(publisher, /schedule:\s*\n\s*-\s*cron:\s*'17 \*\/6 \* \* \*'/);
  assert.match(publisher, /node scripts\/imperion-autopilot\.cjs/);
  assert.match(publisher, /uses: actions\/upload-pages-artifact@v4/);
  assert.match(publisher, /uses: actions\/deploy-pages@v4/);
  assert.match(publisher, /group: github-pages-site/);
  assert.match(publisher, /permissions:\s*\n\s*contents: read/);
  assert.match(publisher, /pages: write/);
});

test('published bytes are generated on the SAME build and downloaded for live HTTP readback', () => {
  assert.match(publisher, /Upload exact expected public-only snapshot/);
  assert.match(publisher, /path: _pages\/autopilot\//);
  assert.match(publisher, /uses: actions\/download-artifact@v4/);
  assert.match(publisher, /name: imperion-pages-proof-\$\{\{ github\.run_id \}\}/);
  assert.match(publisher, /path: autopilot/);
  assert.match(publisher, /node scripts\/imperion-live-readback\.cjs/);
  assert.match(publisher, /set -euo pipefail\s*\n\s*node scripts\/imperion-live-readback\.cjs\s*\|\s*tee/);
  assert.ok(publisher.indexOf('Build fresh public feed') < publisher.indexOf('Copy only public website assets'));
  assert.ok(publisher.indexOf('actions/deploy-pages@v4') < publisher.indexOf('actions/download-artifact@v4'));
});

test('retired branch publisher is validation-only, no duplicate publishing or credentials', () => {
  assert.doesNotMatch(legacy, /ref: growth-experience|git push|contents: write|deploy-pages|upload-pages-artifact/);
  assert.doesNotMatch(legacy, /schedule:/);
  assert.match(legacy, /node scripts\/imperion-autopilot\.cjs/);
  assert.match(legacy, /No Pages deploy, CRM export, social post, message or payment/);
  assert.match(legacy, /permissions:\s*\n\s*contents: read/);
});

test('provider readback failure propagates through pipe-to-tee as workflow failure', () => {
  const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', 'exit 17 | tee /dev/null'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 17);
});
