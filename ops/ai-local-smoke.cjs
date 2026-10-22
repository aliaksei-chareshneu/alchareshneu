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
const OLLAMA_BASE = 'http://127.0.0.1:11434';
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

function loopbackOnly(fetchImpl, backend = 'hy-mt2') {
  if (typeof fetchImpl !== 'function') throw Error('FETCH_IMPL_INVALID');
  if (!['hy-mt2', 'ollama'].includes(backend)) throw Error('INVALID_LOCAL_BACKEND');
  const base = backend === 'ollama' ? OLLAMA_BASE : BASE;
  const endpoints = backend === 'ollama'
    ? { '/api/tags': 'GET', '/api/generate': 'POST' }
    : { '/v1/models': 'GET', '/v1/chat/completions': 'POST' };
  return (url, init) => {
    const parsed = new URL(url);
    const method = init?.method || 'GET';
    if (parsed.origin !== base || parsed.username || parsed.password || parsed.search ||
        parsed.hash || endpoints[parsed.pathname] !== method) {
      throw Error('NON_LOCAL_MODEL_REQUEST_BLOCKED');
    }
    return fetchImpl(url, init);
  };
}

async function localModelId(fetchImpl, backend = 'hy-mt2') {
  if (!['hy-mt2', 'ollama'].includes(backend)) throw Error('INVALID_LOCAL_BACKEND');
  const base = backend === 'ollama' ? OLLAMA_BASE : BASE;
  const route = backend === 'ollama' ? '/api/tags' : '/v1/models';
  const r = await fetchImpl(base + route, { method: 'GET', signal: AbortSignal.timeout(8000) });
  if (!r || r.ok !== true) throw Error('LOCAL_MODEL_SERVER_UNAVAILABLE');
  const data = await r.json();
  const entries = backend === 'ollama' ? data?.models : data?.data;
  const ids = Array.isArray(entries)
    ? entries.map(x => backend === 'ollama' ? x?.name : x?.id).filter(x => typeof x === 'string' && x.trim())
    : [];
  if (!ids.length) throw Error('LOCAL_MODEL_ID_MISSING');
  const matched = backend === 'ollama' ? ids.find(id => id === 'qwen3:0.6b')
    : ids.find(id => /hy[-_]?mt2/i.test(id));
  if (!matched) throw Error(backend === 'ollama' ? 'LOCAL_MODEL_NOT_QWEN3' : 'LOCAL_MODEL_NOT_HYMT2');
  return matched;
}

async function smoke(options = {}) {
  const job = checkedFixture(options.fixture);
  const backend = options.backend || 'hy-mt2';
  const fetchSafe = loopbackOnly(options.fetchImpl || globalThis.fetch, backend);
  const preview = await runPipeline(job, { live: false, translationBackend: backend, env: {}, fetchImpl: fetchSafe });
  if (preview.published !== false || preview.state !== 'PREVIEW' ||
      preview.existing_job_id !== EXPECTED_ID) throw Error('UNSAFE_PREVIEW');
  if (options.local !== true) {
    return {
      status: 'PREVIEW_PASS', current_stage: 'NO_INFERENCE',
      calls_to_public_network: 0, paid_calls: 0, published: false,
      existing_job_id: job.job_id, fingerprint: preview.source_fingerprint,
      next: backend === 'ollama' ? 'Run --ollama for a CPU-only synthetic check' : 'Start local Hy-MT2 and rerun with --local; no auto-install',
    };
  }
  const modelId = await localModelId(fetchSafe, backend);
  const draft = await runPipeline(job, { live: true, translationBackend: backend, env: {}, fetchImpl: fetchSafe });
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
    console.log('Usage: node ops/ai-local-smoke.cjs [--local | --ollama]');
    console.log('Default: zero network. --local: Hy-MT2 on 127.0.0.1:8000; --ollama: CPU-only Qwen3 on 127.0.0.1:11434.');
    return;
  }
  if (args.some(arg => !['--local', '--ollama'].includes(arg)) ||
      args.length > 1) throw Error('INVALID_FLAGS');
  const backend = args.includes('--ollama') ? 'ollama' : 'hy-mt2';
  const result = await smoke({ local: args.length > 0, backend });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'QA_BLOCKED') process.exitCode = 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    const code = /^(?:[A-Z0-9_]+)$/.test(error.message) ? error.message : 'LOCAL_SMOKE_FAILED';
    console.error(code); process.exitCode = 1;
  });
}

module.exports = { BASE, OLLAMA_BASE, checkedFixture, loopbackOnly, localModelId, smoke };
