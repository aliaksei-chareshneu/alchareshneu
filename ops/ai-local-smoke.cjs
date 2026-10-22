'use strict';
/**
 * One-command, local-only smoke for the OPTIONAL Hy-MT2 drafting adapter.
 * Default: zero network calls. --local: only loopback 127.0.0.1:8000.
 * Synthetic public fixture ONLY; never reads CRM, sends email, posts, or bills.
 */
const fs = require('node:fs');
const path = require('node:path');
const { runPipeline } = require('./ai-content-pipeline.cjs');

const BASE = 'http://127.0.0.1:8000';
const FIXTURE = path.join(__dirname, 'ai-content-synthetic.json');
const EXPECTED_ID = 'PUB-SYNTHETIC-001';
const TARGETS = Object.freeze(['cs', 'ru', 'uk']);

function checkedFixture(raw) {
  const job = typeof raw === 'undefined' ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : raw;
  if (!job || typeof job !== 'object' || Array.isArray(job) ||
      job.job_id !== EXPECTED_ID || job.data_classification !== 'PUBLIC_APPROVED' ||
      job.source_lang !== 'en' || job.external_ai_approved !== false ||
      job.image_rights_approved !== false || job.public_source_approved !== true ||
      typeof job.source_text !== 'string' ||
      !job.source_text.startsWith('SYNTHETIC DEMO only:')) {
    throw Error('PUBLIC_SYNTHETIC_FIXTURE_REQUIRED');
  }
  return job;
}

function loopbackOnly(fetchImpl) {
  if (typeof fetchImpl !== 'function') throw Error('FETCH_IMPL_INVALID');
  return (url, init) => {
    const parsed = new URL(url);
    if (parsed.origin !== BASE ||
        !['/v1/models', '/v1/chat/completions'].includes(parsed.pathname) ||
        (parsed.pathname === '/v1/models' && (init?.method || 'GET') !== 'GET') ||
        (parsed.pathname === '/v1/chat/completions' && init?.method !== 'POST')) {
      throw Error('NON_LOCAL_MODEL_REQUEST_BLOCKED');
    }
    return fetchImpl(url, init);
  };
}

async function localModelId(fetchImpl) {
  const r = await fetchImpl(BASE + '/v1/models', { method: 'GET', signal: AbortSignal.timeout(8000) });
  if (!r || r.ok !== true) throw Error('LOCAL_MODEL_SERVER_UNAVAILABLE');
  const data = await r.json();
  const ids = Array.isArray(data?.data) ? data.data.map(x => x?.id).filter(x => typeof x === 'string' && x.trim()) : [];
  if (!ids.length) throw Error('LOCAL_MODEL_ID_MISSING');
  const matched = ids.find(id => /hy[-_]?mt2/i.test(id));
  if (!matched) throw Error('LOCAL_MODEL_NOT_HYMT2');
  // Model ID is health evidence only, not proof of translation correctness.
  return matched;
}

async function smoke(options = {}) {
  const job = checkedFixture(options.fixture);
  const fetchSafe = loopbackOnly(options.fetchImpl || globalThis.fetch);
  const preview = await runPipeline(job, { live: false, translationBackend: 'hy-mt2', env: {}, fetchImpl: fetchSafe });
  if (preview.published !== false || preview.state !== 'PREVIEW' ||
      preview.existing_job_id !== EXPECTED_ID) throw Error('UNSAFE_PREVIEW');
  if (options.local !== true) {
    return {
      status: 'PREVIEW_PASS', current_stage: 'NO_INFERENCE',
      calls_to_public_network: 0, paid_calls: 0, published: false,
      existing_job_id: job.job_id, fingerprint: preview.source_fingerprint,
      next: 'Start local Hy-MT2 and rerun with --local; no auto-install',
    };
  }
  const modelId = await localModelId(fetchSafe);
  const draft = await runPipeline(job, { live: true, translationBackend: 'hy-mt2', env: {}, fetchImpl: fetchSafe });
  if (draft.published !== false || draft.post_url !== null ||
      draft.existing_job_id !== EXPECTED_ID ||
      TARGETS.some(lang => typeof draft.translations?.[lang] !== 'string' || !draft.translations[lang].trim())) {
    throw Error('LOCAL_DRAFT_INVALID');
  }
  const flags = draft.quality_flags || [];
  const status = draft.state === 'QA_BLOCKED' || flags.length > 0
    ? 'QA_BLOCKED' : 'LOCAL_MODEL_RESPONDED_FACT_TOKENS_PASS';
  return {
    status, current_stage: 'SYNTHETIC_LOCAL_INFERENCE_ONLY',
    local_model_id: modelId, translations_received: TARGETS.length,
    fact_token_issues: flags, language_quality: 'HUMAN_REVIEW_REQUIRED',
    calls_to_public_network: 0, paid_calls: 0, published: false,
    existing_job_id: draft.existing_job_id, fingerprint: draft.source_fingerprint,
    next: status === 'QA_BLOCKED'
      ? 'Inspect translations and facts; do not approve or publish'
      : 'Review translation quality manually; then test one approved PUBLIC source using existing SocialPublishing',
  };
}

async function main(args) {
  if (args.includes('--help')) {
    console.log('Usage: node ops/ai-local-smoke.cjs [--local]');
    console.log('Default performs NO network calls; --local connects only to 127.0.0.1:8000 with synthetic public fixture.');
    return;
  }
  if (args.some(arg => arg !== '--local') || args.filter(arg => arg === '--local').length > 1) throw Error('INVALID_FLAGS');
  const result = await smoke({ local: args.includes('--local') });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'QA_BLOCKED') process.exitCode = 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    const code = /^(?:[A-Z0-9_]+)$/.test(error.message) ? error.message : 'LOCAL_SMOKE_FAILED';
    console.error(code); process.exitCode = 1;
  });
}

module.exports = { BASE, checkedFixture, loopbackOnly, localModelId, smoke };
