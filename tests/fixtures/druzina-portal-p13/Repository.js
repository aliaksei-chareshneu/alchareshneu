function ss_() {
  return SpreadsheetApp.openById(APP.SPREADSHEET_ID);
}

function sh_(name) {
  const sheet = ss_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function headers_(name) {
  const sheet = sh_(name);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

function rows_(name) {
  const sheet = sh_(name);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map((r, i) => {
    const o = {_row: i + 2};
    headers.forEach((h, j) => { if (h) o[h] = r[j]; });
    return o;
  });
}

function appendObj_(name, obj) {
  const sheet = sh_(name);
  const headers = headers_(name);
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function patchRow_(name, rowNumber, patch) {
  const sheet = sh_(name);
  const headers = headers_(name);
  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  const vals = range.getValues()[0];
  headers.forEach((h, i) => {
    if (Object.prototype.hasOwnProperty.call(patch, h)) vals[i] = patch[h];
  });
  range.setValues([vals]);
}

function findOne_(name, predicate) {
  const all = rows_(name);
  for (let i = 0; i < all.length; i++) if (predicate(all[i])) return all[i];
  return null;
}

function findAll_(name, predicate) {
  return rows_(name).filter(predicate);
}

function configMap_() {
  const map = {};
  rows_(SHEETS.CONFIG).forEach(r => {
    if (!r.Key) return;
    let v = r.Value;
    if (typeof v === 'string') {
      if (v.toUpperCase() === 'TRUE') v = true;
      else if (v.toUpperCase() === 'FALSE') v = false;
      else if (/^-?\d+(\.\d+)?$/.test(v.trim())) v = Number(v);
    }
    map[String(r.Key)] = v;
  });
  return map;
}

function productMap_() {
  const map = {};
  rows_(SHEETS.PRODUCTS).forEach(r => {
    if (!r.Product_ID) return;
    map[String(r.Product_ID)] = r;
  });
  return map;
}

function money_(x) {
  if (typeof x === 'number') return x;
  if (x === null || x === undefined || x === '') return 0;
  const m = String(x).replace(/\s/g, '').replace(/Kč/gi, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function id_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
}

function nowIso_() {
  return new Date().toISOString();
}

function audit_(actor, entityType, entityId, action, oldValue, newValue, notes) {
  appendObj_(SHEETS.AUDIT, {
    Audit_ID: id_('AUD'), Timestamp: nowIso_(), Actor: actor || 'system', Entity_Type: entityType,
    Entity_ID: entityId, Action: action, Old_Value: oldValue || '', New_Value: newValue || '',
    Policy_Version: policyVersion_(), Notes: notes || ''
  });
}

// Apps Script locks are shared within an execution; a nested helper must not
// release the lock acquired by its caller.
let druzinaScriptLockHeld_ = false;
function withLock_(fn) {
  if (druzinaScriptLockHeld_) return fn();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  druzinaScriptLockHeld_ = true;
  try { return fn(); } finally { druzinaScriptLockHeld_ = false; lock.releaseLock(); }
}
