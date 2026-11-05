/* Owner-approved native Apps Script job in the EXISTING Community Hub.
 * Never a ChatGPT Automation. This reuses the current Fio modules/tokens.
 * Installation and polling remain OFF until explicit protected owner GO. */
var DRU_BANK_TRIGGER_CONTEXT_=false;
function fioInstallBookingBankImport(){
  ocOwner_();var p=PropertiesService.getScriptProperties();
  if(p.getProperty('DRU_BANK_IMPORT_POLLING_APPROVED')!=='YES'||
      p.getProperty('DRU_BOOKING_ATTESTATION_ENABLED')!=='YES')return {ok:false,disabled:true,created:0};
  var existing=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='fioBookingImportTick_';});
  if(existing.length>1)throw Error('Duplicate Fio import triggers require owner review');
  if(existing.length)return {ok:true,created:0};
  ScriptApp.newTrigger('fioBookingImportTick_').timeBased().everyMinutes(5).create();
  return {ok:true,created:1};
}
function fioBookingImportTick_(event){
  var p=PropertiesService.getScriptProperties();
  if(p.getProperty('DRU_BANK_IMPORT_POLLING_APPROVED')!=='YES'||
      p.getProperty('DRU_BOOKING_ATTESTATION_ENABLED')!=='YES')return {ok:true,disabled:true};
  var profile=String(p.getProperty('DRU_BOOKING_BANK_PROFILE')||'');
  if(!['OSVC','DRUZINA'].includes(profile))throw Error('Confirmed bank profile required');
  var trigger=event&&ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='fioBookingImportTick_'&&
    String(t.getUniqueId())===String(event.triggerUid);});
  if(!trigger||event.authMode!==ScriptApp.AuthMode.FULL)throw Error('Verified native trigger required');
  var file=DriveApp.getFileById(ocId_()),owner=file.getOwner(),effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(!owner||!effective||effective!==String(owner.getEmail()||'').toLowerCase()||
      file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getEditors().length||file.getViewers().length)
    throw Error('Private owner-bound bank job required');
  DRU_BANK_TRIGGER_CONTEXT_=true;
  try{return profile==='OSVC'?fioSyncOSVCReadOnly():fioSyncDruzinaReadOnly();}
  finally{DRU_BANK_TRIGGER_CONTEXT_=false;}
}
