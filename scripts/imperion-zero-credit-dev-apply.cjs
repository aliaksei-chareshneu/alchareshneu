'use strict';
/**
 * Single-purpose issue #195 source updater. It only accepts an already
 * sandbox-validated public Qwen code proposal, changes ONE allowlisted HTML
 * file, and has no GitHub, CRM, secrets, network or deployment capability.
 * The caller must run tests before attempting a review-only PR.
 */
const fs=require('node:fs');
const SOURCE='corporate/request/index.html';
function apply(html,record){
 if(typeof html!=='string'||!record||typeof record!=='object'||
    record.status!=='SYNTHETIC_CODE_TEST_PASS'||
    record.model!=='qwen3:4b-instruct'||record.cases_passed!==7||
    record.public_only!==true||record.production_effects!==0||
    record.deployment_approved!==false||
    !['NONE','DETERMINISTIC_MAX65_OUTPUT_BOUND'].includes(record.test_repair))
   throw Error('VERIFIED_MODEL_PROOF_REQUIRED');
 const statement=record.review_code;
 if(typeof statement!=='string'||statement.length>900||
    !/^const source\s*=/.test(statement))
   throw Error('MODEL_PATCH_RESTRICTED');
 // Only the previously sandbox-tested deterministic wrapper is allowed to
 // contain a trusted arrow (=>). The untrusted model-authored body may not.
 let inspect=statement;
 if(record.test_repair==='DETERMINISTIC_MAX65_OUTPUT_BOUND'){
   const prefix='const source=(()=>{';
   const suffix='\nreturn source.slice(0,65);})()';
   if(typeof record.model_code_original!=='string'||
      statement!==prefix+record.model_code_original+suffix)
     throw Error('DETERMINISTIC_BOUND_WRAPPER_MISMATCH');
   inspect=record.model_code_original;
 }else if(statement!==record.model_code_original){
   throw Error('UNREPAIRED_MODEL_CODE_MISMATCH');
 }
 if(/(?:\b(?:require|process|fetch|globalThis|eval|Function|import|constructor|prototype)\b|[\x60<>\\])/i.test(inspect))
   throw Error('MODEL_PATCH_RESTRICTED');
 const from='const source=utmSuffix';
 const start=html.indexOf(from);
 if(start<0||html.indexOf(from,start+1)!==-1)throw Error('B2B_SOURCE_ANCHOR_NOT_UNIQUE');
 const end=html.indexOf('\n const body=',start);
 if(end<0||end-start>400)throw Error('B2B_BODY_ANCHOR_NOT_FOUND');
 const original=html.slice(start,end).trim();
 if(!/^const source=utmSuffix[\s\S]+?:\s*baseSource;$/.test(original))
   throw Error('B2B_SOURCE_CHANGED_UPSTREAM');
 const code=statement.endsWith(';')?statement:statement+';';
 const result=html.slice(0,start)+code+html.slice(end);
 if(!result.includes('const utmSuffix=utmLabels.join')||
    result===html||result.length>html.length+1000)
   throw Error('NO_REVIEWABLE_CHANGE');
 return result;
}
if(require.main===module){
 try{
  const proof=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const target=process.argv[3];
  if(target!==SOURCE)throw Error('SOURCE_PATH_RESTRICTED');
  const before=fs.readFileSync(target,'utf8');
  const after=apply(before,proof);
  fs.writeFileSync(target,after,'utf8');
  console.log(JSON.stringify({status:'MODEL_SOURCE_CHANGE_PREPARED_NOT_DEPLOYED',
    issue:195,model:proof.model,changed_file:SOURCE,
    tested_cases:proof.cases_passed,policy_repair:proof.test_repair}));
 }catch(e){console.error('DEV_APPLY_BLOCKED '+String(e.message).slice(0,160));process.exitCode=1}
}
module.exports={SOURCE,apply};
