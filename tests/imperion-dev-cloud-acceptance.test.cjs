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

test('Stage 9 docs match real owner-created-issue and bounded Python controller',()=>{
  const ops=fs.readFileSync(path.join(root,'docs/imperion-dev-cloud-issue.md'),'utf8');
  for(const text of ['Stage 9 LIVE','Issue #293','#43422929579','Draft PR #294'])
    assert.ok(ops.includes(text),'operating runbook lacks verified Stage9 evidence '+text);
  assert.ok(mobile.includes('Stage 9 Python mode is now LIVE'));
  assert.ok(profile.includes('tests/test_*.py'));
  assert.ok(profile.includes('any open public Issue'));
  assert.equal(worker.safeSourceFile('ops/imperion-dev-cloud-fixture/normalize_py.py'),true);
  assert.equal(worker.safeTestFile('tests/test_imperion_dev_cloud_python_fixture.py'),true);
  assert.equal(worker.safeSourceFile('docs/imperion-dev-android.md'),true);
  assert.equal(worker.safeSourceFile('.github/workflows/imperion-dev-cloud-issue.yml'),false);
  const e={action:'created',repository:{full_name:worker.REPO},
    issue:{number:293,state:'open',user:{login:'aliaksei-chareshneu'}},
    sender:{login:'aliaksei-chareshneu'},
    comment:{id:6852467457,user:{login:'aliaksei-chareshneu'},
      author_association:'OWNER',body:'/imperion-dev cloud\nfile: ops/imperion-dev-cloud-fixture/normalize_py.py\ntest: tests/test_imperion_dev_cloud_python_fixture.py\ngoal: Correct total(items) by multiplying price by qty without any imports'}};
  const accepted=worker.taskFromEvent(e);
  assert.equal(accepted.issue,293);
  assert.equal(accepted.test,'tests/test_imperion_dev_cloud_python_fixture.py');
  assert.equal(worker.reviewBranch(293,6852467457),'agent/imperion-dev-cloud-293-6852467457');
  assert.throws(()=>worker.taskFromEvent({...e,issue:{...e.issue,user:{login:'somebody-else'}}}),/UNTRUSTED_TRIGGER_REJECTED/);
  assert.throws(()=>worker.parseCommand(e.comment.body.replace('test_imperion_dev_cloud_python_fixture.py','wrong.test.cjs')),/TASK_PATH_REJECTED/);
});
