/** Additive recovery for the EXISTING private Community Hub. No web endpoints.
 * Does not change prices, forms, payments, posts or the existing onOpen handler.
 * Requires RevenuePipeline.js with idempotent rpAppendLead_ and RP config.
 */
function prOwner_() {
  var a = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var e = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  var owner = DriveApp.getFileById(RP.SPREADSHEET_ID).getOwner();
  if (!owner || !a || a !== e || a !== owner.getEmail().toLowerCase()) throw Error('Owner access required');
}
function prConfig_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('RP_LEAD_FORM_ID');
  if (!id) throw Error('Existing lead Form ID is missing');
  var form = FormApp.openById(id);
  var ss = SpreadsheetApp.openById(RP.SPREADSHEET_ID);
  var config = ss.getSheetByName(RP.CONFIG_SHEET);
  if (!config) throw Error('Existing Revenue_Config missing');
  var rows = config.getDataRange().getValues();
  var urls = rows.filter(function(r) { return r[0] === 'LEAD_FORM_URL'; });
  function canonical(u) { return String(u || '').split('?')[0].replace(/\/$/, ''); }
  if (urls.length !== 1 || canonical(urls[0][1]) !== canonical(form.getPublishedUrl())) throw Error('Published Form identity mismatch');
  return {props:p, form:form, ss:ss};
}
function prMatchingTriggers_(triggers, id) {
  return triggers.filter(function(t) {
    return t.getHandlerFunction() === 'rpOnLeadFormSubmit' &&
      String(t.getTriggerSourceId() || '') === String(id) &&
      t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT;
  });
}
function prKnown_(sheet) {
  if (!sheet) throw Error('Existing Leads tab missing');
  var data = sheet.getDataRange().getValues(), h = data[0] || [];
  var col = h.indexOf('Submission_ID');
  if (col < 0) throw Error('Submission_ID column missing');
  if (h.lastIndexOf('Submission_ID') !== col) throw Error('Duplicate Submission_ID column');
  var known = Object.create(null);
  data.slice(1).forEach(function(row) { if (row[col]) known[String(row[col])] = true; });
  return known;
}
function prPlanRecovery_(responses, known, limit) {
  var seen = Object.create(null), missing = [];
  responses.forEach(function(r) {
    var id = String(r.getId() || '');
    if (!id) throw Error('Form response has no immutable ID');
    if (!known[id] && !seen[id]) { missing.push(r); seen[id] = true; }
  });
  missing.sort(function(a,b) { return a.getTimestamp().getTime()-b.getTimestamp().getTime() || String(a.getId()).localeCompare(String(b.getId())); });
  return {batch:missing.slice(0,limit), missing:missing.length, remaining:Math.max(0,missing.length-limit)};
}
function prSince_(props) {
  var marker = props.getProperty('PLATFORM_RECOVERY_SINCE');
  if (!marker) throw Error('Set reviewed PLATFORM_RECOVERY_SINCE ISO timestamp; no implicit historical import');
  // Require an explicit timezone and a real calendar date; Date alone normalizes
  // impossible dates and interprets timezone-free input in the runtime timezone.
  var m = String(marker).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/);
  var day = m ? new Date(m[1] + 'T00:00:00Z') : null;
  if (!m || !isFinite(day.getTime()) || day.toISOString().slice(0,10) !== m[1] ||
      Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4]) > 59 ||
      Number(m[6] || 0) > 14 || Number(m[7] || 0) > 59 ||
      Number(m[6] || 0) === 14 && Number(m[7] || 0) !== 0) throw Error('Invalid recovery start timestamp');
  var d = new Date(marker);
  if (!isFinite(d.getTime()) || d.getTime() > Date.now()) throw Error('Invalid recovery start timestamp');
  return d;
}
function prInspect_() {
  var c = prConfig_(), known = prKnown_(c.ss.getSheetByName(RP.LEADS_SHEET));
  var since = prSince_(c.props), responses = c.form.getResponses(since);
  var plan = prPlanRecovery_(responses,known,50);
  return {c:c, plan:plan, summary:{mode:'READ_ONLY', responseCount:responses.length,
    missingLeads:plan.missing, batchLimit:50,
    exactFormTriggers:prMatchingTriggers_(ScriptApp.getProjectTriggers(),c.form.getId()).length,
    recovered:0, cashVerified:false, publicPostsSent:0}};
}
function platformRecoveryPreview() {
  prOwner_(); var summary = prInspect_().summary;
  // Editor runs do not display return values. Log only the bounded summary,
  // never the inspection context, response objects, identifiers or properties.
  console.log(JSON.stringify({event:'RECOVERY_PREVIEW',checkedAt:new Date().toISOString(),
    mode:summary.mode,responseCount:summary.responseCount,missingLeads:summary.missingLeads,
    batchLimit:summary.batchLimit,exactFormTriggers:summary.exactFormTriggers,
    recovered:summary.recovered,cashVerified:summary.cashVerified,publicPostsSent:summary.publicPostsSent}));
  return summary;
}
function platformRepairFormTrigger() {
  prOwner_(); var c=prConfig_(), triggers=ScriptApp.getProjectTriggers();
  var exact=prMatchingTriggers_(triggers,c.form.getId());
  // Create the replacement before removing only this handler's stale triggers.
  if (!exact.length) exact=[ScriptApp.newTrigger('rpOnLeadFormSubmit').forForm(c.form).onFormSubmit().create()];
  var keep=exact[0].getUniqueId();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction()==='rpOnLeadFormSubmit' && t.getUniqueId()!==keep) ScriptApp.deleteTrigger(t);
  });
  var count=prMatchingTriggers_(ScriptApp.getProjectTriggers(),c.form.getId()).length;
  if(count!==1) throw Error('Trigger readback failed');
  return {exactFormTriggers:count, ingestionVerified:false};
}
function prRecover_() {
  // UserLock is distinct from the existing append handler's ScriptLock.
  var lock=LockService.getUserLock();
  if(!lock.tryLock(1000)) return {status:'BUSY'};
  try {
    var state=prInspect_(), recovered=0;
    for(var i=0;i<state.plan.batch.length;i++) {
      var response=state.plan.batch[i];
      rpOnLeadFormSubmit({response:response});
      SpreadsheetApp.flush();
      var known=prKnown_(state.c.ss.getSheetByName(RP.LEADS_SHEET));
      if(!known[String(response.getId())]) throw Error('CRM readback failed');
      recovered++;
    }
    state.c.props.setProperty('PLATFORM_RECOVERY_LAST_OK',new Date().toISOString());
    // Fixed reviewed window intentionally preserved: failed older submissions cannot be skipped.
    return {status:'RECOVERED',recovered:recovered,remaining:state.plan.remaining,publicPostsSent:0};
  } finally {lock.releaseLock();}
}
function platformRecoverMissingLeads() { prOwner_(); return prRecover_(); }
function platformInstallRecoveryTimer() {
  prOwner_(); var c=prConfig_();
  if(c.props.getProperty('PLATFORM_RECOVERY_E2E_VERIFIED')!=='true') throw Error('Verify one actual Form-to-Leads test and replay first');
  if(!c.props.getProperty('PLATFORM_RECOVERY_LAST_OK')) throw Error('Manual recovery/readback required first');
  var list=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='platformRecoveryTick_';});
  if(list.length>1) throw Error('Duplicate recovery timers require review');
  if(!list.length) list=[ScriptApp.newTrigger('platformRecoveryTick_').timeBased().everyMinutes(15).create()];
  c.props.setProperties({PLATFORM_RECOVERY_TRIGGER_ID:list[0].getUniqueId(),PLATFORM_RECOVERY_PAUSED:'false'});
  return {timerInstalled:true,publicPostsSent:0};
}
function platformRecoveryTick_(e) {
  var p=PropertiesService.getScriptProperties();
  if(p.getProperty('PLATFORM_RECOVERY_PAUSED')!=='false') return {status:'PAUSED'};
  if(!e || !e.triggerUid || String(e.triggerUid)!==p.getProperty('PLATFORM_RECOVERY_TRIGGER_ID')) throw Error('Scheduled trigger identity required');
  var owner=DriveApp.getFileById(RP.SPREADSHEET_ID).getOwner();
  if(!owner || owner.getEmail().toLowerCase()!==String(Session.getEffectiveUser().getEmail()).toLowerCase()) throw Error('Trigger owner mismatch');
  try { return prRecover_(); }
  catch (_) { p.setProperty('PLATFORM_RECOVERY_LAST_ERROR_AT',new Date().toISOString()); throw Error('Lead recovery failed; inspect private Form and CRM; no success claimed'); }
}
function platformPauseRecovery() {
  prOwner_(); PropertiesService.getScriptProperties().setProperty('PLATFORM_RECOVERY_PAUSED','true');
  return {status:'PAUSED'};
}
