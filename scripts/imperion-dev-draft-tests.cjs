'use strict';
// Stage 10: LLM suggests DATA-ONLY test vectors; only this trusted module writes
// a fixed test template into an ephemeral review sandbox. NEVER a release gate.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const W=require('./imperion-dev-cloud-issue.cjs');
const DEST='tests/generated/imperion-dev-cloud-preview.test.cjs';
const MAX_RESPONSE=6000;
const TEST_SHAPE='{"export":"total","cases":[{"name":"empty","args":[[]],"expected":0},{"name":"one","args":[[{"price":2,"quantity":3}]],"expected":6},{"name":"many","args":[[{"price":3,"quantity":4},{"price":5,"quantity":2}]],"expected":22}]}';

function reject(reason){throw Error(reason)}
function exactKeys(value,keys) {
 if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).sort().join('|')!==keys.slice().sort().join('|'))
   reject('TEST_VECTOR_SCHEMA_REJECTED');
}
function parseDraftVectors(raw) {
 if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_RESPONSE)
   reject('TEST_VECTOR_OUTPUT_SIZE_REJECTED');
 let data;try{data=JSON.parse(raw)}catch{reject('TEST_VECTOR_JSON_REJECTED')}
 exactKeys(data,['export','cases']);
 if(data.export!=='total'||!Array.isArray(data.cases)||data.cases.length!==3)
   reject('TEST_VECTOR_SCHEMA_REJECTED');
 let empty=false,single=false,multi=false;
 const names=new Set(),inputs=new Set();
 for(const c of data.cases){
  exactKeys(c,['name','args','expected']);
  if(typeof c.name!=='string'||! /^[a-z][a-z0-9_-]{2,35}$/.test(c.name)||
     names.has(c.name))reject('TEST_VECTOR_CASE_NAME_REJECTED');
  names.add(c.name);
  if(!Array.isArray(c.args)||c.args.length!==1||
     !Array.isArray(c.args[0])||c.args[0].length>8||
     !Number.isSafeInteger(c.expected)||c.expected<0||c.expected>100000000)
    reject('TEST_VECTOR_ARGUMENTS_REJECTED');
  const rows=c.args[0];
  let expected=0;
  for(const r of rows){
   exactKeys(r,['price','quantity']);
   if(!Number.isSafeInteger(r.price)||!Number.isSafeInteger(r.quantity)||
      r.price<0||r.price>10000||r.quantity<0||r.quantity>10000)
      reject('TEST_VECTOR_ARGUMENTS_REJECTED');
   expected+=r.price*r.quantity;
  }
  if(expected!==c.expected)reject('TEST_VECTOR_ORACLE_MISMATCH');
  const key=JSON.stringify(rows);
  if(inputs.has(key))reject('TEST_VECTOR_DUPLICATE_INPUTS');
  inputs.add(key);
  empty ||= rows.length===0;
  single ||= rows.length===1;
  multi ||= rows.length>=2;
 }
 if(!empty||!single||!multi)reject('TEST_VECTOR_COVERAGE_MISSING');
 return data;
}
// Stage 10 fixture ONLY. Qwen supplies bounded rows; a trusted oracle supplies
// all expected results. Both the minimal new schema and the earlier full JSON
// schema are accepted, then rechecked through one strict internal validator.
function normalizeWithTrustedOracle(raw) {
 if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_RESPONSE)
  reject('TEST_VECTOR_OUTPUT_SIZE_REJECTED');
 let data;try{data=JSON.parse(raw)}catch{reject('TEST_VECTOR_JSON_REJECTED')}
 if(!data||typeof data!=='object'||Array.isArray(data))
  reject('TEST_VECTOR_SCHEMA_REJECTED');
 const bare=Object.keys(data).sort().join('|')==='cases';
 let normalized;
 if(bare) {
  exactKeys(data,['cases']);
  if(!Array.isArray(data.cases)||data.cases.length!==3)
   reject('TEST_VECTOR_SCHEMA_REJECTED');
  normalized={export:'total',cases:data.cases.map(c=>{
   exactKeys(c,['name','rows']);
   return {name:c.name,args:[c.rows],expected:0};
  })};
 }else {
  exactKeys(data,['export','cases']);
  if(data.export!=='total'||!Array.isArray(data.cases)||data.cases.length!==3)
   reject('TEST_VECTOR_SCHEMA_REJECTED');
  normalized=data;
 }
 let recalculated=0;
 for(const c of normalized.cases){
  exactKeys(c,['name','args','expected']);
  if(!Array.isArray(c.args)||c.args.length!==1||
     !Array.isArray(c.args[0])||c.args[0].length>8||
     !Number.isSafeInteger(c.expected)||c.expected<0||c.expected>100000000)
    reject('TEST_VECTOR_ARGUMENTS_REJECTED');
  let expected=0;
  for(const row of c.args[0]){
   exactKeys(row,['price','quantity']);
   if(!Number.isSafeInteger(row.price)||!Number.isSafeInteger(row.quantity)||
      row.price<0||row.price>10000||row.quantity<0||row.quantity>10000)
    reject('TEST_VECTOR_ARGUMENTS_REJECTED');
   expected+=row.price*row.quantity;
  }
  if(expected>100000000)reject('TEST_VECTOR_ARGUMENTS_REJECTED');
  if(bare||expected!==c.expected)recalculated++;
  c.expected=expected;
 }
 return {data:parseDraftVectors(JSON.stringify(normalized)),
   oracle_recomputed_cases:recalculated};
}
function renderDraftTest(task,data) {
 if(task?.file!==W.FIXTURE_FILE||task.mode!=='FIXTURE')
   reject('DRAFT_TEST_SOURCE_SCOPE_REJECTED');
 const relative=path.posix.relative(path.posix.dirname(DEST),task.file);
 if(!relative.startsWith('../')||!relative.endsWith('.cjs'))
   reject('DRAFT_TEST_IMPORT_SCOPE_REJECTED');
 const cases=JSON.stringify(data.cases);
 return [
  "'use strict';",
  '// Advisory DATA-ONLY Qwen test scenarios. NOT independent trusted acceptance.',
  "const test=require('node:test');",
  "const assert=require('node:assert/strict');",
  'const {total}=require('+JSON.stringify(relative)+');',
  'const cases='+cases+';',
  'for(const c of cases) test("Qwen draft: "+c.name,()=>{',
  '  assert.deepStrictEqual(total(...c.args),c.expected);',
  '});',
  ''
 ].join('\n');
}
function draftPrompt(patchedSource,feedback='') {
 return [
  'Suggest JSON DATA ONLY for a public arithmetic test, not executable test code.',
  'Return EXACT JSON with only the key cases. Exactly 3 cases.',
  'Each case has EXACT keys name and rows. No export, args, expected or extra fields.',
  'Each name lowercase ASCII a-z and 0-9, 3-36 chars.',
  'Each rows is an array of objects containing exactly price and quantity.',
  'price and quantity are integers from 0 to 10000.',
  'The three cases must cover empty rows, exactly one row, and two or more rows.',
  'A trusted independent oracle calculates all expected results; do not calculate.',
  'EXAMPLE FORMAT (choose different simple numbers):',
  '{"cases":[{"name":"empty_rows","rows":[]},{"name":"one_row","rows":[{"price":2,"quantity":3}]},{"name":"two_rows","rows":[{"price":3,"quantity":4},{"price":5,"quantity":2}]}]}',
  feedback?'RETRY_REASON: '+feedback.slice(0,100):'',
  'PATCHED_PUBLIC_SOURCE: '+patchedSource.slice(0,2500)
 ].filter(Boolean).join('\n');
}
async function askDraftVectors(patchedSource,fetchImpl=globalThis.fetch) {
 let reason='';
 for(let attempt=0;attempt<2;attempt++){
  const res=await fetchImpl('http://127.0.0.1:11434/api/generate',{
   method:'POST',redirect:'error',credentials:'omit',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({model:W.MODEL,stream:false,think:false,format:'json',
     prompt:draftPrompt(patchedSource,reason),
     options:{num_gpu:0,num_ctx:4096,num_predict:650,temperature:0.05}}),
   signal:AbortSignal.timeout(175000)
  });
  if(!res?.ok||res.redirected)reject('TEST_VECTOR_MODEL_HTTP_FAILED');
  const out=await res.json();
  if(out?.done!==true||out?.model!==W.MODEL)
    reject('TEST_VECTOR_MODEL_UNVERIFIED');
  try{
   const checked=normalizeWithTrustedOracle(out.response);
   return {...checked,model_invocations:attempt+1};
  }catch(e){
   if(attempt===1)throw e;
   if(!/^(TEST_VECTOR_(SCHEMA|OUTPUT_SIZE|JSON|CASE_NAME|ARGUMENTS|ORACLE_MISMATCH|DUPLICATE_INPUTS|COVERAGE_MISSING)_REJECTED|TEST_VECTOR_ORACLE_MISMATCH)$/.test(e.message))
     throw e;
   reason=e.message;
  }
 }
 reject('TEST_VECTOR_RETRIES_EXHAUSTED');
}
function checkPreviewProof(proof,source) {
 if(proof?.status!=='MODEL_PROPOSAL_ONLY'||proof?.model!==W.MODEL||
    proof.schema!=='imperion-dev-cloud-task-v1'||
    proof.task?.mode!=='FIXTURE'||proof.task.file!==W.FIXTURE_FILE||
    proof.task.test!==W.FIXTURE_TEST||
    W.sha(source)!==proof.source_sha256)
   reject('TEST_VECTOR_PROOF_MISMATCH');
 const patch=W.parseCandidate(JSON.stringify(proof.patch));
 return W.applyCandidate(source,patch);
}
async function writePreview(proof,workspace,fetchImpl=globalThis.fetch) {
 const root=fs.realpathSync(workspace),cwd=fs.realpathSync(process.cwd());
 if(root===cwd||root.startsWith(cwd+path.sep))
   reject('TEST_VECTOR_SANDBOX_REQUIRED');
 const source=W.safeFileRead(root,W.FIXTURE_FILE,true);
 const patched=checkPreviewProof(proof,source);
 const result=await askDraftVectors(patched,fetchImpl);
 const dest=path.join(root,DEST);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 // A tracked repository symlink may not send the generated file outside
 // the temporary review workspace, even when the filename itself is fixed.
 const actualDir=fs.realpathSync(path.dirname(dest));
 if(!actualDir.startsWith(root+path.sep))
  reject('TEST_VECTOR_PATH_ESCAPE_REJECTED');
 if(fs.existsSync(dest))reject('TEST_VECTOR_DEST_EXISTS');
 const fileText=renderDraftTest(proof.task,result.data);
 fs.writeFileSync(dest,fileText,{encoding:'utf8',flag:'wx',mode:0o600});
 // Data-only public cases may be read by sandbox UID 10001, distinct from
 // the GitHub runner owner. Never put secrets in this synthetic artifact.
 fs.chmodSync(dest,0o644);
 return {status:'UNTRUSTED_TEST_DRAFT_ONLY',file:DEST,
   model:W.MODEL,model_invocations:result.model_invocations,
   sha256:crypto.createHash('sha256').update(fileText).digest('hex'),
   draft_cases:result.data.cases,advisory_only:true,
   expected_values_from_trusted_oracle:true,
   oracle_recomputed_cases:result.oracle_recomputed_cases,
   paid_api_czk:0,merged:false};
}
async function cli(){
 if(process.argv[2]!=='--preview'||process.argv.length!==5)
   reject('TEST_VECTOR_MODE_REJECTED');
 const proof=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 const sandbox=process.argv[4];
 if(!process.env.RUNNER_TEMP||
    !path.resolve(sandbox).startsWith(path.resolve(process.env.RUNNER_TEMP)+path.sep))
   reject('TEST_VECTOR_RUNNER_TEMP_REQUIRED');
 const result=await writePreview(proof,sandbox);
 const out=path.join(process.env.RUNNER_TEMP,'imperion-dev-test-vector-result.json');
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(result));
}
if(require.main===module)cli().catch(e=>{
 console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'TEST_VECTOR_PREVIEW_BLOCKED');
 process.exitCode=2;
});
module.exports={DEST,parseDraftVectors,normalizeWithTrustedOracle,renderDraftTest,draftPrompt,askDraftVectors,
  checkPreviewProof,writePreview};
