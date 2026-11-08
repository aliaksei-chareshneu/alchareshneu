'use strict';
/**
 * Zero-key Qwen coding QA for existing issue #195.
 * Public code only. No GitHub write token, user data, runtime credentials or
 * execution of untrusted generated code in this process.
 */
const fs = require('node:fs');
const path = require('node:path');
const MODEL = 'qwen3:4b-instruct';
const ENDPOINT = 'http://127.0.0.1:11434/api/generate';
const SOURCE = 'corporate/request/index.html';
const OLD = "const source=utmLabels.length?(baseSource+'__'+utmLabels.join('_')).slice(0,65):baseSource;";
function taskPrompt(html,feedback='') {
  if (typeof html !== 'string' || !html.includes('const baseSource=') ||
      !html.includes('const utmSuffix=utmLabels.join')) {
    throw Error('PUBLIC_SOURCE_UNVERIFIED');
  }
  return [
    'You are fixing a real defect in a PUBLIC B2B website JavaScript.',
    'Write CODE, not a design or an explanation.',
    'The old code is:', OLD,
    'The 65-character baseSource eats the UTM channel after slice(0,65).',
    'Available variables are baseSource (2..65 safe characters) and utmLabels',
    '(array of 0..3 safe strings). Produce a declaration: const source=...;',
    'Requirement: no labels -> preserve baseSource unchanged.',
    'With labels, keep at least 2 characters of baseSource and preserve the',
    'full UTM suffix when it fits; maximum total source length 65.',
    'EXACT REQUIRED example: 65 s characters + instagram,bio,nov2026 means',
    'source length 65 with suffix __instagram_bio_nov2026 preserved.',
    'Algorithm hint: suffix=utmLabels.join("_"); budget=65-2-suffix.length;',
    'shorten baseSource to Math.max(2,budget) before appending __ + suffix.',
    'Never concatenate 65 baseSource characters before trying to add UTM.',
    'Use only Math, string and array methods; never call network or tools.',
    'Return JSON ONLY, exactly {"source_statement":"const source=...;"}',
    'The proposal will be tested using synthetic inputs in a no-network container.',
    ...(feedback?['LAST ISOLATED TEST FAILURE: '+feedback,
      'Repair the last mistake. The UTM suffix must survive; use the algorithm hint.']:[])
  ].join('\n');
}
function parseCandidate(raw) {
  if (typeof raw !== 'string' || raw.length > 2000) throw Error('RESPONSE_BOUNDS');
  let obj; try { obj=JSON.parse(raw); } catch { throw Error('MODEL_JSON_INVALID'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) ||
      Object.keys(obj).join(',') !== 'source_statement' ||
      typeof obj.source_statement !== 'string') throw Error('MODEL_SCHEMA_INVALID');
  const code=obj.source_statement.trim();
  if (code.length < 25 || code.length > 700 ||
      !/^const source\s*=/.test(code) ||
      /(?:\b(?:require|process|fetch|globalThis|eval|Function|import|constructor|prototype)\b|[\x60<>\\])/i.test(code)) {
    throw Error('CODE_SAFETY_REJECTED');
  }
  return code;
}
async function run(opts={}) {
  const read=opts.readFile || (p=>fs.readFileSync(p,'utf8'));
  const fetcher=opts.fetchImpl || globalThis.fetch;
  const prompt=taskPrompt(read(SOURCE),opts.feedback||'');
  const body={model:MODEL,stream:false,think:false,format:'json',prompt,
    options:{num_gpu:0,num_ctx:2048,num_predict:300,temperature:0.1}};
  const r=await fetcher(ENDPOINT,{method:'POST',redirect:'error',
    headers:{'content-type':'application/json'},body:JSON.stringify(body),
    signal:AbortSignal.timeout(170000)});
  if (!r?.ok || r.redirected) throw Error('MODEL_HTTP_UNVERIFIED');
  const answer=await r.json();
  if(answer?.done!==true || answer?.model!==MODEL) throw Error('MODEL_ID_OR_COMPLETION_UNVERIFIED');
  return {
    schema:'imperion-dev-qa-v1',status:'MODEL_CODE_PROPOSED_PENDING_SANDBOX',
    job_id:'IMP-DEV-20261108-195',issue:195,owner:'OSVC',
    public_file:SOURCE,provider:'EPHEMERAL_GITHUB_ACTIONS_CPU_OLLAMA',
    model:answer.model,code:parseCandidate(answer.response),
    prompt_tokens:answer.prompt_eval_count??null,completion_tokens:answer.eval_count??null,
    model_duration_ns:answer.total_duration??null,external_api_cost_czk:0,
    model_created_pr:false,production_changed:false,
    next:'ISOLATED_TEST_AND_HUMAN_REVIEW'
  };
}
async function main() {
  const result=await run({feedback:process.argv.includes('--repair')
    ?'The earlier candidate failed: preserve UTM for a 65-character referral. The first source must end with __instagram_bio_nov2026; use the explicit suffix budget.'
    :''});
  const dest=path.join(process.env.RUNNER_TEMP || process.cwd(),'imperion-zero-credit-qwen-proof.json');
  fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,model:result.model,
    prompt_tokens:result.prompt_tokens,completion_tokens:result.completion_tokens,external_cost_czk:0}));
}
if (require.main===module) main().catch(e=>{
  console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'DEV_AGENT_QA_FAILED');
  process.exitCode=1;
});
module.exports={MODEL,ENDPOINT,SOURCE,OLD,taskPrompt,parseCandidate,run};
