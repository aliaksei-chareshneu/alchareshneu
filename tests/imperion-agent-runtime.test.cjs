'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','ImperionAgentRuntime.gs'),'utf8');
const jh=['Job_ID','Task_Type','Provider_Pref','Status','Priority','Source_Namespace','Source_URL','Source_Version','Legal_Entity','Privacy','Effect','Objective_Sanitized','Target_Key','Dependency_Job_IDs','Deadline_At','Max_Cost_USD','Max_Owner_Minutes','Manus_Credit_Cap','Owner_Approval','Blocker','Expected_Artifact','Evidence_URI','Last_Checked_At','Idempotency_Key'];
const rh=['Receipt_ID','Job_ID','Attempt_ID','Event_Type','Legal_Entity','Status','Started_At','Finished_At','Source_Version','Idempotency_Key','Target_System','Target_ID','Expected_Result','Observed_Result','Evidence_URI','Verified_At','Verifier','Visibility'];
function sample() {
  return {schema_version:1,source_system:'EXISTING_IMPERION_HUB',captured_at:new Date().toISOString(),
    data:{Leads:[{Lead_ID:'SECRET',Email:'fictional@example.test',Notes:'PRIVATE_DETAILS'}],
      Revenue_Actions:[{Lead_ID:'REAL-A',Stage:'New'},{Lead_ID:'REAL-A',Stage:'New'},
        {Lead_ID:'STOP-B',Stage:'Hold'},{Lead_ID:'QA_SYNTHETIC-C',Stage:'New'}],
      SocialPublishing:[
        {Job_ID:'SOC-1',Status:'DRAFT',Rights_OK:'YES',Approved_At:'2026-11-01',Video_Drive_ID:'valid-media-id'},
        {Job_ID:'SOC-2',Status:'PUBLISHED_PROVIDER_CONFIRMED',Rights_OK:'',Video_Drive_ID:''},
        {Job_ID:'SOC-3',Status:'HOLD',Rights_OK:'NO',Video_Drive_ID:'unapproved-media'}],
      Events:[{Event_ID:'EV-1',Status:'Active',Start_DateTime:new Date(Date.now()+2*86400000).toISOString()}],
      IMPERION_Agent_Jobs:[
        {Job_ID:'JOB-1',Status:'OPEN',Deadline_At:new Date(Date.now()-3600000).toISOString()},
        {Job_ID:'JOB-2',Status:'DONE',Evidence_URI:'GITHUB_URL_IS_ONLY_CLAIM'}]}}
}
function sheet(head,id) {
  const rows=[head.slice()];
  return {rows,getLastRow:()=>rows.length,getMaxRows:()=>2000,getLastColumn:()=>head.length,
    getSheetId:()=>id,
    getRange:(r,c,n=1,w=1)=>({
      getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),
      getDisplayValue:()=>String(rows[r-1]?.[c-1]??''),
      setValues:(vals)=>{for(let i=0;i<vals.length;i++){if(!rows[r+i-1])rows[r+i-1]=Array(head.length).fill('');for(let j=0;j<vals[i].length;j++)rows[r+i-1][c+j-1]=vals[i][j];}}
    })}
}
function harness({active='owner@example.test',effective='owner@example.test',privateAccess=true}={}) {
  const jobs=sheet(jh,11),receipts=sheet(rh,12);let flushes=0;
  const b={getId:()=> 'HUB-EXISTING',getSpreadsheetTimeZone:()=> 'Europe/Prague',
    getUrl:()=> 'https://docs.google.com/spreadsheets/d/HUB-EXISTING/edit',
    getSheetByName:n=>n==='IMPERION_Agent_Jobs'?jobs:n==='IMPERION_Execution_Receipts'?receipts:null};
  const owner={getEmail:()=> 'owner@example.test'};
  const triggers=[];
  const c=vm.createContext({
    Date,JSON,Object,Math,Number,Array,String,RegExp,Error,isFinite,encodeURIComponent,
    SPREADSHEET_ID:'HUB-EXISTING',ocId_:()=> 'HUB-EXISTING',ocOwner_:()=> true,
    Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})},
    DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:()=>({
      getOwner:()=>owner,getSharingAccess:()=>privateAccess?'PRIVATE':'ANYONE',
      getEditors:()=>[],getViewers:()=>[]})},
    SpreadsheetApp:{openById:()=>b,flush:()=>{flushes++}},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:(fn)=>({
      timeBased:()=>({everyHours:(hours)=>({create:()=>{let v={getHandlerFunction:()=>fn,getUniqueId:()=> 'triggeruid12345'};triggers.push(v);return v;}})})
    })},
    imperionAgentTrustedSnapshot_:()=>sample(),
    UrlFetchApp:{fetch:(url)=>{
      if(url.endsWith('/robots.txt'))return {getResponseCode:()=>200,getContentText:()=> 'Sitemap: https://example/sitemap.xml'};
      if(url.endsWith('/sitemap.xml'))return {getResponseCode:()=>200,getContentText:()=>'<loc>https://x/alchareshneu/corporate/</loc>'};
      if(url.endsWith('/corporate/'))return {getResponseCode:()=>200,getContentText:()=>'<title>Corporate</title>'};
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({workflow_runs:[{
        id:41350498694,status:'completed',conclusion:'success',
        head_sha:'2f5712c384bad7f458c9d8ea9b12211d69e4bbe1',
        repository:{full_name:'aliaksei-chareshneu/alchareshneu'}}]})};
    }}
  });
  vm.runInContext(src,c,{timeout:1000});
  return {c,jobs,receipts,triggers,b,get flushes(){return flushes;}};
}
test('all five review functions process real-shaped private inputs without leaking contacts',()=>{
  const {c}=harness();
  const v=c.impA5Compute_(sample());
  assert.equal(v.chief.overdue,1);
  assert.equal(v.chief.completed_claims_need_readback,1);
  assert.equal(v.chief.events_next_7_days,1);
  assert.equal(v.sales.uncontacted_review_candidates,1);
  assert.equal(v.sales.blocked_or_closed,1);
  assert.equal(v.sales.qa_excluded,1);
  assert.equal(v.sales.duplicate_actions,1);
  assert.equal(v.social.source_rows,3);
  assert.equal(v.social.provider_reconciliation_needed,1);
  assert.equal(v.video.media_references,2);
  assert.equal(v.video.rights_screened_candidates,1);
  assert.equal(v.external_messages,0);assert.equal(v.third_party_posts,0);
  assert.doesNotMatch(JSON.stringify(v),/fictional@example|PRIVATE_DETAILS|valid-media-id/);
});
test('source timestamp, exact canonical origin and rows must pass',()=>{
  const {c}=harness();
  const x=sample();x.source_system='NEW_CRM';
  assert.throws(()=>c.impA5Compute_(x),/INVALID_OR_STALE_PRIVATE_SNAPSHOT/);
  const y=sample();y.captured_at='2025-01-01T00:00:00Z';
  assert.throws(()=>c.impA5Compute_(y),/INVALID_OR_STALE_PRIVATE_SNAPSHOT/);
});
test('owner only; forged triggers and anonymous caller cannot invoke private worker',()=>{
  const {c}=harness({active:''});
  assert.throws(()=>c.impA5Owner_(null),/OWNER_INTERACTIVE_AUTH_REQUIRED/);
  assert.throws(()=>c.impA5Owner_({triggerUid:'GUESS1234'}),/UNVERIFIED_TRIGGER/);
  const bad=harness({privateAccess:false});
  assert.throws(()=>bad.c.impA5Owner_(null),/PRIVATE_OWNER_REQUIRED/);
  const wrong=harness({effective:'intruder@example.test'});
  assert.throws(()=>wrong.c.impA5Owner_(null),/PRIVATE_OWNER_REQUIRED/);
});
test('no arbitrary outbound host or private data export path',()=>{
  const {c}=harness();
  assert.throws(()=>c.impA5HttpGet_('https://example.com/collect?x=1',false),/NON_ALLOWLISTED_PUBLIC_URL/);
  for(const forbidden of ['GmailApp.', 'MailApp.', 'sendEmail(', 'createPost(', 'payments.create('])
    assert.equal(src.includes(forbidden),false,forbidden);
});
test('one private canonical job, one idempotent 6-hour receipt with no fake provider verification',()=>{
  const h=harness(),first=h.c.impA5Run_(h.b),second=h.c.impA5Run_(h.b);
  assert.equal(first.status,'OWNER_PRIVATE_RUN_RECORDED');
  assert.equal(first.job_created,true);
  assert.equal(first.receipt.created,true);
  assert.equal(second.job_created,false);
  assert.equal(second.receipt.created,false);
  assert.equal(h.jobs.rows.length,2);
  assert.equal(h.receipts.rows.length,2);
  const row=h.receipts.rows[1];
  assert.match(row[0],/^REC-IMP-A5-\d+$/);
  assert.equal(row[1],'JOB-IMP-AGENT5-PRIVATE-20261102');
  assert.equal(row[5],'INTERNAL_REVIEW_OBSERVED_NO_CUSTOMER_EFFECT');
  assert.equal(row[15],'');
  assert.equal(row[16],'SELF_REPORTED_PENDING_INDEPENDENT_SHEETS_READBACK');
  assert.doesNotMatch(JSON.stringify(row),/fictional@example|PRIVATE_DETAILS|valid-media-id/);
  assert.equal(first.proof.observed_ci_success,true);
  assert.equal(first.seo.passed,3);
  assert.equal(h.flushes,1);
});
test('one existing 6-hour time trigger is reused, and only matching UID may tick',()=>{
  const h=harness({active:''});
  assert.throws(()=>h.c.imperionAgentReviewTick({triggerUid:'FAKE_UID_01234'}),/UNVERIFIED_TRIGGER/);
  const owner=harness();
  const a=owner.c.imperionAgentInstallTrigger(),b=owner.c.imperionAgentInstallTrigger();
  assert.equal(a.status,'TRIGGER_INSTALLED');
  assert.equal(b.status,'EXISTING_TRIGGER_REUSED');
  assert.equal(owner.triggers.length,1);
  const report=owner.c.imperionAgentReviewTick({triggerUid:'triggeruid12345'});
  assert.equal(report.receipt.created,true);
});

test('GitHub proof requests explicit user-agent and failures expose only HTTP code',()=>{
  const a=harness();
  let called=false;
  a.c.UrlFetchApp.fetch=(url,options)=>{
    called=true;
    assert.ok(url.startsWith('https://api.github.com/repos/'));
    assert.equal(options.method,'get');
    assert.equal(options.headers['User-Agent'],'IMPERION-Agent5-Proof/1.0');
    return {getResponseCode:()=>403,getContentText:()=> 'private-provider-body-must-not-be-logged'};
  };
  const report=a.c.impA5Proof_();
  assert.equal(called,true);
  assert.equal(report.state,'PROVIDER_HTTP_403');
  assert.equal(report.observed_ci_success,false);
  assert.doesNotMatch(JSON.stringify(report),/private-provider-body/);
});

test('owner preview logs only public provider proof status without leaking Hub data',()=>{
  const h=harness(),logs=[];h.c.console={log:m=>logs.push(String(m))};
  const result=h.c.imperionAgentRunPreview();
  assert.equal(result.proof.observed_ci_success,true);
  assert.equal(logs.length,1);
  assert.match(logs[0],/^IMPERION_AGENT5_PUBLIC_PROOF_STATE=CI_SUCCESS_PROVIDER_READBACK PUBLIC_GITHUB_RUN_ID=\d+$/);
  assert.doesNotMatch(logs[0],/fictional@example|PRIVATE_DETAILS|valid-media-id|SECRET|Authorization/i);
  assert.equal(h.jobs.rows.length,1);
  assert.equal(h.receipts.rows.length,1);
});
