/**
 * Fio -> OSVČ: READ-ONLY banking adapter for existing Community Hub.
 * STAGED, not installed or enabled in production.
 * No tokens, customer data, bank account numbers or payments in source control.
 * Official Fio API v1.9 (2025-10-16): https://www.fio.cz/docs/cz/API_Bankovnictvi.pdf
 *
 * Requires the existing Code.gs global SPREADSHEET_ID. Intended for the
 * privately owned Community Hub; not for any public web app response.
 * Install via the CURRENT bound Apps Script project only after code review.
 */

var FIO_OSVC_SHEET = 'OSVC_Fio_Transactions';
var FIO_OSVC_TIMEZONE = 'Europe/Prague';
var FIO_OSVC_HEADERS = [
  'Bank_Transaction_ID', 'Bank_Date', 'Amount_CZK', 'Currency',
  'VS', 'SS', 'Counterparty_Account', 'Counterparty_Name',
  'Message', 'Bank_Operation_Type', 'Bank_Payer_Reference',
  'Candidate_Payment_ID', 'Match_Status', 'Classification',
  'Restriction_Evidence_URL', 'Imported_At', 'Reviewed_By',
  'Reviewed_At', 'Review_Notes'
];

function fioOsCell_(entry, column) {
  var cell = entry && entry[column];
  return cell && cell.value !== undefined && cell.value !== null ? cell.value : '';
}

function fioOsCents_(raw) {
  if (raw === null || raw === undefined || !String(raw).trim()) throw new Error('Missing bank amount');
  var value = Number(String(raw).replace(',', '.'));
  if (!isFinite(value)) throw new Error('Invalid bank amount');
  var cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.00001) {
    throw new Error('Unsupported sub-cent bank amount');
  }
  return cents;
}

function fioOsDate_(raw) {
  if (typeof raw === 'number' && isFinite(raw)) {
    return Utilities.formatDate(new Date(raw), FIO_OSVC_TIMEZONE, 'yyyy-MM-dd');
  }
  var date = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.substring(0, 10);
  throw new Error('Invalid Fio transaction date');
}

function fioOsNormalizeTransaction_(entry) {
  var id = String(fioOsCell_(entry, 'column22')).trim();
  if (!/^\d{1,20}$/.test(id)) throw new Error('Missing or invalid bank transaction ID');
  var cents = fioOsCents_(fioOsCell_(entry, 'column1'));
  var currency = String(fioOsCell_(entry, 'column14')).trim();
  if (currency !== 'CZK') throw new Error('Unexpected bank transaction currency');
  return {
    id: id,
    date: fioOsDate_(fioOsCell_(entry, 'column0')),
    cents: cents,
    currency: currency,
    vs: String(fioOsCell_(entry, 'column5')).trim(),
    ss: String(fioOsCell_(entry, 'column6')).trim(),
    counterpartyAccount: String(fioOsCell_(entry, 'column2')).trim(),
    counterpartyBank: String(fioOsCell_(entry, 'column3')).trim(),
    counterpartyName: String(fioOsCell_(entry, 'column10')).trim(),
    message: String(fioOsCell_(entry, 'column16')).trim(),
    type: String(fioOsCell_(entry, 'column8')).trim(),
    payerReference: String(fioOsCell_(entry, 'column27')).trim()
  };
}

function fioOsNormalizeStatement_(response, expectedAccount) {
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
  var rows = raw.map(fioOsNormalizeTransaction_);
  var seen = {};
  rows.forEach(function (tx) {
    if (seen[tx.id]) throw new Error('Duplicate transaction ID in Fio response');
    seen[tx.id] = true;
  });
  var balance = info.closingBalance === null || info.closingBalance === undefined || String(info.closingBalance).trim() === ''
    ? null : Number(info.closingBalance);
  if (balance !== null && !isFinite(balance)) {
    throw new Error('Invalid bank closing balance');
  }
  return { transactions: rows, balance: balance };
}

/** Match a candidate by exact amount + numeric VS; does NOT verify/settle payment. */
function fioOsMatchCandidate_(tx, paymentRows) {
  if (tx.cents <= 0) return { status: 'DEBIT_REVIEW', paymentId: '' };
  if (!/^\d+$/.test(tx.vs)) return { status: 'UNMATCHED', paymentId: '' };
  var vs = tx.vs.replace(/^0+/, '') || '0';
  var matches = paymentRows.filter(function (row) {
    var status = String(row[7] || '').toUpperCase();
    if (/CANCEL|REJECT|VOID/.test(status)) return false;
    var ref = String(row[9] || '').trim();
    if (!/^\d+$/.test(ref)) return false;
    if ((ref.replace(/^0+/, '') || '0') !== vs) return false;
    var expected = row[13] !== '' && row[13] != null ? row[13] : row[3];
    try { return fioOsCents_(expected) === tx.cents; }
    catch (_) { return false; }
  });
  if (matches.length === 1 && String(matches[0][0] || '').trim()) {
    return { status: 'CANDIDATE_ONLY', paymentId: String(matches[0][0]) };
  }
  return { status: matches.length > 1 ? 'AMBIGUOUS_REVIEW' : 'UNMATCHED', paymentId: '' };
}

function fioOsSafeText_(raw) {
  var text = raw === null || raw === undefined ? '' : String(raw);
  // Prevent formula execution from external bank-provided messages/names.
  return /^[=+\-@\t\r\n]/.test(text) ? "'" + text : text;
}

function fioOsBankRow_(tx, match, importedAt) {
  return [
    fioOsSafeText_(tx.id), tx.date, tx.cents / 100, tx.currency,
    fioOsSafeText_(tx.vs), fioOsSafeText_(tx.ss),
    fioOsSafeText_(tx.counterpartyAccount + (tx.counterpartyBank ? '/' + tx.counterpartyBank : '')),
    fioOsSafeText_(tx.counterpartyName), fioOsSafeText_(tx.message),
    fioOsSafeText_(tx.type), fioOsSafeText_(tx.payerReference),
    fioOsSafeText_(match.paymentId), match.status,
    '', '', importedAt, '', '', ''
  ];
}

function fioOsGetOrCreateSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(FIO_OSVC_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(FIO_OSVC_SHEET);
    sheet.getRange(1, 1, 1, FIO_OSVC_HEADERS.length)
      .setValues([FIO_OSVC_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var actual = sheet.getRange(1, 1, 1, FIO_OSVC_HEADERS.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(FIO_OSVC_HEADERS)) {
    throw new Error('Existing Fio worksheet columns differ; stop before writing');
  }
  return sheet;
}

function fioOsRequirePrivateSpreadsheet_() {
  // Highly sensitive: payer names and account numbers must not go into
  // an anonymously accessible or shared Community Hub.
  var file = DriveApp.getFileById(SPREADSHEET_ID);
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      file.getEditors().length > 0 || file.getViewers().length > 0) {
    throw new Error('Bank sync blocked: Community Hub is no longer owner-only');
  }
}

function fioSyncOSVCReadOnly() {
  ocOwner_();
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('FIO_OSVC_READ_TOKEN') || '';
  var expectedAccount = props.getProperty('FIO_OSVC_EXPECTED_ACCOUNT_ID') || '';
  if (!/^[A-Za-z0-9]{64}$/.test(token) || !/^\d{6,20}$/.test(expectedAccount)) {
    throw new Error('Fio setup incomplete: owner must configure a read-only token and account ID');
  }
  if (typeof SPREADSHEET_ID !== 'string' || !SPREADSHEET_ID) {
    throw new Error('Community Hub binding unavailable');
  }
  var ngoAccount = props.getProperty('FIO_DRUZINA_EXPECTED_ACCOUNT_ID') || '';
  var ngoToken = props.getProperty('FIO_DRUZINA_READ_TOKEN') || '';
  if (expectedAccount === ngoAccount || token === ngoToken) throw new Error('OSVC and NGO banking profiles must be distinct');
  if (props.getProperty('FIO_OSVC_ENTITY_CONFIRMED') !== 'true') throw new Error('Owner must confirm OSVC account identity');
  fioOsRequirePrivateSpreadsheet_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Fio sync already running');
  try {
    var now = new Date();
    var recentAttempt = Number(props.getProperty('FIO_OSVC_LAST_ATTEMPT_MS') || 0);
    if (now.getTime() - recentAttempt < 60000) {
      throw new Error('Fio requires a longer interval between polls');
    }
    var lastOk = props.getProperty('FIO_OSVC_LAST_OK_DATE') || '';
    var from = new Date(now.getTime() - 30 * 86400000);
    if (lastOk) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(lastOk)) throw new Error('Invalid last sync marker');
      var lastMillis = Date.parse(lastOk + 'T12:00:00Z');
      if (isNaN(lastMillis) || (now.getTime() - lastMillis) > 75 * 86400000) {
        throw new Error('Fio history gap: manual backfill review required');
      }
      from = new Date(lastMillis - 7 * 86400000);
    }
    var startDate = Utilities.formatDate(from, FIO_OSVC_TIMEZONE, 'yyyy-MM-dd');
    var endDate = Utilities.formatDate(now, FIO_OSVC_TIMEZONE, 'yyyy-MM-dd');
    props.setProperty('FIO_OSVC_LAST_ATTEMPT_MS', String(now.getTime()));
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
    var statement = fioOsNormalizeStatement_(payload, expectedAccount);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var bank = fioOsGetOrCreateSheet_(ss);
    // OSVC order schema is not guessed: bank transactions remain unmatched.
    var payRows = [];
    var ids = {};
    if (bank.getLastRow() > 1) {
      bank.getRange(2, 1, bank.getLastRow() - 1, 1).getValues()
        .forEach(function (row) { ids[String(row[0])] = true; });
    }
    var importedAt = Utilities.formatDate(now, FIO_OSVC_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    var append = [];
    var candidates = 0;
    statement.transactions.forEach(function (tx) {
      if (ids[tx.id]) return;
      var candidate = fioOsMatchCandidate_(tx, payRows);
      if (candidate.status === 'CANDIDATE_ONLY') candidates++;
      append.push(fioOsBankRow_(tx, candidate, importedAt));
      ids[tx.id] = true;
    });
    if (append.length) {
      var firstRow = bank.getLastRow() + 1;
      var overflow = firstRow + append.length - 1 - bank.getMaxRows();
      if (overflow > 0) bank.insertRowsAfter(bank.getMaxRows(), overflow);
      bank.getRange(firstRow, 1, append.length, FIO_OSVC_HEADERS.length)
        .setValues(append);
    }
    SpreadsheetApp.flush();
    // Advance checkpoint ONLY after successful data write and validations.
    props.setProperties({
      FIO_OSVC_LAST_OK_DATE: endDate,
      FIO_OSVC_LAST_OK_AT: importedAt,
      FIO_OSVC_LAST_BANK_BALANCE: statement.balance === null
        ? '' : String(statement.balance)
    }, false);
    return {
      legalEntity: 'OSVC',
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



