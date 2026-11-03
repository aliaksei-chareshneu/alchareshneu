/**
 * INSTALL INTO THE EXISTING PRIVATE Community Hub-bound Apps Script.
 * Does NOT deploy by committing this GitHub file. Owner must review/run installer.
 *
 * Public TED search -> authenticated Supabase staging -> existing sheet
 * IMPERION_B2B_Open_Requests -> independently read each appended row -> ACK.
 * No mail, posting, application, payments or new CRM. OSVC public notices only.
 *
 * Reuses the existing owner Script Property IMPERION_INTAKE_BRIDGE_KEY.
 * Do not copy the key into source, a cell or an email.
 */
var IMP_DH_SYNC_URL='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-deal-hunter-crm';
var IMP_DH_HUB_ID='1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY';
var IMP_DH_SHEET='IMPERION_B2B_Open_Requests';
var IMP_DH_HANDLER='imperionDealHunterSync';
var IMP_DH_HEADERS=['Opportunity_ID','Found_At','Platform','Working_Title_From_URL',
 'Direct_Job_URL','Evidence_Category_URL','Focus','Fit_Score_Heuristic',
 'Status','Application_Route','Budget_Verified','Existing_Contact',
 'Next_Action','Owner','Evidence_Classification'];
function impDhSafe_(v,max) {
 var txt=String(v===null||v===undefined?'':v).replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max||240);
 return /^[=+\-@\t\r]/.test(txt)?"'"+txt:txt;
}
function impDhConfig_(){
 var key=PropertiesService.getScriptProperties().getProperty('IMPERION_INTAKE_BRIDGE_KEY')||'';
 if(!/^[a-f0-9]{64}$/i.test(key))throw Error('MISSING_EXISTING_PRIVATE_BRIDGE_KEY');
 var id=PropertiesService.getScriptProperties().getProperty('IMPERION_CRM_SHEET_ID')||
  (typeof SPREADSHEET_ID==='string'?SPREADSHEET_ID:'');
 if(id!==IMP_DH_HUB_ID)throw Error('WRONG_EXISTING_COMMUNITY_HUB');
 var owner=DriveApp.getFileById(id).getOwner();
 var ownerEmail=owner?String(owner.getEmail()||'').toLowerCase():'';
 var effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
 if(!ownerEmail||!effective||effective!==ownerEmail)throw Error('OWNER_ONLY');
 return {key:key,book:SpreadsheetApp.openById(id)};
}
function impDhRequest_(key,action){
 var opt={method:action?'post':'get',headers:{Authorization:'Bearer '+key},
  contentType:'application/json',muteHttpExceptions:true,followRedirects:false};
 if(action)opt.payload=JSON.stringify(action);
 var res=UrlFetchApp.fetch(IMP_DH_SYNC_URL,opt),body={};
 if(res.getResponseCode()!==200)throw Error('SOURCE_BRIDGE_HTTP_'+res.getResponseCode());
 try{body=JSON.parse(res.getContentText())}catch(e){throw Error('BAD_PRIVATE_BRIDGE_JSON');}
 if(body.ok!==true)throw Error('SOURCE_BRIDGE_NOT_OK');
 return body;
}
function impDhRow_(r){
 var source=String(r.source_key||'');
 if(!/^TED:[0-9]{6,8}-20[0-9]{2}$/.test(source))throw Error('INVALID_SOURCE_KEY');
 var id=source.replace(':','-');
 var exactUrl='https://ted.europa.eu/cs/notice/-/detail/'+source.slice(4);
 if(r.source_url!==exactUrl)throw Error('NON_OFFICIAL_SOURCE_URL');
 if(r.economics_gate!=='REVIEW_UNCOSTED')throw Error('UNEXPECTED_ECONOMICS_STATE');
 var title=impDhSafe_(r.title,235),buyer=impDhSafe_(r.buyer,160);
 if(title.length<12)throw Error('INVALID_TITLE');
 var score=Number(r.fit_score);
 if(!Number.isInteger(score)||score<40||score>100)throw Error('INVALID_FIT_SCORE');
 return [
  'OPP-'+id,impDhSafe_(r.published_on||new Date().toISOString().slice(0,10),20),
  'TED Official',title,exactUrl,'https://ted.europa.eu/en/',
  'TED public procurement / '+buyer,score,'REVIEW_UNCOSTED',
  'OFFICIAL_TENDER_PORTAL_REQUIRES_ELIGIBILITY_CHECK','NOT_VERIFIED',
  'NOT_CHECKED_IN_GMAIL',
  'Check actual deadline, sole trader eligibility, budget for OSVC scope, ALL owner hours, net >=1000 CZK/hour; owner GO before application',
  'Aliaksei',
  'Official TED public notice '+source+
   '; buyer interest, OSVC eligibility, application status, budget, working hours, contract and cash NOT VERIFIED; source '+exactUrl
 ];
}
/** Scheduled, bound owner-authorized private CRM import. NEVER sends messages. */
function imperionDealHunterSync(){
 var lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))return {status:'SKIPPED_LOCK',messages_sent:0};
 try{
  var config=impDhConfig_(),book=config.book,sh=book.getSheetByName(IMP_DH_SHEET);
  if(!sh)throw Error('MISSING_CANONICAL_B2B_TAB');
  var head=sh.getRange(1,1,1,15).getDisplayValues()[0];
  if(head.length!==15||head.some(function(h,i){return h!==IMP_DH_HEADERS[i];}))
   throw Error('B2B_COLUMN_SCHEMA_DRIFT');
  var feed=impDhRequest_(config.key,null);
  if(!Array.isArray(feed.pending)||feed.pending.length>15||feed.entity!=='OSVC')
   throw Error('UNTRUSTED_BRIDGE_PAYLOAD');
  var last=sh.getLastRow(),known={},urls={};
  if(last>1){
   sh.getRange(2,1,last-1,1).getDisplayValues().forEach(function(row){if(row[0])known[row[0]]=true;});
   sh.getRange(2,5,last-1,1).getDisplayValues().forEach(function(row){if(row[0])urls[row[0]]=true;});
  }
  var ids=[],added=0;
  feed.pending.forEach(function(r){
   var values=impDhRow_(r),id=values[0],url=values[4];
   if(known[id]) {
    // Verify the canonical ID resolves to the SAME URL, not just a matching label.
    var found=false, rows=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),5).getDisplayValues();
    rows.forEach(function(x){if(x[0]===id&&x[4]===url)found=true;});
    if(!found)throw Error('ID_COLLISION_REQUIRES_MANUAL_REVIEW');
   } else {
    if(urls[url])throw Error('SOURCE_URL_COLLISION_REQUIRES_MANUAL_REVIEW');
    var next=sh.getLastRow()+1;
    if(next>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),1);
    sh.getRange(next,1,1,15).setValues([values]);
    var verify=sh.getRange(next,1,1,15).getDisplayValues()[0];
    if(verify[0]!==id||verify[4]!==url||verify[8]!=='REVIEW_UNCOSTED')
     throw Error('SHEET_PERSISTENCE_READBACK_FAILED');
    known[id]=true; urls[url]=true; added++;
   }
   ids.push(r.source_key);
  });
  // A failure above prevents ACK; on next retry duplicate rows are recognized by source key.
  var ack=ids.length?impDhRequest_(config.key,{action:'ack',ids:ids}):{acked:0};
  return {status:'IMPORTED_OR_ALREADY_PRESENT',added:added,ack_confirmed:ack.acked||0,
   candidates:ids.length,communications:0,submissions:0,messages_sent:0};
 }finally{lock.releaseLock();}
}
/** Run ONCE from the existing private Apps Script account after reviewing source. */
function imperionInstallDealHunterSync(){
 impDhConfig_();
 var existing=ScriptApp.getProjectTriggers().filter(function(t){
  return t.getHandlerFunction()===IMP_DH_HANDLER;
 });
 if(existing.length>1)throw Error('DUPLICATE_DEAL_HUNTER_TRIGGERS');
 if(existing.length===1)return {installed:false,existing:true};
 ScriptApp.newTrigger(IMP_DH_HANDLER).timeBased().everyHours(1).create();
 return {installed:true,trigger_handler:IMP_DH_HANDLER};
}
