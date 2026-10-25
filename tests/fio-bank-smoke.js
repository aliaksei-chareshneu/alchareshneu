/**
 * Self-contained synthetic smoke tests for FioBank.gs. No real bank or customer data.
 * Run locally: node tests/fio-bank-smoke.js
 * The script under test must not call the live bank from this suite.
 */
function runFioBankSmokeTests_(fio) {
  var passed = 0;
  var failed = [];
  function check(name, fn) {
    try { fn(); passed++; }
    catch (error) { failed.push(name + ': ' + String(error.message || error)); }
  }
  function assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed'); }
  function mustReject(fn) {
    var rejected = false;
    try { fn(); } catch (_) { rejected = true; }
    assert(rejected, 'Expected fail-closed rejection');
  }
  function cell(value) { return { value: value }; }
  var tx = {
    column22: cell(1148734530), column0: cell(1340661600000),
    column1: cell(950.50), column14: cell('CZK'),
    column5: cell('000123'), column10: cell('Donor'),
    column16: cell('=HYPERLINK("http://example.invalid","x")')
  };
  var account = { bankId: '2010', accountId: '111222333', currency: 'CZK', closingBalance: 950.5 };
  var payload = {
    accountStatement: {
      info: account,
      transactionList: { transaction: [tx] }
    }
  };
  var bankTx = fio.fioNormalizeTransaction_(tx);
  var payment = Array(20).fill('');
  payment[0] = 'PAY-1';
  payment[3] = 950.50;
  payment[9] = '123';
  payment[13] = 950.50;
  check('Fio JSON ID and amount', function () {
    assert(bankTx.id === '1148734530' && bankTx.cents === 95050);
  });
  check('Fio account identity validation', function () {
    assert(fio.fioNormalizeStatement_(payload, account.accountId).transactions.length === 1);
  });
  check('Wrong account is refused', function () {
    mustReject(function () { fio.fioNormalizeStatement_(payload, '999'); });
  });
  check('Wrong currency is refused', function () {
    mustReject(function () { fio.fioNormalizeStatement_({
      accountStatement: { info: account, transactionList: {
        transaction: [{ ...tx, column14: cell('EUR') }]
      } }
    }, account.accountId); });
  });
  check('Missing unique ID is refused', function () {
    mustReject(function () { fio.fioNormalizeTransaction_({ ...tx, column22: null }); });
  });
  check('Duplicate IDs within response are refused', function () {
    mustReject(function () {
      fio.fioNormalizeStatement_({ accountStatement: {
        info: account, transactionList: { transaction: [tx, tx] }
      } }, account.accountId);
    });
  });
  check('Empty transaction list is legal', function () {
    assert(fio.fioNormalizeStatement_({ accountStatement: {
      info: account, transactionList: { transaction: null }
    } }, account.accountId).transactions.length === 0);
  });
  check('Absent transaction list is refused', function () {
    mustReject(function () {
      fio.fioNormalizeStatement_({ accountStatement: { info: account } }, account.accountId);
    });
  });
  check('Bad bank closing balance is refused', function () {
    mustReject(function () {
      fio.fioNormalizeStatement_({ accountStatement: {
        info: { ...account, closingBalance: 'not-a-number' },
        transactionList: { transaction: [] }
      } }, account.accountId);
    });
  });
  check('Exact amount and VS give candidate, not a paid receipt', function () {
    var result = fio.fioMatchCandidate_(bankTx, [payment]);
    assert(result.status === 'CANDIDATE_ONLY' && result.paymentId === 'PAY-1');
  });
  check('Ambiguous identical candidates are refused', function () {
    var result = fio.fioMatchCandidate_(bankTx, [payment, ['PAY-2'].concat(payment.slice(1))]);
    assert(result.status === 'AMBIGUOUS_REVIEW' && result.paymentId === '');
  });
  check('Wrong amount never matches', function () {
    var wrong = payment.slice();
    wrong[13] = 999.00;
    assert(fio.fioMatchCandidate_(bankTx, [wrong]).status === 'UNMATCHED');
  });
  check('Non-numeric VS never matches', function () {
    assert(fio.fioMatchCandidate_({ ...bankTx, vs: 'AB123' }, [payment]).status === 'UNMATCHED');
  });
  check('Outgoing amount is review-only', function () {
    assert(fio.fioMatchCandidate_({ ...bankTx, cents: -10000 }, [payment]).status === 'DEBIT_REVIEW');
  });
  check('External messages are never formulas', function () {
    var row = fio.fioBankRow_(bankTx, { status: 'UNMATCHED', paymentId: '' }, '2026-10-16');
    assert(row[8][0] === "'" && row[8].slice(1).indexOf('=HYPERLINK') === 0);
  });
  check('Fractional cents are refused', function () {
    mustReject(function () { fio.fioCents_('0.001'); });
  });
  check('Cancelled payment proof cannot be matched', function () {
    var cancelled = payment.slice();
    cancelled[7] = 'CANCELLED';
    assert(fio.fioMatchCandidate_(bankTx, [cancelled]).status === 'UNMATCHED');
  });
  return { passed: passed, total: passed + failed.length, failed: failed };
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' &&
    require.main === module) {
  var fs = require('node:fs');
  var vm = require('node:vm');
  var path = require('node:path');
  var context = {
    Utilities: { formatDate: function (date) {
      return new Date(date).toISOString().substring(0, 10);
    } },
    console: console
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '..', 'FioBank.gs'), 'utf8'), context);
  var report = runFioBankSmokeTests_(context);
  console.log(JSON.stringify(report, null, 2));
  if (report.failed.length) process.exitCode = 1;
}
