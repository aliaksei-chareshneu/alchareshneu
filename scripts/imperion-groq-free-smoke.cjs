'use strict';
/**
 * One bounded, first-party public Groq GPT-OSS 120B smoke test.
 * No customer data, sends, publishing, private CRM, charges or autonomous actions.
 * Quota reservation uses the existing GitHub Actions run history as a durable
 * record; GitHub workflow concurrency ensures only one such job runs at once.
 */
const fs = require('node:fs');
const path = require('node:path');
const { draftPublicTask } = require('../ops/imperion-free-model-router.cjs');

const REPO = 'aliaksei-chareshneu/alchareshneu';
const WORKFLOW = 'imperion-groq-free-draft-smoke.yml';
const MODEL = 'openai/gpt-oss-120b';
const HOUR = 60 * 60 * 1000;

function guardEnvironment(env) {
  if (env.GITHUB_REPOSITORY !== REPO || env.GITHUB_EVENT_NAME !== 'workflow_dispatch')
    return 'UNAPPROVED_REPOSITORY_OR_TRIGGER';
  if (!/^[0-9]{5,20}$/.test(env.GITHUB_RUN_ID || '') || env.GITHUB_RUN_ATTEMPT !== '1')
    return 'INVALID_OR_RETRIED_RUN';
  if (!env.GITHUB_TOKEN) return 'MISSING_GITHUB_RUN_HISTORY_TOKEN';
  if (!env.GROQ_API_KEY || env.GROQ_VERIFIED_FREE_PLAN !== 'true')
    return 'FREE_PLAN_OR_API_KEY_NOT_VERIFIED';
  if (env.GROQ_FREE_SMOKE_APPROVED !== 'FREE-ONLY')
    return 'EXPLICIT_FREE_ONLY_CONFIRMATION_REQUIRED';
  return null;
}

async function previousRunsGate(env, fetcher = fetch) {
  const day = new Date(Date.now() - 24 * HOUR).toISOString().slice(0, 10);
  const endpoint = 'https://api.github.com/repos/' + REPO
    + '/actions/workflows/' + WORKFLOW
    + '/runs?per_page=100&created=' + encodeURIComponent('>=' + day);
  let response;
  try {
    response = await fetcher(endpoint, {
      method: 'GET', redirect: 'error',
      headers: {
        Authorization: 'Bearer ' + env.GITHUB_TOKEN,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      signal: AbortSignal.timeout(12000)
    });
  } catch { return 'GITHUB_QUOTA_HISTORY_UNAVAILABLE'; }
  if (!response.ok || response.redirected) return 'GITHUB_QUOTA_HISTORY_HTTP_FAILURE';
  let data;
  try { data = await response.json(); }
  catch { return 'GITHUB_QUOTA_HISTORY_INVALID'; }
  if (!Array.isArray(data.workflow_runs) ||
      !Number.isInteger(data.total_count) || data.total_count >= 100)
    return 'GITHUB_QUOTA_HISTORY_INCOMPLETE';
  const selfId = Number(env.GITHUB_RUN_ID);
  const self = data.workflow_runs.find(x => x.id === selfId);
  if (!self || !Number.isFinite(Date.parse(self.created_at)))
    return 'CURRENT_RUN_NOT_FOUND_IN_DURABLE_HISTORY';
  const selfStarted = Date.parse(self.created_at);
  const cutoff = Date.now() - 24 * HOUR;
  const previous = data.workflow_runs.filter(x => {
    if (!Number.isInteger(x.id) || x.id === selfId) return false;
    const date = Date.parse(x.created_at);
    return Number.isFinite(date) && date >= cutoff &&
      (date < selfStarted || (date === selfStarted && x.id < selfId));
  });
  if (previous.length) return 'ONE_GROQ_ATTEMPT_PER_24H_ALREADY_RESERVED';
  return null;
}

async function main() {
  const env = process.env;
  const guard = guardEnvironment(env);
  if (guard) throw new Error('BLOCKED_' + guard);
  const task = Object.freeze({
    job_id: 'GROQ-PUBLIC-' + env.GITHUB_RUN_ID,
    owner_entity: 'OSVC',
    data_classification: 'PUBLIC_APPROVED',
    public_source_approved: true,
    external_ai_approved: true,
    source_url: 'https://aliaksei-chareshneu.github.io/alchareshneu/corporate/',
    purpose: 'PUBLIC_FACT_REVIEW',
    language: 'en'
  });
  let usedReservation = false;
  const reserveQuota = async ({ provider, model, job_id, daily_ceiling }) => {
    if (usedReservation || provider !== 'groq' || model !== MODEL ||
        job_id !== task.job_id || daily_ceiling > 600)
      return false;
    usedReservation = true;
    const deniedReason = await previousRunsGate(env);
    if (deniedReason) {
      process.stdout.write('NO_EXTERNAL_MODEL_CALL: ' + deniedReason + '\n');
      return false;
    }
    return true;
  };
  const result = await draftPublicTask(task, {env, reserveQuota});
  if (result.status !== 'DRAFT_FOR_OWNER_REVIEW' ||
      result.provider !== 'groq' || result.model !== MODEL ||
      result.messages_sent !== 0 || result.posts_published !== 0 ||
      result.external_actions !== 0 || result.payments_created !== 0 ||
      result.owner_approval_required !== true || !usedReservation)
    throw new Error('BLOCKED_PROVIDER_OR_RESULT_' + (result.reason || result.status));
  const receipt = {
    ...result,
    workflow_run: 'https://github.com/' + REPO + '/actions/runs/' + env.GITHUB_RUN_ID,
    quota_policy: 'one attempt per rolling 24h; GitHub serialized workflow run history',
    billing_proof: 'NOT_VERIFIED_BY_PROVIDER',
    checked_at_utc: new Date().toISOString(),
    execution_mode: 'MANUAL_PUBLIC_DRAFT_ONLY'
  };
  const dest = path.join(env.RUNNER_TEMP || '/tmp', 'imperion-groq-free-smoke.json');
  fs.writeFileSync(dest, JSON.stringify(receipt, null, 2) + '\n', {flag:'wx', mode:0o600});
  process.stdout.write('GROQ_120B_API_DRAFT_PASS model=' + result.model +
    ' draft_chars=' + result.draft.length +
    ' source_sha256=' + result.source_sha256 +
    ' messages_sent=0 posts_published=0 payments_created=0\n');
  if (env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
      '### Groq 120B public-only review proof\n' +
      '- Status: DRAFT_FOR_OWNER_REVIEW (not published)\n' +
      '- Quota: one manual attempt in rolling 24h; GitHub run readback\n' +
      '- Billing: NOT independently verified\n' +
      '- No messages, posts, contracts or payments performed\n');
}

main().catch(e => {
  // Never print credentials, headers, request bodies, or provider error payloads.
  process.stderr.write('GROQ_PUBLIC_SMOKE_BLOCKED: ' + String(e.message).slice(0, 180) + '\n');
  process.exitCode = 1;
});
