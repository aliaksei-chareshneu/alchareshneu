'use strict';
// Read-only GitHub provider verification. Never treat PR or CI as deployment,
// publication, customer acceptance, cash, or bank verification.
const REPO='aliaksei-chareshneu/alchareshneu';
const KNOWN=new Set(['PR_DRAFT_OPEN','PR_OPEN','PR_MERGED','PR_CLOSED_UNMERGED','CI_PASS',
  'DONE','DEPLOYED','LIVE','SENT','PUBLISHED','PAID','BANK_VERIFIED']);
const VERIFIABLE=new Set(['PR_DRAFT_OPEN','PR_OPEN','PR_MERGED','PR_CLOSED_UNMERGED','CI_PASS']);
const SHA=/^[a-f0-9]{40}$/i;
function valid(x){
  return !!x&&typeof x==='object'&&!Array.isArray(x)&&x.repo===REPO&&
    ['pull_request','workflow_run'].includes(x.kind)&&Number.isSafeInteger(x.id)&&x.id>0&&
    KNOWN.has(x.claim)&&(x.expected_sha===undefined||SHA.test(x.expected_sha))&&
    (x.kind!=='pull_request'||x.claim!=='CI_PASS')&&
    (x.kind!=='workflow_run'||!VERIFIABLE.has(x.claim)||x.claim==='CI_PASS');
}
function out(x,verdict,reason,checked_at,extra={}){
  return {schema_version:1,mode:'READ_ONLY_PUBLIC_PROVIDER_GET',source:'GITHUB_REST_API',
    repo:REPO,kind:x&&x.kind||null,id:x&&x.id||null,claim:x&&x.claim||null,
    verdict,reason,checked_at,...extra,externally_executed_actions:0,
    deployment_verified:false,business_outcome_verified:false};
}
async function audit(x,opts={}){
  const now=typeof opts.now==='function'?Number(opts.now()):Date.now();
  const checked_at=Number.isFinite(now)?new Date(now).toISOString():new Date().toISOString();
  if(!valid(x))return out(x,'UNVERIFIED','INVALID_INPUT',checked_at);
  const api='https://api.github.com/repos/'+REPO+
    (x.kind==='pull_request'?'/pulls/':'/actions/runs/')+x.id;
  const link='https://github.com/'+REPO+
    (x.kind==='pull_request'?'/pull/':'/actions/runs/')+x.id;
  const fetcher=opts.fetchImpl||globalThis.fetch;
  if(typeof fetcher!=='function')return out(x,'UNVERIFIED','NO_PROVIDER_CLIENT',checked_at);
  let v;
  try{
    const r=await fetcher(api,{method:'GET',redirect:'error',credentials:'omit',
      headers:{Accept:'application/vnd.github+json','User-Agent':'imperion-proof-auditor-readonly'},
      signal:AbortSignal.timeout(8000)});
    if(!r||!r.ok||r.redirected===true)
      return out(x,'UNVERIFIED','PROVIDER_GET_FAILED',checked_at,{provider_url:link});
    v=await r.json();
  }catch{
    return out(x,'UNVERIFIED','PROVIDER_UNAVAILABLE',checked_at,{provider_url:link});
  }
  if(!v||typeof v!=='object'||Array.isArray(v))
    return out(x,'UNVERIFIED','INVALID_PROVIDER_RECORD',checked_at,{provider_url:link});
  let actual,head;
  if(x.kind==='pull_request'){
    if(v.number!==x.id||v.base?.repo?.full_name!==REPO||
       !SHA.test(v.head?.sha||'')||!['open','closed'].includes(v.state)||
       typeof v.draft!=='boolean')
      return out(x,'UNVERIFIED','PROVIDER_IDENTITY_MISMATCH',checked_at,{provider_url:link});
    head=v.head.sha;
    actual=v.merged_at?'PR_MERGED':v.state==='closed'?'PR_CLOSED_UNMERGED':
      v.draft?'PR_DRAFT_OPEN':'PR_OPEN';
  }else{
    if(v.id!==x.id||v.repository?.full_name!==REPO||
       !SHA.test(v.head_sha||'')||
       !['queued','in_progress','completed','waiting','requested','pending'].includes(v.status))
      return out(x,'UNVERIFIED','PROVIDER_IDENTITY_MISMATCH',checked_at,{provider_url:link});
    head=v.head_sha;
    actual=v.status!=='completed'?'CI_INCOMPLETE':
      v.conclusion==='success'?'CI_PASS':'CI_NOT_SUCCESS';
    if(!x.expected_sha)return out(x,'UNVERIFIED','EXPECTED_HEAD_SHA_REQUIRED_FOR_CI',
      checked_at,{provider_url:link,provider_state:actual,head_sha:head});
  }
  const evidence={provider_url:link,provider_id:x.id,head_sha:head,provider_state:actual};
  if(x.expected_sha&&head.toLowerCase()!==x.expected_sha.toLowerCase())
    return out(x,'UNVERIFIED','EXPECTED_HEAD_SHA_MISMATCH',checked_at,evidence);
  if(!VERIFIABLE.has(x.claim))
    return out(x,'UNVERIFIED','CLAIM_NEEDS_DIFFERENT_PROVIDER_PROOF',checked_at,evidence);
  const matched=actual===x.claim;
  return out(x,matched?'VERIFIED_PROVIDER_STATE':'CONTRADICTED',
    matched?'PROVIDER_READBACK_MATCHED':'PROVIDER_READBACK_DISAGREED',checked_at,evidence);
}
async function cli(args=process.argv.slice(2)){
  if(![6,8].includes(args.length)||args[0]!=='--kind'||args[2]!=='--id'||
     args[4]!=='--claim'||(args.length===8&&args[6]!=='--sha'))
    throw Error('USAGE: --kind pr|run --id NUM --claim STATUS [--sha HEX40]');
  const x={repo:REPO,kind:args[1]==='pr'?'pull_request':args[1]==='run'?'workflow_run':'invalid',
    id:Number(args[3]),claim:args[5]};
  if(args.length===8)x.expected_sha=args[7];
  const result=await audit(x);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.verdict!=='VERIFIED_PROVIDER_STATE')process.exitCode=2;
}
if(require.main===module)cli().catch(()=>{process.stderr.write('AUDITOR_FAILED\n');process.exitCode=1;});
module.exports={REPO,valid,audit};
