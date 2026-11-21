/**
 * IMPERION Agent4 -> EXISTING Community Hub CRM. Apps Script API owner-only.
 * No public web endpoint, no new CRM/bot, no emails, no provider sends, no cash.
 * Imported data is ONLY a SHA-derived source key and controller metadata.
 * Status remains INBOUND_UNQUALIFIED until owner verifies identity and context.
 */
var IMP_AG4_CRM_VERSION = '20261115-v1';
var IMP_AG4_CRM_KEY = 'IMP_AGENT4_CRM_ENABLED';
var IMP_AG4_CRM_STOP = 'IMP_AGENT4_CRM_KILL_SWITCH';
var IMP_AG4_CRM_SOURCE = 'telegram-agent4';
var IMP_AG4_CRM_SOURCE_PATTERN = /^IMP4-TG-[0-9a-f]{24}$/;
var IMP_AG4_CRM_CONTROLLERS = {
  OSVC: 'Leads', DRUZINA_MORAVY_ZS: 'Druzina_Enrollment_Pipeline'
};

function impAg4Guard_() {
  if (typeof ocOwner_ !== 'function') throw Error('OWNER_GUARD_MISSING');
  ocOwner_(); // existing owner + PRIVATE-only canonical Community Hub guard
  if (typeof ocId_ !== 'function') throw Error('CANONICAL_HUB_BINDING_MISSING');
}
function impAg4Properties_() {
  if (typeof PropertiesService === 'undefined') throw Error('PROPERTIES_UNAVAILABLE');
  return PropertiesService.getScriptProperties();
}
function impAg4Header_(sheet, names) {
  if (!sheet) throw Error('CRM_TAB_MISSING');
  var last = sheet.getLastColumn();
  if (last < names.length || last > 70) throw Error('CRM_SCHEMA_UNEXPECTED');
  var h = sheet.getRange(1, 1, 1, last).getDisplayValues()[0];
  var map = Object.create(null);
  h.forEach(function (n, i) {
    if (n && Object.prototype.hasOwnProperty.call(map, n)) throw Error('CRM_HEADER_DUPLICATE');
    if (n) map[n] = i;
  });
  names.forEach(function (n) {
    if (!Object.prototype.hasOwnProperty.call(map, n)) throw Error('CRM_HEADER_MISSING_' + n);
  });
  return {headers: h, cols: map};
}
function impAg4Scan_(sheet, col, key) {
  var last = sheet.getLastRow();
  if (last > 5000) throw Error('CRM_SCAN_CAP_REACHED');
  if (last < 2) return [];
  var data = sheet.getRange(2, col + 1, last - 1, 1).getDisplayValues();
  var match = [];
  data.forEach(function (r, i) { if (String(r[0]).trim() === key) match.push(i + 2); });
  return match;
}
function impAg4Row_(sh, h, row) {
  var cells = sh.getRange(row, 1, 1, h.headers.length).getDisplayValues()[0];
  var obj = Object.create(null);
  h.headers.forEach(function (k, i) { if (k) obj[k] = String(cells[i] || '').trim(); });
  return obj;
}
function impAg4Source_(sourceKey, controller) {
  if (typeof sourceKey !== 'string' || !IMP_AG4_CRM_SOURCE_PATTERN.test(sourceKey))
    throw Error('INVALID_SOURCE_KEY');
  if (!Object.prototype.hasOwnProperty.call(IMP_AG4_CRM_CONTROLLERS, controller))
    throw Error('INVALID_LEGAL_CONTROLLER');
  return {key: sourceKey, entity: controller, tab: IMP_AG4_CRM_CONTROLLERS[controller]};
}
function impAg4Check_(ss, sourceKey, controller) {
  var scope = impAg4Source_(sourceKey, controller);
  var sh = ss.getSheetByName(scope.tab);
  var isOs = controller === 'OSVC';
  var h = impAg4Header_(sh, isOs ?
    ['Lead_ID', 'Created_At', 'Source', 'Stage', 'Submission_ID', 'Action_Status', 'Notes', 'Receipt_Status'] :
    ['Lead_ID', 'Person', 'Channel', 'Stage', 'Cash_Status', 'Evidence', 'Consent_Context', 'Outcome']);
  var col = h.cols[isOs ? 'Submission_ID' : 'Evidence'];
  var matches = impAg4Scan_(sh, col, sourceKey);
  if (matches.length > 1) throw Error('DUPLICATE_REMOTE_SOURCE_KEY');
  if (!matches.length) return {exists: false, sheet: sh, header: h, controller: controller};
  var obj = impAg4Row_(sh, h, matches[0]);
  if (isOs ? obj.Lead_ID !== 'LEAD-AG4-' + sourceKey.slice('IMP4-TG-'.length) :
      !/^DM-[0-9]{3,6}$/.test(obj.Lead_ID))
    throw Error('EXISTING_CRM_ID_UNEXPECTED');
  if (isOs && obj.Source !== IMP_AG4_CRM_SOURCE) throw Error('SOURCE_OWNER_CONFLICT');
  if (!isOs && obj.Channel !== IMP_AG4_CRM_SOURCE) throw Error('SOURCE_OWNER_CONFLICT');
  return {exists: true, case_id: obj.Lead_ID, row: matches[0],
    sheet: sh, header: h, controller: controller};
}
function impAg4Validate_(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error('PAYLOAD_OBJECT_REQUIRED');
  var allowed = ['source_key','source','legal_entity','local_job_id','inbound_at','stage',
    'identity_match','crm_person_id','provider_send_status','privacy','owner_selftest'];
  Object.keys(p).forEach(function (k) {
    if (allowed.indexOf(k) < 0) throw Error('UNEXPECTED_PRIVATE_PAYLOAD_FIELD');
  });
  var scope = impAg4Source_(p.source_key, p.legal_entity);
  if (p.source !== IMP_AG4_CRM_SOURCE || !Number.isSafeInteger(p.local_job_id) ||
      p.local_job_id < 1 || p.local_job_id > 1000000000 ||
      p.stage !== 'INBOUND_UNQUALIFIED' || p.identity_match !== 'NOT_VERIFIED' ||
      p.crm_person_id !== null || p.owner_selftest !== false ||
      p.privacy !== 'NO_MESSAGE_TEXT_NO_PHONE_NO_NAME' ||
      ['NO_CONFIRMED_SEND','API_ACCEPTED_NOT_DELIVERY'].indexOf(p.provider_send_status) === -1)
    throw Error('UNTRUSTED_SOURCE_OR_BUSINESS_STATUS');
  var ts = String(p.inbound_at || '');
  if (!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(ts))
    throw Error('INVALID_SOURCE_TIME');
  if (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(ts)) ts = ts.replace(' ', 'T') + 'Z';
  var parsed = Date.parse(ts);
  if (!isFinite(parsed) || parsed > Date.now() + 300000 || parsed < Date.now() - 90 * 86400000)
    throw Error('SOURCE_TIMESTAMP_OUT_OF_SCOPE');
  scope.inboundIso = new Date(parsed).toISOString();
  scope.job_id = p.local_job_id;
  return scope;
}
function impAg4NextDmId_(sh, h) {
  var last = sh.getLastRow(), max = 0;
  if (last >= 2) sh.getRange(2, h.cols.Lead_ID + 1, last - 1, 1)
    .getDisplayValues().forEach(function (r) {
      var m = /^DM-(\d{3,6})$/.exec(String(r[0]).trim());
      if (m) max = Math.max(max, Number(m[1]));
    });
  if (max >= 999999) throw Error('DM_ID_CAP_REACHED');
  return 'DM-' + String(max + 1).padStart(3, '0');
}
function impAg4Append_(ss, scope) {
  var existing = impAg4Check_(ss, scope.key, scope.entity);
  if (existing.exists) return {case_id: existing.case_id, state: 'EXISTING_SOURCE_VERIFIED'};
  var sh = existing.sheet, h = existing.header;
  var id = scope.entity === 'OSVC' ?
    'LEAD-AG4-' + scope.key.slice('IMP4-TG-'.length) : impAg4NextDmId_(sh, h);
  var row = Object.create(null);
  if (scope.entity === 'OSVC') {
    row.Lead_ID = id;
    row.Created_At = scope.inboundIso;
    row.Source = IMP_AG4_CRM_SOURCE;
    row.Service = 'Needs owner qualification';
    row.Subject_Goal = 'Review local Agent4 job #' + scope.job_id + '; no message text copied';
    row.Stage = 'New';
    row.Submission_ID = scope.key;
    row.Action_Status = 'HOLD_IDENTITY_HISTORY_CONSENT_REVIEW';
    row.Receipt_Status = 'SOURCE_METADATA_ONLY_NOT_DELIVERED';
    row.Owner = 'OWNER_REVIEW';
    row.Notes = 'Unverified owner-scoped Telegram inbound metadata only. No identity, pricing, opt-in to marketing, contract, delivery or bank cash verified.';
    row.Retention_Until = new Date(Date.parse(scope.inboundIso) + 90*86400000).toISOString();
  } else {
    row.Lead_ID = id;
    row.Person = '';
    row.Relationship = 'Unverified inbound';
    row.Channel = IMP_AG4_CRM_SOURCE;
    row.Stage = 'INBOUND_UNQUALIFIED';
    row.Cash_Status = 'NOT_BANK_VERIFIED';
    row.Dates = scope.inboundIso;
    row.Next_Action = 'Owner to review Agent4 local job #' + scope.job_id + ' and contact/guardian permissions';
    row.Responsible = 'OWNER_REVIEW';
    row.Consent_Context = 'USER_INITIATED_TELEGRAM_CONTROLLER_SCOPE_ONLY_NOT_MARKETING_CONSENT';
    row.Evidence = scope.key;
    row.Verified_As_Of = new Date().toISOString();
    row.Risk_or_Notes = 'Age, guardian, safety, identity, history, rights and payment not verified; no automatic invite/send';
    row.Outcome = 'PENDING_OWNER_REVIEW';
  }
  sh.appendRow(h.headers.map(function (k) { return Object.prototype.hasOwnProperty.call(row, k) ? row[k] : ''; }));
  SpreadsheetApp.flush();
  var result = impAg4Check_(ss, scope.key, scope.entity);
  if (!result.exists || result.case_id !== id) throw Error('WRITE_READBACK_MISMATCH_RECONCILE_BEFORE_RETRY');
  return {case_id: id, state: 'CREATED_REMOTE_READBACK_VERIFIED'};
}
/** Read-only: safe probe from an authorized Apps Script API owner. */
function impAgent4CrmPing() {
  impAg4Guard_();
  var ss = SpreadsheetApp.openById(ocId_());
  impAg4Header_(ss.getSheetByName('Leads'), ['Lead_ID','Submission_ID','Action_Status']);
  impAg4Header_(ss.getSheetByName('Druzina_Enrollment_Pipeline'), ['Lead_ID','Evidence','Cash_Status']);
  var p = impAg4Properties_();
  return JSON.stringify({ok:true,version:IMP_AG4_CRM_VERSION,
    enabled:p.getProperty(IMP_AG4_CRM_KEY) === 'true',
    kill_switch:p.getProperty(IMP_AG4_CRM_STOP) === 'true',
    controller_tabs_verified:true,external_sends:0});
}
/** Owner-only operation, no standing or outbound authorization given. */
function impAgent4CrmEnable(approvalRef, enabled) {
  impAg4Guard_();
  if (approvalRef !== 'GO-AG4-CRM-20261115-OWNER') throw Error('EXACT_OWNER_APPROVAL_MISSING');
  if (enabled !== true && enabled !== false) throw Error('EXPLICIT_BOOLEAN_REQUIRED');
  var p = impAg4Properties_();
  p.setProperty(IMP_AG4_CRM_KEY, enabled ? 'true' : 'false');
  return JSON.stringify({ok:true,enabled:enabled,external_sends:0});
}
/** Authenticated owner-controlled inbound import, review only. */
function impAgent4CrmImport(payload) {
  impAg4Guard_();
  var p = impAg4Properties_();
  if (p.getProperty(IMP_AG4_CRM_KEY) !== 'true' ||
      p.getProperty(IMP_AG4_CRM_STOP) === 'true') throw Error('AGENT4_CRM_IMPORT_DISABLED');
  var scope = impAg4Validate_(payload);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw Error('CRM_LOCK_BUSY');
  try {
    var result = impAg4Append_(SpreadsheetApp.openById(ocId_()),scope);
    return JSON.stringify({ok:true,state:result.state,source_key:scope.key,
      case_id:result.case_id,controller:scope.entity,identity_verified:false,
      payment_verified:false,provider_sent:false});
  } finally { lock.releaseLock(); }
}
/** Second independent source-key readback; never assumes import ACK means success. */
function impAgent4CrmVerify(sourceKey, legalEntity) {
  impAg4Guard_();
  var record = impAg4Check_(SpreadsheetApp.openById(ocId_()),sourceKey,legalEntity);
  return JSON.stringify({ok:true,source_key:sourceKey,controller:legalEntity,
    found:record.exists,case_id:record.exists ? record.case_id : null,
    identity_verified:false,payment_verified:false,external_sends:0});
}
/** Flat proof tokens for clasp CLI; no customer data, no PII or auth tokens. */
function impAgent4CrmPingToken() {
  var v = JSON.parse(impAgent4CrmPing());
  return 'IMPAG4_PING_' + (v.enabled ? 'ENABLED' : 'DISABLED') +
    '_' + (v.kill_switch ? 'KILLED' : 'READY') + '_V1';
}
function impAgent4CrmImportToken(payload) {
  var v = JSON.parse(impAgent4CrmImport(payload));
  return 'IMPAG4_IMPORT_' + v.state + '_' + v.source_key + '_' + v.case_id;
}
function impAgent4CrmVerifyToken(sourceKey, legalEntity) {
  var v = JSON.parse(impAgent4CrmVerify(sourceKey,legalEntity));
  return 'IMPAG4_VERIFY_' + (v.found ? 'FOUND' : 'MISSING') +
    '_' + v.source_key + '_' + (v.case_id || 'NONE');
}
