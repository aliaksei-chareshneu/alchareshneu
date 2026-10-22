'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkedFixture, loopbackOnly, localModelId, smoke, BASE, OLLAMA_BASE,
} = require('../ops/ai-local-smoke.cjs');
const job = checkedFixture();

function fakeFetch(calls, translated = job.source_text, opts = {}) {
  return async (url, init) => {
    calls.push({ url, method: init?.method });
    if (url === BASE + '/v1/models') {
      return { ok: opts.failHealth !== true, json: async () => ({ data: opts.emptyIds ? [] : [{ id: opts.wrongId ? 'other-llm-2B' : 'tencent/Hy-MT2-1.8B-GGUF' }] }) };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: translated } }] }) };
  };
}

test('default one-command preflight NEVER accesses network', async () => {
  const r = await smoke({ fetchImpl: () => { throw Error('NO_NETWORK_ALLOWED'); } });
  assert.equal(r.status, 'PREVIEW_PASS');
  assert.equal(r.paid_calls, 0); assert.equal(r.published, false);
  assert.equal(r.existing_job_id, 'PUB-SYNTHETIC-001');
});

test('source is strictly synthetic and public, not editable to real private CRM input', () => {
  assert.throws(() => checkedFixture({ ...job, source_text: 'REAL CLIENT NOTES' }), /PUBLIC_SYNTHETIC_FIXTURE_REQUIRED/);
  assert.throws(() => checkedFixture({ ...job, data_classification: 'PRIVATE' }), /PUBLIC_SYNTHETIC_FIXTURE_REQUIRED/);
  assert.throws(() => checkedFixture({ ...job, external_ai_approved: true }), /PUBLIC_SYNTHETIC_FIXTURE_REQUIRED/);
  assert.throws(() => checkedFixture({ ...job, job_id: 'REAL_CRM_JOB' }), /PUBLIC_SYNTHETIC_FIXTURE_REQUIRED/);
});

test('loopback guard rejects external hosts and unauthorized model paths before fetch', () => {
  const fn = loopbackOnly(() => { throw Error('SHOULD_NOT_CONNECT'); });
  assert.throws(() => fn('https://api.xiaomimimo.com/v1/chat/completions', { method: 'POST' }), /NON_LOCAL_MODEL_REQUEST_BLOCKED/);
  assert.throws(() => fn('http://localhost:8000/v1/chat/completions', { method: 'POST' }), /NON_LOCAL_MODEL_REQUEST_BLOCKED/);
  assert.throws(() => fn('http://127.0.0.1:8080/v1/models', { method: 'GET' }), /NON_LOCAL_MODEL_REQUEST_BLOCKED/);
  assert.throws(() => fn(BASE + '/admin', { method: 'GET' }), /NON_LOCAL_MODEL_REQUEST_BLOCKED/);
  assert.throws(() => fn(BASE + '/v1/models', { method: 'POST' }), /NON_LOCAL_MODEL_REQUEST_BLOCKED/);
});

test('local smoke only performs 1 GET model readback plus 3 POST translations to 127.0.0.1', async () => {
  const calls = []; const r = await smoke({ local: true, fetchImpl: fakeFetch(calls) });
  assert.equal(r.status, 'LOCAL_MODEL_RESPONDED_FACT_TOKENS_PASS');
  assert.equal(r.local_model_id, 'tencent/Hy-MT2-1.8B-GGUF');
  assert.equal(r.language_quality, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(r.published, false); assert.equal(r.paid_calls, 0);
  assert.equal(r.translations_received, 3);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls.slice(1).every(x => x.method === 'POST' && x.url === BASE + '/v1/chat/completions'));
});

test('factual omissions fail closed as QA_BLOCKED', async () => {
  const calls = []; const r = await smoke({ local: true, fetchImpl: fakeFetch(calls, 'An unrelated sentence.') });
  assert.equal(r.status, 'QA_BLOCKED');
  assert.ok(r.fact_token_issues.some(x => x.item === '350'));
  assert.equal(r.published, false);
});

test('offline, unhealthy or model-less localhost cannot be mistaken for successful inference', async () => {
  await assert.rejects(smoke({ local: true, fetchImpl: fakeFetch([], undefined, { failHealth: true }) }), /LOCAL_MODEL_SERVER_UNAVAILABLE/);
  await assert.rejects(smoke({ local: true, fetchImpl: fakeFetch([], undefined, { emptyIds: true }) }), /LOCAL_MODEL_ID_MISSING/);
  await assert.rejects(smoke({ local: true, fetchImpl: fakeFetch([], undefined, { wrongId: true }) }), /LOCAL_MODEL_NOT_HYMT2/);
});

test('no fallback to paid provider if local translator fails', async () => {
  const calls = [];
  await assert.rejects(smoke({ local: true, fetchImpl: async (url, init) => {
    calls.push(url);
    if (url.endsWith('/v1/models')) return { ok: true, json: async () => ({ data: [{ id: 'tencent/Hy-MT2-1.8B-GGUF' }] }) };
    throw Error('LOCAL_TRANSLATION_FAILED');
  } }), /LOCAL_TRANSLATION_FAILED/);
  assert.ok(calls.every(x => x.startsWith(BASE + '/')));
});

test('preflight hash agrees with local run without external drafts', async () => {
  const calls = [];
  const a = await smoke({ fetchImpl: () => { throw Error('NO NETWORK'); } });
  const b = await smoke({ local: true, fetchImpl: fakeFetch(calls) });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.existing_job_id, b.existing_job_id);
});

test('Ollama CPU smoke enforces 127.0.0.1 and refuses cloud model tags', async () => {
  const calls = [];
  const mockOllama = async (url, init) => {
    calls.push({ url, method: init?.method, payload: init?.body ? JSON.parse(init.body) : null });
    if (url === OLLAMA_BASE + '/api/tags') {
      return { ok: true, json: async () => ({ models: [{ name: 'qwen3:0.6b' }] }) };
    }
    return { ok: true, json: async () => ({
      model: 'qwen3:0.6b', done: true, response: job.source_text,
    }) };
  };
  const out = await smoke({ backend: 'ollama', local: true, fetchImpl: mockOllama });
  assert.equal(out.status, 'LOCAL_MODEL_RESPONDED_FACT_TOKENS_PASS');
  assert.equal(out.local_model_id, 'qwen3:0.6b');
  assert.equal(out.paid_calls, 0);
  assert.equal(out.published, false);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].url, OLLAMA_BASE + '/api/tags');
  assert.ok(calls.slice(1).every(x => x.url === OLLAMA_BASE + '/api/generate'));
  assert.ok(calls.slice(1).every(x => x.payload.options.num_gpu === 0 && x.payload.think === false));

  const guarded = loopbackOnly(() => { throw Error('UNSAFE_CALL'); }, 'ollama');
  for (const url of ['http://localhost:11434/api/generate',
    'http://127.0.0.1:11434/api/pull',
    'https://ollama.com/api/generate',
    'http://127.0.0.1:8000/api/generate',
    'http://127.0.0.1:11434/api/generate?unsafe=true']) {
    assert.throws(() => guarded(url, { method: 'POST' }), /NON_LOCAL_MODEL_REQUEST_BLOCKED/);
  }
  await assert.rejects(smoke({ backend: 'ollama', local: true,
    fetchImpl: async (url) => url.endsWith('/api/tags')
      ? { ok: true, json: async () => ({ models: [{ name: 'qwen3:cloud' }] }) }
      : { ok: true, json: async () => ({}) },
  }), /LOCAL_MODEL_NOT_QWEN3/);
});

test('Ollama failure does not call a paid model, send posts, or create new queue rows', async () => {
  const calls = [];
  await assert.rejects(smoke({ backend: 'ollama', local: true, fetchImpl: async (url) => {
    calls.push(url);
    if (url.endsWith('/api/tags')) {
      return { ok: true, json: async () => ({ models: [{ name: 'qwen3:0.6b' }] }) };
    }
    return { ok: false };
  } }), /PROVIDER_HTTP_ERROR/);
  assert.ok(calls.every(x => x.startsWith(OLLAMA_BASE + '/')));
});
