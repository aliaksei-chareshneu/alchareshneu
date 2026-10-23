'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, LOOPBACK, ALLOWED_MODELS, ACTIONS, selectLocalModel, readLocalModels, showStatus, localChat, setupLocalModel } = require('../ops/imperion-ai.cjs');

test('launcher stays inside the existing source repository', () => {
  assert.equal(ROOT, path.resolve(__dirname, '..'));
  assert.equal(LOOPBACK, 'http://127.0.0.1:11434');
  assert.deepEqual(ALLOWED_MODELS, ['qwen3:4b', 'qwen3:0.6b']);
  assert.ok(!ACTIONS.includes('install'));
  assert.ok(!ACTIONS.includes('publish'));
  assert.ok(!ACTIONS.includes('pay'));
  assert.ok(ACTIONS.includes('setup-model'));
});

test('local Qwen selection prefers installed 4B and rejects cloud aliases', () => {
  assert.equal(selectLocalModel(['qwen3:0.6b']), 'qwen3:0.6b');
  assert.equal(selectLocalModel(['qwen3:0.6b', 'qwen3:4b']), 'qwen3:4b');
  assert.equal(selectLocalModel(['qwen3:cloud', 'other']), null);
  assert.equal(selectLocalModel(null), null);
});

test('status reads only literal local tags and performs no external requests', async () => {
  const calls = [];
  const lines = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method });
    return { ok: true, json: async () => ({ models: [{ name: 'qwen3:0.6b' }, { name: 'qwen3:cloud' }] }) };
  };
  const local = await readLocalModels(fetchImpl);
  assert.equal(local.selected, 'qwen3:0.6b');
  await showStatus({ output: line => lines.push(line), fetchImpl });
  assert.ok(lines.some(line => line.includes('QUALITY WARNING')));
  assert.ok(lines.some(line => line.includes('Microsoft 365')));
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url === LOOPBACK + '/api/tags' && call.method === 'GET'));
});

test('unavailable local Ollama is honestly reported instead of falling back to paid model', async () => {
  const lines = [];
  await showStatus({ output: line => lines.push(line), fetchImpl: async () => { throw Error('localhost closed'); } });
  assert.ok(lines.some(line => line.includes('OFFLINE OR NOT VERIFIED')));
  assert.ok(lines.some(line => line.includes('no cloud fallback')));
  await assert.rejects(localChat({ fetchImpl: async () => ({
    ok: true, json: async () => ({ models: [{ name: 'qwen3:cloud' }] }),
  }) }), /NO_ALLOWED_LOCAL_MODEL/);
});

test('help is available with no installation or provider network', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'ops', 'imperion-ai.cjs'), 'help'], { encoding: 'utf8', timeout: 8000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /IMPERION AI/);
  assert.match(r.stdout, /sandbox/);
  assert.match(r.stdout, /QA_BLOCKED/);
});

test('no-arg preview remains offline and preserves synthetic job ID', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'ops', 'imperion-ai.cjs'), 'preview'], { encoding: 'utf8', timeout: 8000 });
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.status, 'PREVIEW_PASS');
  assert.equal(result.published, false);
  assert.equal(result.paid_calls, 0);
  assert.equal(result.existing_job_id, 'PUB-SYNTHETIC-001');
});

test('Windows menu includes only explicit safe actions and no implicit service activation', () => {
  const content = fs.readFileSync(path.join(ROOT, 'ops', 'IMPERION-AI.cmd'), 'utf8');
  assert.match(content, /choice \/C 0123456789/i);
  assert.match(content, /imperion-ai\.cjs" status/i);
  assert.match(content, /imperion-ai\.cjs" editor/i);
  assert.match(content, /imperion-ai\.cjs" codex/i);
  assert.match(content, /imperion-ai\.cjs" agy/i);
  assert.match(content, /imperion-ai\.cjs" setup-model/i);
  assert.doesNotMatch(content, /winget install|npm install|--dangerously|auto[- ]publish/i);
});
