/**
 * IMPERION Closed Loop: owner-only aggregate audit of the EXISTING Community Hub.
 * No payment/bank providers are queried here: persisted statuses are CLAIMS.
 * No new triggers, menus, endpoints, invoices, charges, bookings or messages.
 */
function imperionClosedLoopAudit_() {
  'use strict';
  if (typeof ocOwner_ !== 'function' || typeof ocId_ !== 'function') {
    throw new Error('IMPERION_OWNER_GUARD_MISSING');
  }
  ocOwner_();
  var hubId = ocId_();
  if (typeof SPREADSHEET_ID !== 'string' || !SPREADSHEET_ID ||
      SPREADSHEET_ID !== hubId) throw new Error('IMPERION_WRONG_HUB');
  var book = SpreadsheetApp.openById(hubId);
  if (!book || book.getSpreadsheetTimeZone() !== 'Europe/Prague') {
    throw new Error('IMPERION_HUB_TIMEZONE_UNVERIFIED');
  }
  function s(x) { return x == null ? '' : String(x).trim(); }
  function up(x) { return s(x).toUpperCase(); }
  function read(name, key, keep) {
    var sheet = book.getSheetByName(name);
    if (!sheet) throw new Error('MISSING_EXISTING_TAB:' + name);
    var n = sheet.getLastRow(), width = sheet.getLastColumn();
    if (n < 1 || n > 5001 || width < 1 || width > 100 || n * width > 250000) {
      throw new Error('AUDIT_SOURCE_LIMIT:' + name);
    }
    var head = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(s);
    var indexes = {};
    keep.forEach(function(col) {
      var found = [];
      head.forEach(function(label, i) { if (label === col) found.push(i); });
      if (found.length !== 1) throw new Error('AUDIT_AMBIGUOUS_HEADER:' + name + ':' + col);
      indexes[col] = found[0];
    });
    var source = n > 1 ? sheet.getRange(2, 1, n - 1, width).getValues() : [];
    return source.filter(function(row) { return s(row[indexes[key]]) !== ''; })
      .map(function(row) {
        var result = {};
        keep.forEach(function(col) { result[col] = row[indexes[col]]; });
        return result;
      });
  }
  function index(rows, key) {
    var map = {}, repeated = {};
    rows.forEach(function(row) {
      var id = s(row[key]);
      if (Object.prototype.hasOwnProperty.call(map, id)) repeated[id] = true;
      else map[id] = row;
    });
    return {map: map, repeated: repeated, duplicates: Object.keys(repeated).length};
  }
  var bookings = read('Druzina_Bookings', 'Booking_ID',
    ['Booking_ID','Session_ID','Payment_ID','Status','Booking_Type']);
  var payments = read('Druzina_Payments', 'Payment_ID',
    ['Payment_ID','Verification_Status','Amount_CZK']);
  var quotes = read('Druzina_Quotes', 'Quote_ID', ['Quote_ID','Status']);
  var sessions = read('Druzina_Sessions', 'Session_ID', ['Session_ID','Status']);
  var jobs = read('IMPERION_Agent_Jobs', 'Job_ID',
    ['Job_ID','Status','Owner_Approval','Evidence_URI']);
  var receipts = read('IMPERION_Execution_Receipts', 'Receipt_ID',
    ['Receipt_ID','Job_ID','Status','Verified_At','Verifier','Evidence_URI']);
  var gates = read('Druzina_Deployment_Checklist', 'Task_ID', ['Task_ID','Status']);
  var config = read('Druzina_Config', 'Key', ['Key','Value']);
  var exceptions = read('IMPERION_Exceptions', 'Exception_ID', ['Exception_ID','Status']);

  var bi = index(bookings,'Booking_ID'), pi = index(payments,'Payment_ID');
  var qi = index(quotes,'Quote_ID'), si = index(sessions,'Session_ID');
  var ji = index(jobs,'Job_ID'), ri = index(receipts,'Receipt_ID');
  var gi = index(gates,'Task_ID'), ci = index(config,'Key');
  var ei = index(exceptions,'Exception_ID');
  var receiptsForJob = {};
  receipts.forEach(function(row) {
    var id = s(row.Job_ID);
    if (id) receiptsForJob[id] = (receiptsForJob[id] || 0) + 1;
  });
  var counts = {
    bookings_total: bookings.length,
    booking_confirmed_claims: 0,
    booking_claims_missing_payment: 0,
    booking_claims_missing_session: 0,
    booking_claims_with_partial_payment: 0,
    booking_confirmations_unverified_by_provider: 0,
    payments_total: payments.length,
    payment_partial_claims: 0,
    payment_verified_claims_unverified_by_provider: 0,
    invalid_payment_amounts: 0,
    quotes_total: quotes.length,
    quote_paid_claims_unverified_by_provider: 0,
    agent_jobs_total: jobs.length,
    agent_completed_claims: 0,
    completed_claims_without_stored_receipt: 0,
    completed_claims_with_receipt_still_needing_provider: 0,
    open_exceptions: 0
  };
  var activeClaims = ['CONFIRMED','ATTENDED','CHECKED_IN','PROVISIONAL_PAID'];
  bookings.forEach(function(b) {
    var status = up(b.Status);
    if (activeClaims.indexOf(status) < 0) return;
    var confirmed = ['CONFIRMED','ATTENDED','CHECKED_IN'].indexOf(status) >= 0;
    if (confirmed) {
      counts.booking_confirmed_claims++;
      counts.booking_confirmations_unverified_by_provider++;
    }
    var sessionId = s(b.Session_ID), paymentId = s(b.Payment_ID);
    if (!sessionId || !si.map[sessionId] || si.repeated[sessionId]) {
      counts.booking_claims_missing_session++;
    }
    var free = up(b.Booking_Type) === 'FREE';
    if (!free) {
      if (!paymentId || !pi.map[paymentId] || pi.repeated[paymentId]) {
        counts.booking_claims_missing_payment++;
      } else if (/PARTIAL|OUTSTANDING/.test(up(pi.map[paymentId].Verification_Status))) {
        counts.booking_claims_with_partial_payment++;
      }
    }
  });
  payments.forEach(function(p) {
    var status = up(p.Verification_Status);
    if (/PARTIAL|OUTSTANDING/.test(status)) counts.payment_partial_claims++;
    if (['VERIFIED','BANK_VERIFIED','PAID','SETTLED'].indexOf(status) >= 0) {
      counts.payment_verified_claims_unverified_by_provider++;
    }
    var value = Number(p.Amount_CZK);
    if (s(p.Amount_CZK) && (!isFinite(value) || value <= 0)) {
      counts.invalid_payment_amounts++;
    }
  });
  quotes.forEach(function(q) {
    if (['PAID','SETTLED','FULFILLED'].indexOf(up(q.Status)) >= 0) {
      counts.quote_paid_claims_unverified_by_provider++;
    }
  });
  jobs.forEach(function(j) {
    if (['DONE','CLOSED','VERIFIED','ACCEPTED'].indexOf(up(j.Status)) < 0) return;
    counts.agent_completed_claims++;
    if (!receiptsForJob[s(j.Job_ID)]) {
      counts.completed_claims_without_stored_receipt++;
    } else {
      counts.completed_claims_with_receipt_still_needing_provider++;
    }
  });
  exceptions.forEach(function(e) {
    if (['OPEN','BLOCKED','NEW','ESCALATED'].indexOf(up(e.Status)) >= 0) {
      counts.open_exceptions++;
    }
  });
  var hardGateIds = ['D06','D14','D18','D21','D23','D25','D26','D31'];
  var blockedGates = hardGateIds.filter(function(id) {
    // A checklist self-report is never a license, policy or bank proof.
    return !gi.map[id] || gi.repeated[id] ||
      up(gi.map[id].Status) !== 'PROVIDER_VERIFIED_AND_OWNER_APPROVED';
  });
  var flags = {};
  ['CALENDAR_SYNC_ENABLED','PREZENCKY_SYNC_ENABLED'].forEach(function(k) {
    flags[k] = !!(ci.map[k] && !ci.repeated[k] && up(ci.map[k].Value) === 'TRUE');
  });
  return {
    schema_version: 1,
    mode: 'READ_ONLY_PRIVATE_OWNER_AUDIT',
    source: 'EXISTING_IMPERION_COMMUNITY_HUB',
    checked_at: (new Date()).toISOString(),
    counts: counts,
    duplicates: {
      bookings: bi.duplicates, payments: pi.duplicates, quotes: qi.duplicates,
      sessions: si.duplicates, jobs: ji.duplicates, receipts: ri.duplicates,
      gates: gi.duplicates, config: ci.duplicates, exceptions: ei.duplicates
    },
    hard_gates_unverified: blockedGates,
    protected_sync_flags: flags,
    bank_readback: 'NOT_PERFORMED',
    booking_provider_readback: 'NOT_PERFORMED',
    bank_verified_receipts: 0,
    provider_verified_bookings: 0,
    provider_verified_agent_completion: 0,
    paid_checkout_release_allowed: false,
    published_or_sent_or_charged: 0,
    new_triggers_or_records: 0,
    next: 'REQUIRE_OWNER_VERIFIED_PAYEE_LEGAL_SAFETY_AND_INDEPENDENT_PROVIDER_RECEIPTS'
  };
}
/** No raw client IDs, names, prices or payments in the response. */
function imperionClosedLoopAuditHealth() {
  return imperionClosedLoopAudit_();
}
