/**
 * Optional read-only handoff from the EXISTING Community Hub Google Sheet.
 *
 * Install only in the verified owner-bound Apps Script project after code
 * review. Editor/private server-side use ONLY; trailing underscore makes it
 * non-invocable through google.script.run. Do not add doGet/doPost, menus,
 * triggers, Drive files or external requests. No logger of personal data.
 *
 * Returns a bounded, field-allowlisted snapshot for the local
 * ops/imperion-agent-team.cjs preview. Does not make any agent autonomous.
 */
function imperionAgentBuildSnapshot_() {
  if (typeof ocOwner_ !== 'function' || typeof ocId_ !== 'function')
    throw new Error('IMPERION_OWNER_GUARD_MISSING');
  ocOwner_();
  return imperionAgentTrustedSnapshot_(ocId_());
}
// Only call after a verified owner or verified installable-trigger guard.
// Trailing underscore keeps this inaccessible through google.script.run.
function imperionAgentTrustedSnapshot_(hubId) {
  'use strict';
  var specs = [
    ['Leads', 'Lead_ID', ['Lead_ID','Email','Stage','Action_Status','Expected_Value_CZK','Next_Action_At','Last_Contact_At']],
    ['Revenue_Actions', 'Lead_ID', ['Lead_ID','Stage','Action_Status','Expected_CZK','Next_Action_At']],
    ['SocialPublishing', 'Job_ID', ['Job_ID','Event_ID','Channel','Status','Rights_OK','Approved_At']],
    ['Events', 'Event_ID', ['Event_ID','Status','Start_DateTime']],
    ['IMPERION_Agent_Jobs', 'Job_ID', ['Job_ID','Status','Priority','Deadline_At','Owner_Approval','Evidence_URI']]
  ];
  // Hub ID must still match the existing configuration.
  if (typeof SPREADSHEET_ID !== 'string' || !SPREADSHEET_ID ||
      SPREADSHEET_ID !== hubId) {
    throw new Error('IMPERION_WRONG_HUB_ID');
  }
  var book = SpreadsheetApp.openById(hubId);
  if (!book || book.getSpreadsheetTimeZone() !== 'Europe/Prague') {
    throw new Error('IMPERION_HUB_TIMEZONE_OR_BOUND_PROJECT_UNVERIFIED');
  }
  var result = {
    schema_version:1,
    source_system:'EXISTING_IMPERION_HUB',
    snapshot_id:'hub-'+Utilities.getUuid(),
    captured_at:(new Date()).toISOString(),
    data:{ShortFactory:[]}
  };
  specs.forEach(function(spec) {
    var tab = spec[0], key = spec[1], keep = spec[2];
    var sheet = book.getSheetByName(tab);
    if (!sheet) throw new Error('IMPERION_REQUIRED_SHEET_MISSING:'+tab);
    var n = sheet.getLastRow();
    if (n > 4001) throw new Error('IMPERION_MAX_ROWS_EXCEEDED:'+tab);
    var width = sheet.getLastColumn();
    if (width<1 || width>100) throw new Error('IMPERION_INVALID_WIDTH:'+tab);
    var header = sheet.getRange(1,1,1,width).getValues()[0].map(function(v){return String(v).trim();});
    var indexes = {};
    keep.forEach(function(col) {
      var all=[];
      header.forEach(function(h,i){if (h===col) all.push(i);});
      if (col===key && all.length!==1) throw new Error('IMPERION_SOURCE_KEY_MISSING_OR_DUPLICATE:'+tab);
      if (all.length>1) throw new Error('IMPERION_AMBIGUOUS_HEADER:'+tab);
      if (all.length===1) indexes[col]=all[0];
    });
    var count=n-1;
    var raw=count>0 ? sheet.getRange(2,1,count,width).getValues() : [];
    result.data[tab]=raw.filter(function(row) {
      return String(row[indexes[key]] || '').trim() !== '';
    }).map(function(row) {
      var safe={};
      keep.forEach(function(name) {
        if (!Object.prototype.hasOwnProperty.call(indexes,name)) return;
        var value=row[indexes[name]];
        // Spreadsheet native date cells are UTC instants; do not convert to
        // ambiguous Prague wall time or locale-specific text.
        safe[name] = value instanceof Date ? value.toISOString()
          : (typeof value==='number'||typeof value==='boolean' ? value : String(value || '').trim());
      });
      return safe;
    });
  });
  // Optional PRIVATE audit from the same owner-bound project. The aggregate
  // is a read-only source CLAIM, never an independent bank/provider receipt.
  if (typeof imperionClosedLoopAudit_ === 'function') {
    var audit = typeof imperionClosedLoopAuditTrusted_ === 'function'
      ? imperionClosedLoopAuditTrusted_(hubId)
      : imperionClosedLoopAudit_();
    if (!audit || audit.mode !== 'READ_ONLY_PRIVATE_OWNER_AUDIT' ||
        audit.source !== 'EXISTING_IMPERION_COMMUNITY_HUB' ||
        audit.paid_checkout_release_allowed !== false ||
        audit.bank_verified_receipts !== 0) {
      throw new Error('IMPERION_CLOSED_LOOP_AUDIT_UNSAFE');
    }
    result.control_audit = audit;
  }
  // This object stays in-memory in the owner Apps Script execution. It must
  // NEVER be logged or exposed as a public response or exported to public CI.
  return result;
}

/**
 * Safe, aggregate-only owner readback.
 * No contact details, record values, identifiers, secrets, or raw rows.
 * Accessible only to the same owner allowed by ocOwner_().
 */
function imperionAgentSnapshotHealth() {
  var snapshot = imperionAgentBuildSnapshot_();
  var names = ['Leads','Revenue_Actions','SocialPublishing','Events','IMPERION_Agent_Jobs'];
  var counts = {};
  names.forEach(function(name) { counts[name] = snapshot.data[name].length; });
  return {
    ok: true, schema_version: 1, source_system: snapshot.source_system,
    checked_at: snapshot.captured_at, read_only: true,
    source_rows_by_tab: counts, external_actions: 0
  };
}
