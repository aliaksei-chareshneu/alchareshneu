'use strict';
// Offline check only; no external requests, GitHub writes, billing or browser side effects.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const worker=require('../scripts/imperion-dev-cloud-issue.cjs');
const profile=fs.readFileSync(path.join(root,'.github/agents/imperion-dev.agent.md'),'utf8');
const mobile=fs.readFileSync(path.join(root,'docs/imperion-dev-android.md'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');

test('public DEV profile is review-only, not an autonomous privileged coder',()=>{
  assert.match(profile,/^---\nname: imperion-dev\ndescription: [^\n]+\n---\n/);
  for(const phrase of ['AGENTS.md','Issue #245','Qwen3:4b-instruct',
       'NEVER auto-merge','Draft PR','zmrzlina','GitHub Copilot','NOT VERIFIED',
       'BLOCKED','secrets','tests'])
    assert.ok(profile.includes(phrase),'profile lacks '+phrase);
  assert.doesNotMatch(profile,/auto-merge: true|payment_method|GITHUB_TOKEN\s*=|OPENAI_API_KEY\s*=/);
  assert.ok(!worker.safeSourceFile('.github/agents/imperion-dev.agent.md'));
});

test('Android guide distinguishes actual Qwen cloud from blocked native Copilot',()=>{
  for(const phrase of ['Android','Assignees','Copilot','NOT YET VERIFIED','BLOCKED',
    'Draft PR','zmrzlina','0 Kč','issues/245','issues/195',
    '/imperion-dev build cloud-profile','runner/cache usage','#43094143252'])
    assert.ok(mobile.includes(phrase),'mobile guide lacks '+phrase);
  assert.doesNotMatch(mobile,/Copilot (is )?ACTIVE|unlimited free|automatically merge|production live verified/i);
});

test('one-file and two-file example owner commands parse under the live controller',()=>{
  const commands=[...mobile.matchAll(/\x60\x60\x60text\n(\/imperion-dev cloud[\s\S]*?)\n\x60\x60\x60/g)]
    .map(m=>m[1]);
  assert.equal(commands.length,2,'expected exactly two executable owner examples');
  const a=worker.parseCommand(commands[0]);
  const b=worker.parseCommand(commands[1]);
  assert.equal(a.file,'scripts/imperion-public-example.cjs');
  assert.equal(a.test,'tests/imperion-public-example.test.cjs');
  assert.equal(a.file2,undefined);
  assert.equal(b.file2,'ops/imperion-dev-cloud-fixture/multi-shipping.cjs');
  assert.equal(b.test,'tests/imperion-dev-cloud-multi-fixture.test.cjs');
});

test('independent acceptance runs in actual preflight; publisher cannot auto merge',()=>{
  assert.ok(workflow.includes('tests/imperion-dev-cloud-acceptance.test.cjs'));
  assert.ok(workflow.includes('tests/imperion-dev-cloud-issue.test.cjs'));
  assert.ok(workflow.includes('github.event.issue.number == 245') ||
    workflow.includes("github.event.issue.user.login == 'aliaksei-chareshneu'"),
    'Cloud intake must enforce either exact issue 245 or owner-created issue');
  assert.ok(workflow.includes('gh pr create --draft'));
  assert.doesNotMatch(workflow,/gh pr merge|git push origin main|\bdeploy --prod\b/);
});
