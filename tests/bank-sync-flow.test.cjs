const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Complete adapter calls with synthetic Google/Fio services, never real accounts.
function fixture(prefix) {
  const state = {now: Date.parse('2026-10-21T08:00:00Z'), fetches: 0, amount: 120, balance: 0,
    authorized: [], opened: [], shared: false, locked: false, failWrite: false};
  class Clock extends Date {
    constructor(...args) {super(...(args.length ? args : [state.now]));}
    static now() {return state.now;}
  }
  const values = {
    FIO_OSVC_READ_TOKEN: 'a'.repeat(64), FIO_OSVC_EXPECTED_ACCOUNT_ID: '11111111',
    FIO_OSVC_ENTITY_CONFIRMED: 'true', FIO_DRUZINA_READ_TOKEN: 'b'.repeat(64),
    FIO_DRUZINA_EXPECTED_ACCOUNT_ID: '22222222', FIO_DRUZINA_ENTITY_CONFIRMED: 'true'
  };
  const props = {
    getProperty: key => values[key] ?? null,
    setProperty: (key, value) => {values[key] = value;},
    setProperties: entries => {Object.assign(values, entries);}
  };
  const sheet = {
    rows: [], capacity: 1,
    getLastRow() {return this.rows.length;},
    getMaxRows() {return this.capacity;},
    insertRowsAfter(_, count) {this.capacity += count;},
    getRange(row, column, height, width) {
      return {
        getValues: () => Array.from({length: height}, (_, r) =>
          Array.from({length: width}, (_, c) => sheet.rows[row + r - 1]?.[column + c - 1] ?? '')),
        setValues: data => {
          if (state.failWrite) throw Error('Fixture sheet write failed');
          for (let r = 0; r < data.length; r++) {
            sheet.rows[row + r - 1] ||= [];
            for (let c = 0; c < data[r].length; c++) sheet.rows[row + r - 1][column + c - 1] = data[r][c];
          }
        }
      };
    }
  };
  const targetSheet = prefix === 'FIO_OSVC' ? 'OSVC_Fio_Transactions' : 'Druzina_Fio_Transactions';
  const sandbox = {
    Date: Clock, RP: {SPREADSHEET_ID: 'console-hub'}, SPREADSHEET_ID: 'legacy-hub',
    Session: {getActiveUser: () => ({getEmail: () => 'owner@example.test'})},
    DriveApp: {
      Access: {PRIVATE: 'PRIVATE'},
      getFileById: id => {
        state.authorized.push(id);
        return {getOwner: () => ({getEmail: () => 'owner@example.test'}),
          getSharingAccess: () => state.shared ? 'PUBLIC' : 'PRIVATE',
          getEditors: () => [], getViewers: () => []};
      }
    },
    PropertiesService: {getScriptProperties: () => props},
    SpreadsheetApp: {
      openById: id => {
        state.opened.push(id);
        return {getSheetByName: name => {
          assert.equal(name, targetSheet, 'Only this entity bank worksheet may be used');
          return sheet;
        }};
      },
      flush: () => {}
    },
    LockService: {getScriptLock: () => ({
      tryLock: () => {if (state.locked) return false; state.locked = true; return true;},
      releaseLock: () => {state.locked = false;}
    })},
    Utilities: {formatDate: (date, timeZone, pattern) => pattern === 'yyyy-MM-dd'
      ? new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(date)
      : date.toISOString()},
    UrlFetchApp: {fetch: (_, options) => {
      state.fetches++;
      assert.equal(options.method, 'get');
      if (state.shareDuringFetch) state.shared = true;
      return {getResponseCode: () => 200, getContentText: () => JSON.stringify({
        accountStatement: {
          info: {bankId: '2010', accountId: values[prefix + '_EXPECTED_ACCOUNT_ID'], currency: 'CZK', closingBalance: state.balance},
          transactionList: {transaction: [{
            column22: {value: '9007199254740993'}, column0: {value: '2026-10-21'},
            column1: {value: state.amount}, column14: {value: 'CZK'}, column5: {value: '123'},
            column16: {value: '=fixture()'}
          }]}
        }
      })};
    }}
  };
  vm.createContext(sandbox);
  for (const file of ['OperatorConsoleServer.gs', 'FioOSVC.gs', 'FioDruzinaConsole.gs']) {
    vm.runInContext(fs.readFileSync(__dirname + '/../' + file, 'utf8'), sandbox);
  }
  sheet.rows = [Array.from(prefix === 'FIO_OSVC' ? sandbox.FIO_OSVC_HEADERS : sandbox.FIO_DRUZINA_HEADERS)];
  const sync = prefix === 'FIO_OSVC' ? sandbox.fioSyncOSVCReadOnly : sandbox.fioSyncDruzinaReadOnly;
  return {state, values, sheet, sandbox, sync};
}

for (const prefix of ['FIO_OSVC', 'FIO_DRUZINA']) {
  test(prefix + ': import and replay use the console-authorized Hub without duplicates', () => {
    const f = fixture(prefix);
    const first = f.sync();
    assert.equal(first.imported, 1);
    assert.equal(first.paidOrdersMarked, 0);
    assert.equal(first.lastBankBalanceCZK, 0);
    assert.ok(f.state.authorized.every(id => id === 'console-hub'));
    assert.deepEqual(f.state.opened, ['console-hub']);
    assert.equal(f.sheet.rows[1][0], '9007199254740993');
    assert.equal(f.sheet.rows[1][8], "'=fixture()");
    assert.equal(f.sheet.rows[1][12], 'UNMATCHED');
    assert.throws(() => f.sync(), /interval/);
    assert.equal(f.state.fetches, 1);
    assert.equal(f.state.locked, false);
    f.state.now += 61000;
    assert.equal(f.sync().imported, 0);
    assert.equal(f.sheet.rows.length, 2);
    assert.equal(f.state.fetches, 2);
    assert.equal(f.state.locked, false);
  });

  test(prefix + ': RP-only Hub binding works without a legacy global', () => {
    const f = fixture(prefix);
    delete f.sandbox.SPREADSHEET_ID;
    assert.equal(f.sync().imported, 1);
    assert.deepEqual(f.state.opened, ['console-hub']);
  });

  test(prefix + ': failed append leaves checkpoint unchanged and retry imports once', () => {
    const f = fixture(prefix);
    f.state.failWrite = true;
    assert.throws(() => f.sync(), /write failed/);
    assert.equal(f.values[prefix + '_LAST_OK_AT'], undefined);
    assert.equal(f.state.locked, false);
    assert.equal(f.sheet.rows.length, 1);
    f.state.failWrite = false;
    f.state.now += 61000;
    assert.equal(f.sync().imported, 1);
    assert.equal(f.sheet.rows.length, 2);
  });

  test(prefix + ': sharing changed during fetch blocks import before any bank rows are written', () => {
    const f = fixture(prefix);
    f.state.shareDuringFetch = true;
    assert.throws(() => f.sync(), /owner-only|Owner-only/);
    assert.equal(f.sheet.rows.length, 1);
    assert.equal(f.values[prefix + '_LAST_OK_AT'], undefined);
    assert.equal(f.state.locked, false);
  });

  test(prefix + ': future or impossible checkpoint fails before calling Fio', () => {
    for (const marker of ['2030-01-01', '2026-02-31']) {
      const f = fixture(prefix);
      f.values[prefix + '_LAST_OK_DATE'] = marker;
      assert.throws(() => f.sync(), /marker|history gap/);
      assert.equal(f.state.fetches, 0);
      assert.equal(f.state.locked, false);
    }
  });

  test(prefix + ': malformed transaction amounts and balances never import or advance the checkpoint', () => {
    const invalid = ['0x78', '1.2e2', '120.000', 120.00000001, 0.001, [], [120], true, {}, '90071992547409.91'];
    for (const field of ['amount', 'balance']) for (const value of invalid) {
      const f = fixture(prefix);
      f.state[field] = value;
      assert.throws(() => f.sync(), /amount|balance/i, field + ': ' + JSON.stringify(value));
      assert.equal(f.sheet.rows.length, 1);
      assert.equal(f.values[prefix + '_LAST_OK_AT'], undefined);
      assert.equal(f.state.locked, false);
    }
  });

  test(prefix + ': exact decimal amounts and unknown balances preserve the import contract', () => {
    const parser = prefix === 'FIO_OSVC' ? 'fioOsCents_' : 'fioNgCents_';
    const f = fixture(prefix);
    for (const [value, cents] of [[0, 0], [1.15, 115], [-12.34, -1234], [' +00120,50 ', 12050], ['-0,01', -1]]) {
      assert.equal(f.sandbox[parser](value), cents);
    }
    f.state.amount = '120,50';
    f.state.balance = null;
    assert.equal(f.sync().lastBankBalanceCZK, null);
    assert.equal(f.sheet.rows[1][2], 120.5);
    assert.equal(f.values[prefix + '_LAST_BANK_BALANCE'], '');
  });
}
