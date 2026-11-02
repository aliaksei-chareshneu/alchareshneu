/**
 * IMPERION Agent 5 — private owner-bound, zero-payment scheduled reviews.
 * Reuses the EXISTING Community Hub and receipt ledger. Never exports PII.
 * No Gmail, social POST, video render, merchant, checkout or bank request.
 */
var IMP_A5_VERSION = '2026-11-02-agent5-private-v1';
var IMP_A5_JOB = 'JOB-IMP-AGENT5-PRIVATE-20261102';
var IMP_A5_HANDLER = 'imperionAgentReviewTick';
var IMP_A5_PUBLIC_SITE = 'https://aliaksei-chareshneu.github.io/alchareshneu/';
function impA5Text_(value) { return value == null ? '' : String(value).trim(); }
function impA5Up_(value) { return impA5Text_(value).toUpperCase(); }
function impA5Owner_(event) {
  if (typeof ocId_ !== 'function' || typeof ocOwner_ !== 'function') throw Error('OWNER_GUARD_NOT_INSTALLED');
  var id=ocId_();
  if(typeof SPREADSHEET_ID!=='string'||id!==SPREADSHEET_ID)throw Error('WRONG_CANONICAL_HUB');
  var file=DriveApp.getFileById(id),owner=file.getOwner();
  var email=owner&&impA5Text_(owner.getEmail()).toLowerCase();
  var effective=impA5Text_(Session.getEffectiveUser().getEmail()).toLowerCase();
  var active=impA5Text_(Session.getActiveUser().getEmail()).toLowerCase();
  if(!email||!effective||effective!==email||
     file.getSharingAccess()!==DriveApp.Access.PRIVATE||
     file.getEditors().length!==0||file.getViewers().length!==0)
    throw Error('PRIVATE_OWNER_REQUIRED');
  if(event!==undefined && event!==null) {
    var uid=impA5Text_(event.triggerUid);
    if(!/^[A-Za-z0-9_-]{8,120}$/.test(uid))throw Error('UNVERIFIED_TRIGGER');
    var found=ScriptApp.getProjectTriggers().filter(function(t){
      return t.getHandlerFunction()===IMP_A5_HANDLER&&String(t.getUniqueId())===uid;
    });
    if(found.length!==1)throw Error('UNVERIFIED_TRIGGER');
  } else if(!active||active!==email) {
    throw Error('OWNER_INTERACTIVE_AUTH_REQUIRED');
  }
  var book=SpreadsheetApp.openById(id);
  if(book.getSpreadsheetTimeZone()!=='Europe/Prague')throw Error('HUB_TIMEZONE_MISMATCH');
  return book;
}
function impA5ValidSnapshot_(snap) {
  if(!snap||snap.schema_version!==1||snap.source_system!=='EXISTING_IMPERION_HUB'||
     !snap.data||!snap.captured_at||!isFinite(Date.parse(snap.captured_at))||
     Math.abs(Date.now()-Date.parse(snap.captured_at))>15*60000)
    throw Error('INVALID_OR_STALE_PRIVATE_SNAPSHOT');
  ['Leads','Revenue_Actions','SocialPublishing','Events','IMPERION_Agent_Jobs'].forEach(function(k){
    if(!Array.isArray(snap.data[k])||snap.data[k].length>4000)throw Error('SOURCE_ROWS_INVALID:'+k);
  });
}
function impA5Compute_(snap) {
  impA5ValidSnapshot_(snap);
  var now=Date.parse(snap.captured_at),done=/^(DONE|CLOSED|VERIFIED|ACCEPTED)$/,
      qa=/(?:^|[_ -])(?:QA_SYNTHETIC|SYNTHETIC_QA|QA_FIXTURE|TEST_FIXTURE|TEST_ONLY|DEMO_ONLY)(?:$|[_ -])/i;
  var chief={review_needed:0,overdue:0,completed_claims_need_readback:0,events_next_7_days:0};
  var seenJobs={};
  snap.data.IMPERION_Agent_Jobs.forEach(function(r){
    var id=impA5Text_(r.Job_ID),status=impA5Up_(r.Status);
    if(!id||seenJobs[id])return;seenJobs[id]=true;
    if(done.test(status)){chief.completed_claims_need_readback++;return;}
    if(status==='CANCELLED')return;
    chief.review_needed++;
    var date=impA5Text_(r.Deadline_At);
    if(date&&/T\d\d:\d\d/.test(date)&&isFinite(Date.parse(date))&&Date.parse(date)<now)
      chief.overdue++;
  });
  snap.data.Events.forEach(function(r){
    if(impA5Up_(r.Status)!=='ACTIVE')return;
    var date=impA5Text_(r.Start_DateTime);
    if(/T\d\d:\d\d/.test(date)&&isFinite(Date.parse(date))&&
       Date.parse(date)>=now&&Date.parse(date)<now+7*86400000)chief.events_next_7_days++;
  });
  var sales={uncontacted_review_candidates:0,blocked_or_closed:0,qa_excluded:0,
    duplicate_actions:0,history_and_optout_checked:false,messages_sent:0,cash_verified:false};
  var actions=snap.data.Revenue_Actions.length?snap.data.Revenue_Actions:snap.data.Leads;
  var blocked={},seenSales={};
  actions.forEach(function(r){
    var id=impA5Text_(r.Lead_ID);
    if(!id||qa.test([id,r.Stage,r.Action_Status,r.Source].join(' ')))return;
    if(/STOP|CLOSED|DO_NOT_CONTACT|DORMANT|LOST|HOLD|CANCELLED/i.test(
      impA5Up_(r.Stage)+' '+impA5Up_(r.Action_Status)))blocked[id]=true;
  });
  actions.forEach(function(r){
    var id=impA5Text_(r.Lead_ID);
    if(!id)return;
    if(qa.test([id,r.Stage,r.Action_Status,r.Source].join(' '))){sales.qa_excluded++;return;}
    if(blocked[id]){sales.blocked_or_closed++;return;}
    if(seenSales[id]){sales.duplicate_actions++;return;}seenSales[id]=true;
    // No action is contact-ready until an actual cross-channel history,
    // consent/opt-out and ownership check has been completed.
    sales.uncontacted_review_candidates++;
  });
  var social={source_rows:0,provider_reconciliation_needed:0,
    rights_review_needed:0,approved_rights_candidates:0,posts_created:0};
  var video={media_references:0,rights_screened_candidates:0,
    source_hashes_checked:false,rendered:0,uploaded:0,published:0};
  var seenSocial={};
  snap.data.SocialPublishing.forEach(function(r){
    var id=impA5Text_(r.Job_ID);if(!id||seenSocial[id])return;
    seenSocial[id]=true;social.source_rows++;
    var st=impA5Up_(r.Status),rights=impA5Up_(r.Rights_OK),
        hasRights=(rights==='YES'||rights==='TRUE')&&!!impA5Text_(r.Approved_At);
    if(/PUBLISHED|SCHEDULED|SUBMITTING|PENDING|ERROR/.test(st))
      social.provider_reconciliation_needed++;
    else if(hasRights)social.approved_rights_candidates++;
    else social.rights_review_needed++;
    if(impA5Text_(r.Video_Drive_ID)){
      video.media_references++;
      if(hasRights&&/DRAFT|HOLD|APPROVED/.test(st))video.rights_screened_candidates++;
    }
  });
  return {version:IMP_A5_VERSION,mode:'PRIVATE_OWNER_INTERNAL_REVIEW',
    checked_at:snap.captured_at,chief:chief,sales:sales,social:social,video:video,
    privacy:'COUNTS_ONLY',external_messages:0,third_party_posts:0,charges:0,
    bookings:0,bank_provider_verified:false};
}
function impA5HttpGet_(url,parseJson) {
  // Only compile-time allowlisted public first-party / GitHub resources.
  if([IMP_A5_PUBLIC_SITE+'robots.txt',IMP_A5_PUBLIC_SITE+'sitemap.xml',
      IMP_A5_PUBLIC_SITE+'corporate/',
      'https://api.github.com/repos/aliaksei-chareshneu/alchareshneu/actions/workflows/imperion-autopilot.yml/runs?per_page=1'
     ].indexOf(url)<0)throw Error('NON_ALLOWLISTED_PUBLIC_URL');
  var response=UrlFetchApp.fetch(url,{method:'get',followRedirects:false,muteHttpExceptions:true,
    headers:{'Accept':parseJson?'application/vnd.github+json':'text/plain'}});
  if(response.getResponseCode()!==200)throw Error('PUBLIC_PROVIDER_HTTP_NOT_200');
  var txt=response.getContentText();
  if(txt.length>350000)throw Error('PUBLIC_RESPONSE_TOO_LARGE');
  return parseJson?JSON.parse(txt):txt;
}
function impA5Seo_() {
  var result={state:'LIVE_PUBLIC_HTTP_UNVERIFIED',passed:0,total:3,site_modified:false};
  try{
    var robots=impA5HttpGet_(IMP_A5_PUBLIC_SITE+'robots.txt',false);
    var sitemap=impA5HttpGet_(IMP_A5_PUBLIC_SITE+'sitemap.xml',false);
    var corporate=impA5HttpGet_(IMP_A5_PUBLIC_SITE+'corporate/',false);
    result.passed=(robots.indexOf('sitemap.xml')>=0?1:0)+
      (sitemap.indexOf('/alchareshneu/corporate/')>=0?1:0)+
      (/<title>[^<]{5,}<\/title>/i.test(corporate)?1:0);
    result.state=result.passed===3?'LIVE_PUBLIC_SOURCE_CHECK_PASS':'LIVE_PUBLIC_SOURCE_REVIEW';
  }catch(_){result.state='LIVE_PUBLIC_HTTP_UNVERIFIED';}
  return result;
}
function impA5Proof_() {
  var result={state:'UNVERIFIED',provider:'GITHUB_ACTIONS_PUBLIC',workflow_id:null,
    observed_ci_success:false,deployment_or_cash_verified:false};
  try{
    var data=impA5HttpGet_(
      'https://api.github.com/repos/aliaksei-chareshneu/alchareshneu/actions/workflows/imperion-autopilot.yml/runs?per_page=1',true);
    var a=data&&Array.isArray(data.workflow_runs)&&data.workflow_runs[0];
    if(a&&Number.isSafeInteger(a.id)&&a.id>0&&
       a.repository&&a.repository.full_name==='aliaksei-chareshneu/alchareshneu'&&
       /^[a-f0-9]{40}$/i.test(a.head_sha||'')){
      result.workflow_id=a.id;
      result.observed_ci_success=a.status==='completed'&&a.conclusion==='success';
      result.state=result.observed_ci_success?'CI_SUCCESS_PROVIDER_READBACK':'CI_NOT_VERIFIED';
    }
  }catch(_){result.state='PROVIDER_UNAVAILABLE';}
  return result;
}
function impA5Sheet_(book,name,expected) {
  var sh=book.getSheetByName(name);if(!sh||sh.getLastRow()<1)throw Error('REQUIRED_TAB_MISSING:'+name);
  var cols=sh.getLastColumn();if(cols!==expected.length)throw Error('SCHEMA_WIDTH_CHANGED:'+name);
  var h=sh.getRange(1,1,1,cols).getDisplayValues()[0];
  if(JSON.stringify(h)!==JSON.stringify(expected))throw Error('SCHEMA_HEADER_CHANGED:'+name);
  return sh;
}
function impA5Job_(book,at) {
  var headers=['Job_ID','Task_Type','Provider_Pref','Status','Priority','Source_Namespace','Source_URL',
    'Source_Version','Legal_Entity','Privacy','Effect','Objective_Sanitized','Target_Key',
    'Dependency_Job_IDs','Deadline_At','Max_Cost_USD','Max_Owner_Minutes','Manus_Credit_Cap',
    'Owner_Approval','Blocker','Expected_Artifact','Evidence_URI','Last_Checked_At','Idempotency_Key'];
  var sh=impA5Sheet_(book,'IMPERION_Agent_Jobs',headers);
  var last=sh.getLastRow(),found=0;
  if(last>1){var values=sh.getRange(2,1,last-1,1).getDisplayValues();
    values.forEach(function(r){if(r[0]===IMP_A5_JOB)found++;});}
  if(found>1)throw Error('DUPLICATE_CANONICAL_AGENT_JOB');
  if(found===1)return false;
  if(last>=sh.getMaxRows())throw Error('AGENT_JOBS_CAPACITY');
  sh.getRange(last+1,1,1,24).setValues([[IMP_A5_JOB,'READ_ONLY_AGENT_REVIEW',
    'EXISTING_OWNER_APPS_SCRIPT','OWNER_REVIEW_ACTIVE','P1','03_EXECUTION',
    book.getUrl(),IMP_A5_VERSION,'SHARED_ENTITY_SEPARATED','INTERNAL','INTERNAL_AUDIT_ONLY',
    'Five recurring private source reviews. Zero emails, posts, charges, bookings or public data export.',
    'EXISTING_IMPERION_HUB','','',0,0,0,'GO_READ_ONLY_ONLY',
    'PROVIDER_BANK_SALES_PUBLISHING_RELEASE_NOT_AUTHORIZED','FIVE_AGENT_COUNTS_AND_PROVIDER_RECEIPT',
    '',at,'IMP-A5-JOB-20261102']]);
  return true;
}
function impA5Receipt_(book,report) {
  var headers=['Receipt_ID','Job_ID','Attempt_ID','Event_Type','Legal_Entity','Status',
    'Started_At','Finished_At','Source_Version','Idempotency_Key','Target_System','Target_ID',
    'Expected_Result','Observed_Result','Evidence_URI','Verified_At','Verifier','Visibility'];
  var sh=impA5Sheet_(book,'IMPERION_Execution_Receipts',headers);
  var at=report.checked_at,slot=Math.floor(Date.parse(at)/(6*3600000));
  var key='IMP-A5-'+slot, receiptId='REC-IMP-A5-'+slot;
  var last=sh.getLastRow();
  if(last>1){var old=sh.getRange(2,1,last-1,10).getDisplayValues();
    var found=old.filter(function(r){return r[0]===receiptId||r[9]===key;});
    if(found.length>1)throw Error('DUPLICATE_AGENT_RECEIPT_CONFLICT');
    if(found.length===1)return {created:false,receipt_id:receiptId,row:old.findIndex(function(r){return r[0]===receiptId;})+2};
  }
  if(last>=sh.getMaxRows())throw Error('AGENT_RECEIPTS_CAPACITY');
  var summary='CHIEF '+report.chief.review_needed+'/'+report.chief.overdue+
    '; SALES review '+report.sales.uncontacted_review_candidates+
    '; SOCIAL rights '+report.social.approved_rights_candidates+
    '; SEO '+report.seo.passed+'/'+report.seo.total+' '+report.seo.state+
    '; VIDEO refs '+report.video.media_references+
    '; PROOF '+report.proof.state+'; no outbound/payment/bookings';
  var row=last+1;
  sh.getRange(row,1,1,18).setValues([[receiptId,IMP_A5_JOB,'OWNER_PRIVATE_'+slot,
    'PRIVATE_OWNER_FIVE_AGENT_REVIEW','SEPARATE_ENTITIES',
    'INTERNAL_REVIEW_OBSERVED_NO_CUSTOMER_EFFECT',at,new Date().toISOString(),
    IMP_A5_VERSION,key,'GOOGLE_APPS_SCRIPT_OWNER_BOUND',String(book.getId()),
    'Five private source reviews, zero external customer effects',
    summary,book.getUrl()+'#gid='+sh.getSheetId()+'&range=A'+row+':R'+row,'',
    'SELF_REPORTED_PENDING_INDEPENDENT_SHEETS_READBACK','INTERNAL']]);
  SpreadsheetApp.flush();
  if(String(sh.getRange(row,1).getDisplayValue())!==receiptId)
    throw Error('RECEIPT_WRITE_READBACK_FAILED');
  return {created:true,receipt_id:receiptId,row:row};
}
function impA5Run_(book) {
  if(typeof imperionAgentTrustedSnapshot_!=='function')throw Error('PRIVATE_SNAPSHOT_NOT_INSTALLED');
  var lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {status:'LOCK_BUSY'};
  try{
    var snapshot=imperionAgentTrustedSnapshot_(book.getId());
    var report=impA5Compute_(snapshot);
    report.seo=impA5Seo_();
    report.proof=impA5Proof_();
    // Additive writes ONLY to existing owner-private queue and receipt ledger.
    var jobCreated=impA5Job_(book,report.checked_at);
    var receipt=impA5Receipt_(book,report);
    return {status:'OWNER_PRIVATE_RUN_RECORDED',version:report.version,
      checked_at:report.checked_at,job_created:jobCreated,receipt:receipt,
      chief:report.chief,sales:report.sales,social:report.social,video:report.video,
      seo:report.seo,proof:report.proof,
      customer_messages:0,posts:0,charges:0,bookings:0,bank_verified:false};
  } finally{lock.releaseLock();}
}
function imperionAgentRunPreview() {
  var book=impA5Owner_(null);
  var report=impA5Compute_(imperionAgentTrustedSnapshot_(book.getId()));
  report.seo=impA5Seo_();report.proof=impA5Proof_();
  return report;
}
function imperionAgentRunAndRecord() { return impA5Run_(impA5Owner_(null)); }
function imperionAgentReviewTick(e) { return impA5Run_(impA5Owner_(e)); }
function imperionAgentInstallTrigger() {
  impA5Owner_(null);
  var existing=ScriptApp.getProjectTriggers().filter(function(t){
    return t.getHandlerFunction()===IMP_A5_HANDLER;
  });
  if(existing.length>1)throw Error('DUPLICATE_EXISTING_AGENT_TRIGGER');
  if(existing.length===1)return {status:'EXISTING_TRIGGER_REUSED',trigger_count:1};
  var created=ScriptApp.newTrigger(IMP_A5_HANDLER).timeBased().everyHours(6).create();
  if(!created||created.getHandlerFunction()!==IMP_A5_HANDLER)throw Error('TRIGGER_CREATE_FAILED');
  var after=ScriptApp.getProjectTriggers().filter(function(t){
    return t.getHandlerFunction()===IMP_A5_HANDLER;
  });
  if(after.length!==1)throw Error('TRIGGER_READBACK_FAILED');
  return {status:'TRIGGER_INSTALLED',trigger_count:1,cadence_hours:6,
    sends_enabled:false,payments_enabled:false};
}
function imperionAgentRuntimeHealth() {
  var book=impA5Owner_(null);
  var t=ScriptApp.getProjectTriggers().filter(function(z){
    return z.getHandlerFunction()===IMP_A5_HANDLER;
  });
  var sh=book.getSheetByName('IMPERION_Execution_Receipts');
  var count=0,lastAt=null,lastReceiptId=null;
  if(sh&&sh.getLastRow()>1){
    var n=sh.getLastRow();
    var data=sh.getRange(2,1,n-1,10).getDisplayValues();
    data.forEach(function(r){if(/^REC-IMP-A5-\d+$/.test(r[0])){
      count++;lastReceiptId=r[0];lastAt=r[7];}});
  }
  return {ok:true,version:IMP_A5_VERSION,owner_private:true,
    trigger_count:t.length,trigger_cadence_hours:t.length===1?6:null,
    private_receipt_count:count,last_receipt_id:lastReceiptId,
    last_finished_at:lastAt,customer_actions_enabled:false};
}
