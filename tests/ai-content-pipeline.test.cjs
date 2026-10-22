'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertJob, fingerprint, missingFacts, runPipeline } = require('../ops/ai-content-pipeline.cjs');

const sample = Object.freeze({
  job_id: 'PUB-SYNTHETIC-001', owner_entity: 'OSVC', rights_status: 'owned',
  data_classification: 'PUBLIC_APPROVED', public_source_approved: true,
  external_ai_approved: false, image_rights_approved: false,
  source_lang: 'en', existing_status: 'DRAFT',
  source_text: 'Demo 31.10.2026 at 18:00. Fee 350 CZK. https://example.com/only-test',
});

function reply(value) { return { ok: true, json: async () => ({ choices: [{ message: { content: value } }] }) }; }
function mockFetch(record = []) { return async (url, req) => {
  record.push({ url, body: JSON.parse(req.body), auth: Boolean(req.headers.Authorization) });
  return reply(sample.source_text);
}; }

test('default preview performs zero network requests, writes zero posts and preserves existing queue id', async () => {
  const out = await runPipeline(sample, { fetchImpl: () => { throw Error('MUST_NOT_CALL_NETWORK'); }, withImage: true });
  assert.equal(out.state, 'PREVIEW'); assert.equal(out.published, false);
  assert.equal(out.existing_job_id, sample.job_id); assert.equal(out.image.state, 'PROMPT_PREVIEW');
  assert.deepEqual(out.targets, ['cs', 'ru', 'uk']);
});
test('rejects private, absent rights, missing public approval and already-published inputs', () => {
  for (const delta of [
    { data_classification: 'PRIVATE' }, { rights_status: 'unknown' },
    { public_source_approved: false }, { existing_status: 'PUBLISHED_VERIFIED' },
    { owner_entity: 'UNKNOWN' }, { job_id: '../../abc' },
  ]) assert.throws(() => assertJob({ ...sample, ...delta }));
});
test('repeated previews have stable idempotency hash', () => {
  assert.equal(fingerprint(sample), fingerprint({ ...sample }));
  assert.notEqual(fingerprint(sample), fingerprint({ ...sample, source_text: 'different' }));
});
test('missing numeric, time, price and URL tokens are detected', () => {
  assert.deepEqual(missingFacts(sample.source_text, 'Demo 31.10.2026'), ['18:00', '350', 'https://example.com/only-test']);
});
test('local Hy-MT2 path generates three review-only locales using localhost, no billed key', async () => {
  const calls = []; const out = await runPipeline(sample, { live: true, fetchImpl: mockFetch(calls), env: {} });
  assert.equal(calls.length, 3); assert.ok(calls.every(x => x.url.startsWith('http://127.0.0.1:8000/')));
  assert.ok(calls.every(x => !x.auth)); assert.equal(out.state, 'REVIEW_REQUIRED');
  assert.equal(out.published, false); assert.equal(out.post_url, null);
  assert.equal(out.quality_flags.length, 0); assert.equal(out.translations.cs, sample.source_text);
});
test('disallows paid MiMo without explicit per-row and environment approval', async () => {
  await assert.rejects(runPipeline(sample, { live: true, translationBackend: 'mimo', fetchImpl: mockFetch(), env: { MIMO_API_KEY: 'secret' } }), /REMOTE_API_APPROVAL_MISSING/);
});
test('MiMo API uses official v2.6 model and never logs credentials', async () => {
  const calls = []; const env = { MIMO_API_KEY: 'private', IMPERION_AI_OUTBOUND_APPROVED: '1', IMPERION_AI_PAID_APPROVED: '1' };
  const out = await runPipeline({ ...sample, external_ai_approved: true }, { live: true, translationBackend: 'mimo', env, fetchImpl: mockFetch(calls) });
  assert.equal(out.state, 'REVIEW_REQUIRED'); assert.equal(calls.length, 3);
  assert.ok(calls.every(x => x.url === 'https://api.xiaomimimo.com/v1/chat/completions'));
  assert.ok(calls.every(x => x.body.model === 'mimo-v2.6-flash' && x.auth));
  assert.ok(!JSON.stringify(out).includes('private'));
});
test('missing fact in even one translation blocks QA', async () => {
  const out = await runPipeline(sample, { live: true, fetchImpl: async () => reply('Demo 18:00 only'), env: {} });
  assert.equal(out.state, 'QA_BLOCKED'); assert.ok(out.quality_flags.some(x => x.item === '350'));
});
test('Qwen image only with approved rights and billed API gates, n=1 and no auto-publish', async () => {
  const calls = []; const fetchImpl = async (url, req) => {
    calls.push({ url, data: JSON.parse(req.body) });
    if (url.includes('images/generations')) return { ok: true, json: async () => ({ data: [{ url: 'https://signed.example.test/image.png' }] }) };
    return reply(sample.source_text);
  };
  const env = { DASHSCOPE_API_KEY: 'secret', IMPERION_AI_OUTBOUND_APPROVED: '1', IMPERION_AI_PAID_APPROVED: '1' };
  await assert.rejects(runPipeline({ ...sample, external_ai_approved: true }, { live: true, withImage: true, fetchImpl, env }), /IMAGE_RIGHTS_REVIEW_REQUIRED/);
  calls.length = 0;
  const out = await runPipeline({ ...sample, external_ai_approved: true, image_rights_approved: true }, { live: true, withImage: true, fetchImpl, env });
  const qwen = calls.find(x => x.url.endsWith('/images/generations'));
  assert.equal(qwen.data.model, 'qwen-image-2.1-turbo'); assert.equal(qwen.data.n, 1);
  assert.equal(out.image.persisted, false); assert.equal(out.published, false);
  assert.equal(out.image.state, 'ASSET_URL_REVIEW_REQUIRED');
});
test('unapproved or missing source is blocked before any paid request', async () => {
  await assert.rejects(runPipeline({ ...sample, data_classification: 'CRM_PRIVATE' }, {
    live: true, rewrite: true, fetchImpl: () => { throw Error('MUST_NOT_CALL'); },
    env: { MIMO_API_KEY: 'secret', IMPERION_AI_OUTBOUND_APPROVED: '1', IMPERION_AI_PAID_APPROVED: '1' },
  }), /PRIVATE_OR_UNAPPROVED_SOURCE/);
});
test('no silent fallback from offline local model to paid provider', async () => {
  await assert.rejects(runPipeline(sample, { live: true, fetchImpl: async () => { throw Error('OFFLINE'); }, env: { MIMO_API_KEY: 'secret' } }), /OFFLINE/);
});
