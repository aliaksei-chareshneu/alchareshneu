'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const workflow=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/imperion-autopilot.yml'),'utf8');

test('Pages provider readback retains the failing node exit code when piped through tee',()=>{
  const step=workflow.split('      - name: Independently verify published Pages responses (fail closed)')[1]||'';
  assert.match(step,/shell:\s*bash/);
  assert.match(step,/run:\s*\|\s*\n\s*set -euo pipefail\s*\n\s*node scripts\/imperion-live-readback\.cjs\s*\|\s*tee/);
  const result=spawnSync('bash',['-e','-o','pipefail','-c','exit 17 | tee /dev/null'],{encoding:'utf8'});
  assert.equal(result.status,17);
});
test('readback is not mistaken for social delivery or a bank receipt',()=>{
  assert.match(workflow,/Social drafts require approval/);
  assert.doesNotMatch(workflow,/curl.+api\.telegram\.org/);
  assert.match(workflow,/tests\/imperion-free-model-router\.test\.cjs/);
});
