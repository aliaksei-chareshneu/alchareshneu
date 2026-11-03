'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../ops/imperion-free-model-router.cjs');

const SOURCE = 'https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/feed.json';
const TASK = Object.freeze({
  job_id: 'PUB-QA-20261103', owner_entity: 'OSVC',
  data_classification: 'PUBLIC_APPROVED',
  public_source_approved: true, external_ai_approved: true,
  source_url: SOURCE, purpose: 'PUBLIC_COPY_DRAFT', language: 'cs'
});
const GROQ_ENV = {GROQ_API_KEY: 'fixture-not-real', GROQ_VERIFIED_FREE_PLAN: 'true'};
const BOTH_ENV = {
  ...GROQ_ENV,
  OPENROUTER_API_KEY: 'fixture-not-real',
  OPENROUTER_VERIFIED_FREE_PLAN: 'true',
  OPENROUTER_FREE_MODEL: 'test/model:free'
};
function res(status, body, media='application/json') {
  return {ok: status >= 200 && status < 300, status,
    redirected: false, headers: {get: () => media},
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
    json: async () => typeof body === 'string' ? JSON.parse(body) : body};
}
test('allowlisted, approved, public-only task accepted', () => {
  assert.equal(M.checkTask(TASK), null);
  assert.equal(M.SOURCES.has(SOURCE), true);
});
test('private/unknown/child/unsupported entity cannot use free external AI', () => {
  for (const data_classification of ['PERSONAL', 'SENSITIVE', 'MINORS', 'PRIVATE_CRM', 'UNVERIFIED']) {
    assert.equal(M.checkTask({...TASK, data_classification}), 'NOT_PUBLIC_APPROVED');
  }
  assert.equal(M.checkTask({...TASK, owner_entity: 'GRANTS_PERSONAL'}), 'ENTITY_SCOPE_NOT_APPROVED');
});
test('unapproved owner, provider, arbitrary URLs and action flags are blocked', () => {
  assert.equal(M.checkTask({...TASK, public_source_approved: false}), 'PUBLIC_AND_EXTERNAL_AI_APPROVAL_REQUIRED');
  assert.equal(M.checkTask({...TASK, external_ai_approved: false}), 'PUBLIC_AND_EXTERNAL_AI_APPROVAL_REQUIRED');
  assert.equal(M.checkTask({...TASK, source_url: 'https://example.org/'}), 'SOURCE_NOT_ALLOWLISTED');
  assert.equal(M.checkTask({...TASK, send: true}), 'EXTERNAL_ACTION_NOT_ALLOWED');
  assert.equal(M.checkTask({...TASK, prompt: 'private customer email'}), 'UNTRUSTED_FREE_TEXT_FIELD');
});
test('cannot pick a paid model or an unverified paid account', () => {
  assert.deepEqual(M.configuredProviders({GROQ_API_KEY:'key'}), []);
  assert.deepEqual(M.configuredProviders({OPENROUTER_API_KEY:'key',
    OPENROUTER_VERIFIED_FREE_PLAN:'true', OPENROUTER_FREE_MODEL:'paid/large'}), []);
  assert.equal(M.configuredProviders(BOTH_ENV).length, 2);
  assert.equal(M.configuredProviders(BOTH_ENV)[0].model, 'openai/gpt-oss-120b');
  assert.equal(M.configuredProviders(BOTH_ENV)[1].model, 'test/model:free');
});
test('no verified free provider = no source fetch or model call', async () => {
  let calls=0;
  const x=await M.draftPublicTask(TASK, {fetchImpl:()=>{calls++;}});
  assert.equal(x.reason, 'NO_VERIFIED_FREE_PROVIDER');
  assert.equal(calls, 0);
});
test('no durable atomic reservation = no source fetch or model call', async () => {
  let calls=0;
  const x=await M.draftPublicTask(TASK, {env:GROQ_ENV,
    fetchImpl:()=>{calls++;}});
  assert.equal(x.reason, 'DURABLE_QUOTA_RESERVATION_REQUIRED');
  assert.equal(calls, 0);
});
test('failed source readback never forwards text to provider', async () => {
  const calls=[];
  const x=await M.draftPublicTask(TASK, {env:GROQ_ENV,
    reserveQuota:async()=>true,
    fetchImpl:async url=>{calls.push(url); return res(404, 'missing');}});
  assert.equal(x.reason, 'PUBLIC_SOURCE_READBACK_FAILED');
  assert.deepEqual(calls, [SOURCE]);
});
test('bad content type never goes to provider', async () => {
  let n=0;
  const x=await M.draftPublicTask(TASK, {env:GROQ_ENV, reserveQuota:async()=>true,
    fetchImpl:async()=>{n++;return res(200, 'binary-content', 'image/png');}});
  assert.equal(x.reason, 'PUBLIC_SOURCE_READBACK_FAILED');
  assert.equal(n, 1);
});
test('approved public source → quota reservation → one draft; no side effects', async () => {
  const calls=[],reservations=[];
  const fetchImpl=async (url,options)=>{
    calls.push({url,method:options.method,body:options.body});
    if(options.method==='GET')return res(200, '{"events":[{"title":"Open day"}]}');
    return res(200, {choices:[{message:{content:'Návrh na veřejnou pozvánku.'}}]});
  };
  const result=await M.draftPublicTask(TASK, {env:GROQ_ENV, fetchImpl,
    reserveQuota:async x=>{reservations.push(x);return true;}});
  assert.equal(result.status,'DRAFT_FOR_OWNER_REVIEW');
  assert.equal(result.owner_approval_required,true);
  assert.equal(result.messages_sent,0);
  assert.equal(result.payments_created,0);
  assert.equal(result.posts_published,0);
  assert.equal(result.billing_readback,'NOT_CHECKED');
  assert.match(result.source_sha256,/^[a-f0-9]{64}$/);
  assert.equal(calls.length,2);
  assert.equal(calls[0].method,'GET');
  assert.equal(calls[1].method,'POST');
  assert.equal(reservations.length,1);
  assert.equal(reservations[0].daily_ceiling,600);
  assert.equal(JSON.parse(calls[1].body).messages[1].content.includes('Open day'),true);
});
test('rejected quota fails closed, never calls model', async () => {
  let posts=0;
  const x=await M.draftPublicTask(TASK,{env:GROQ_ENV,reserveQuota:async()=>false,
    fetchImpl:async (_url, opts)=>{
      if(opts.method==='POST')posts++;
      return res(200,'{"events":[{"title":"Open day"}]}');
    }});
  assert.equal(x.status,'BLOCKED');
  assert.equal(posts,0);
  assert.deepEqual(x.failures,['groq:QUOTA_OR_DUPLICATE']);
});
test('429 may fall back only to another explicitly verified free model',async()=>{
  const posts=[];
  const x=await M.draftPublicTask(TASK,{env:BOTH_ENV,reserveQuota:async()=>true,
    fetchImpl:async (url,opts)=>{
      if(opts.method==='GET') return res(200,'{"events":[{"title":"Open day"}]}');
      posts.push(url);
      return posts.length===1?res(429,{error:'quota'}):
        res(200,{choices:[{message:{content:'DRAFT'}}]});
    }});
  assert.equal(x.status,'DRAFT_FOR_OWNER_REVIEW');
  assert.equal(x.provider,'openrouter');
  assert.equal(posts.length,2);
});
test('bad provider output cannot be interpreted as sent or paid',async()=>{
  const x=await M.draftPublicTask(TASK,{env:GROQ_ENV,reserveQuota:async()=>true,
    fetchImpl:async(url,opts)=> opts.method==='GET'?
      res(200,'{"events":[{"title":"Open day"}]}'):res(200,{choices:[]})});
  assert.equal(x.status,'BLOCKED');
  assert.equal(x.external_actions,0);
});
