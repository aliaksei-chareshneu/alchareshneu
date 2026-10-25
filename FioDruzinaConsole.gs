/**
 * Fio -> Družina z.s.: READ-ONLY banking adapter for existing Community Hub.
 * STAGED, not installed or enabled in production.
 * No tokens, customer data, bank account numbers or payments in source control.
 * Official Fio API v1.9 (2025-10-16): https://www.fio.cz/docs/cz/API_Bankovnictvi.pdf
 *
 * Uses the existing console Hub binding (RP or Code.gs fallback). Intended for the
 * privately owned Community Hub; not for any public web app response.
 * Install via the CURRENT bound Apps Script project only after code review.
 */

var FIO_DRUZINA_SHEET = 'Druzina_Fio_Transactions';
var FIO_DRUZINA_TIMEZONE = 'Europe/Prague';
var FIO_DRUZINA_HEADERS = [
  'Bank_Transaction_ID', 'Bank_Date', 'Amount_CZK', 'Currency',
  'VS', 'SS', 'Counterparty_Account', 'Counterparty_Name',
  'Message', 'Bank_Operation_Type', 'Bank_Payer_Reference',
  'Candidate_Payment_ID', 'Match_Status', 'Classification',
  'Restriction_Evidence_URL', 'Imported_At', 'Reviewed_By',
  'Reviewed_At', 'Review_Notes'
];

function fioNgCell_(entry, column) {
  var cell = entry && entry[column];
  return cell && cell.value !== undefined && cell.value !== null ? cell.value : '';
}

function fioNgCents_(raw) {
  if (raw === null || raw === undefined) throw new Error('Missing bank amount');
  if (typeof raw !== 'number' && typeof raw !== 'string') throw new Error('Invalid bank amount');
  var text = String(raw).trim();
  if (!text) throw new Error('Missing bank amount');
  function parse(value) {
    var match = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/.exec(value);
    return match ? Number(match[1] + match[2] + ((match[3] || '') + '00').slice(0, 2)) : NaN;
  }
  // Match reconciliation's exact decimal contract; do not round sub-cent input.
  var cents = parse(text);
  if (!isFinite(cents)) throw new Error('Invalid bank amount');
  if (!Number.isSafeInteger(cents) || parse(String(cents / 100)) !== cents) throw new Error('Unsupported sub-cent bank amount');
  return cents;
}

function fioNgDate_(raw) {
  if (typeof raw === 'number' && isFinite(raw)) {
    return Utilities.formatDate(new Date(raw), FIO_DRUZINA_TIMEZONE, 'yyyy-MM-dd');
  }
  var date = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.substring(0, 10);
  throw new Error('Invalid Fio transaction date');
}

function fioNgNormalizeTransaction_(entry) {
  var id = String(fioNgCell_(entry, 'column22')).trim();
  if (!/^\d{1,20}$/.test(id)) throw new Error('Missing or invalid bank transaction ID');
  var cents = fioNgCents_(fioNgCell_(entry, 'column1'));
  var currency = String(fioNgCell_(entry, 'column14')).trim();
  if (currency !== 'CZK') throw new Error('Unexpected bank transaction currency');
  return {
    id: id,
    date: fioNgDate_(fioNgCell_(entry, 'column0')),
    cents: cents,
    currency: currency,
    vs: String(fioNgCell_(entry, 'column5')).trim(),
    ss: String(fioNgCell_(entry, 'column6')).trim(),
    counterpartyAccount: String(fioNgCell_(entry, 'column2')).trim(),
    counterpartyBank: String(fioNgCell_(entry, 'column3')).trim(),
    counterpartyName: String(fioNgCell_(entry, 'column10')).trim(),
    message: String(fioNgCell_(entry, 'column16')).trim(),
    type: String(fioNgCell_(entry, 'column8')).trim(),
    payerReference: String(fioNgCell_(entry, 'column27')).trim()
  };
}

function fioNgNormalizeStatement_(response, expectedAccount) {
  var statement = response && response.accountStatement;
  var info = statement && statement.info;
  if (!info || String(info.bankId) !== '2010' ||
      String(info.accountId) !== String(expectedAccount) ||
      String(info.currency) !== 'CZK') {
    throw new Error('Fio account identity or currency mismatch');
  }
  var list = statement.transactionList;
  if (!list || !Object.prototype.hasOwnProperty.call(list, 'transaction')) {
    throw new Error('Malformed Fio transaction list');
  }
  var raw = list.transaction;
  if (raw === null) raw = [];
  if (!Array.isArray(raw)) throw new Error('Malformed Fio transactions');
  var rows = raw.map(fioNgNormalizeTransaction_);
  var seen = {};
  rows.forEach(function (tx) {
    if (seen[tx.id]) throw new Error('Duplicate transaction ID in Fio response');
    seen[tx.id] = true;
  });
  var balance = info.closingBalance === null || info.closingBalance === undefined || typeof info.closingBalance === 'string' && info.closingBalance.trim() === ''
    ? null : fioNgCents_(info.closingBalance) / 100;
  return { transactions: rows, balance: balance };
}

/** Match a candidate by exact amount + numeric VS; does NOT verify/settle payment. */
function fioNgMatchCandidate_(tx, paymentRows) {
  if (tx.cents <= 0) return { status: 'DEBIT_REVIEW', paymentId: '' };
  var reference = String(tx.vs == null ? '' : tx.vs).trim();
  if (!/^\d{1,10}$/.test(reference)) return { status: 'UNMATCHED', paymentId: '' };
  var vs = reference.replace(/^0+/, '') || '0';
  // Reference uniqueness includes historical/closed rows and all amounts.
  var matches = paymentRows.filter(function (row) {
    var ref = String(row[9] || '').trim();
    return /^\d{1,10}$/.test(ref) && (ref.replace(/^0+/, '') || '0') === vs;
  });
  if (matches.length !== 1) return { status: matches.length > 1 ? 'AMBIGUOUS_REVIEW' : 'UNMATCHED', paymentId: '' };
  var row = matches[0], id = String(row[0] || '').trim();
  if (!id) return { status: 'UNMATCHED', paymentId: '' };
  if (/^(VERIFIED|PAID|SETTLED|CANCELLED|CANCELED|REJECTED|VOID)$/i.test(String(row[7] || '').trim())) return { status: 'EXISTING_STATUS_REVIEW', paymentId: '' };
  var expected;
  try { expected = fioNgCents_(row[13] !== '' && row[13] != null ? row[13] : row[3]); }
  catch (_) { return { status: 'INVALID_EXPECTED', paymentId: '' }; }
  if (expected <= 0) return { status: 'INVALID_EXPECTED', paymentId: '' };
  if (tx.cents !== expected) return { status: tx.cents < expected ? 'PARTIAL_REVIEW' : 'OVERPAYMENT_REVIEW', paymentId: '' };
  return { status: 'CANDIDATE_ONLY', paymentId: id };
}

function fioNgSafeText_(raw) {
  var text = raw === null || raw === undefined ? '' : String(raw);
  // Prevent formula execution from external bank-provided messages/names.
  return /^[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
}

function fioNgBankRow_(tx, match, importedAt) {
  return [
    fioNgSafeText_(tx.id), tx.date, tx.cents / 100, tx.currency,
    fioNgSafeText_(tx.vs), fioNgSafeText_(tx.ss),
    fioNgSafeText_(tx.counterpartyAccount + (tx.counterpartyBank ? '/' + tx.counterpartyBank : '')),
    fioNgSafeText_(tx.counterpartyName), fioNgSafeText_(tx.message),
    fioNgSafeText_(tx.type), fioNgSafeText_(tx.payerReference),
    fioNgSafeText_(match.paymentId), match.status,
    '', '', importedAt, '', '', ''
  ];
}

function fioNgGetOrCreateSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(FIO_DRUZINA_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(FIO_DRUZINA_SHEET);
    sheet.getRange(1, 1, 1, FIO_DRUZINA_HEADERS.length)
      .setValues([FIO_DRUZINA_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var actual = sheet.getRange(1, 1, 1, FIO_DRUZINA_HEADERS.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(FIO_DRUZINA_HEADERS)) {
    throw new Error('Existing Fio worksheet columns differ; stop before writing');
  }
  return sheet;
}

function fioNgRequirePrivateSpreadsheet_(spreadsheetId) {
  // Highly sensitive: payer names and account numbers must not go into
  // an anonymously accessible or shared Community Hub.
  var file = DriveApp.getFileById(spreadsheetId);
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      file.getEditors().length > 0 || file.getViewers().length > 0) {
    throw new Error('Bank sync blocked: Community Hub is no longer owner-only');
  }
}

function fioSyncDruzinaReadOnly() {
  ocOwner_();
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('FIO_DRUZINA_READ_TOKEN') || '';
  var expectedAccount = props.getProperty('FIO_DRUZINA_EXPECTED_ACCOUNT_ID') || '';
  if (!/^[A-Za-z0-9]{64}$/.test(token) || !/^\d{6,20}$/.test(expectedAccount)) {
    throw new Error('Fio setup incomplete: owner must configure a read-only token and account ID');
  }
  var otherAccount = props.getProperty('FIO_OSVC_EXPECTED_ACCOUNT_ID') || '';
  var otherToken = props.getProperty('FIO_OSVC_READ_TOKEN') || '';
  if (expectedAccount === otherAccount || token === otherToken) throw new Error('OSVC and NGO banking profiles must be distinct');
  if (props.getProperty('FIO_DRUZINA_ENTITY_CONFIRMED') !== 'true') throw new Error('Owner must confirm Druzina account identity');
  var spreadsheetId = ocId_();
  if (typeof spreadsheetId !== 'string' || !spreadsheetId.trim()) throw new Error('Community Hub binding unavailable');
  fioNgRequirePrivateSpreadsheet_(spreadsheetId);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Fio sync already running');
  try {
    var now = new Date();
    var recentAttempt = Number(props.getProperty('FIO_DRUZINA_LAST_ATTEMPT_MS') || 0);
    if (now.getTime() - recentAttempt < 60000) {
      throw new Error('Fio requires a longer interval between polls');
    }
    var lastOk = props.getProperty('FIO_DRUZINA_LAST_OK_DATE') || '';
    var from = new Date(now.getTime() - 30 * 86400000);
    var endDate = Utilities.formatDate(now, FIO_DRUZINA_TIMEZONE, 'yyyy-MM-dd');
    if (lastOk) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(lastOk) || lastOk > endDate) throw new Error('Invalid last sync marker');
      var lastMillis = Date.parse(lastOk + 'T12:00:00Z');
      if (isNaN(lastMillis) || new Date(lastMillis).toISOString().slice(0, 10) !== lastOk) throw new Error('Invalid last sync marker');
      if ((now.getTime() - lastMillis) > 75 * 86400000) {
        throw new Error('Fio history gap: manual backfill review required');
      }
      from = new Date(lastMillis - 7 * 86400000);
    }
    var startDate = Utilities.formatDate(from, FIO_DRUZINA_TIMEZONE, 'yyyy-MM-dd');
    props.setProperty('FIO_DRUZINA_LAST_ATTEMPT_MS', String(now.getTime()));
    // The token is necessarily part of Fio's GET URL; NEVER log the URL,
    // response payload, or raw UrlFetchApp exceptions.
    var url = 'https://fioapi.fio.cz/v1/rest/periods/' + token + '/' +
      startDate + '/' + endDate + '/transactions.json';
    var response;
    try {
      response = UrlFetchApp.fetch(url, {
        method: 'get',
        followRedirects: false,
        muteHttpExceptions: true,
        headers: { Accept: 'application/json' }
      });
    } catch (_) {
      throw new Error('Fio transport error; token/URL details suppressed');
    }
    var status = response.getResponseCode();
    if (status !== 200) throw new Error('Fio API returned HTTP ' + status);
    var payload;
    try { payload = JSON.parse(response.getContentText()); }
    catch (_) { throw new Error('Fio returned invalid JSON'); }
    var statement = fioNgNormalizeStatement_(payload, expectedAccount);
    // Sharing or ownership can change while the external request is in flight.
    ocOwner_();
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var bank = fioNgGetOrCreateSheet_(ss);
    // Import only. Matching is performed separately by PaymentReconciliation; never mark orders paid here.
    var payRows = [];
    var ids = {};
    if (bank.getLastRow() > 1) {
      bank.getRange(2, 1, bank.getLastRow() - 1, 1).getValues()
        .forEach(function (row) { ids[String(row[0])] = true; });
    }
    var importedAt = Utilities.formatDate(now, FIO_DRUZINA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    var append = [];
    var candidates = 0;
    statement.transactions.forEach(function (tx) {
      if (ids[tx.id]) return;
      var candidate = fioNgMatchCandidate_(tx, payRows);
      if (candidate.status === 'CANDIDATE_ONLY') candidates++;
      append.push(fioNgBankRow_(tx, candidate, importedAt));
      ids[tx.id] = true;
    });
    if (append.length) {
      var firstRow = bank.getLastRow() + 1;
      var overflow = firstRow + append.length - 1 - bank.getMaxRows();
      if (overflow > 0) bank.insertRowsAfter(bank.getMaxRows(), overflow);
      bank.getRange(firstRow, 1, append.length, FIO_DRUZINA_HEADERS.length)
        .setValues(append);
    }
    SpreadsheetApp.flush();
    // Advance checkpoint ONLY after successful data write and validations.
    props.setProperties({
      FIO_DRUZINA_LAST_OK_DATE: endDate,
      FIO_DRUZINA_LAST_OK_AT: importedAt,
      FIO_DRUZINA_LAST_BANK_BALANCE: statement.balance === null
        ? '' : String(statement.balance)
    }, false);
    return {
      legalEntity: 'DRUZINA',
      imported: append.length,
      candidateOnly: candidates,
      bankTransactionsInWindow: statement.transactions.length,
      lastSuccess: importedAt,
      lastBankBalanceCZK: statement.balance,
      settledPayments: 0,
      paidOrdersMarked: 0
    };
  } finally {
    lock.releaseLock();
  }
}



