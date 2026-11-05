'use strict';

// Executes the production .gs files. Only Google services and the clock are faked.
// These simulations do not authorize Google, validate permissions, or replace live smoke tests.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const HEADERS = {
  Druzina_Config: 'Key Value Notes',
  Druzina_Members: 'Member_ID Full_Name Email Phone Telegram_Handle Tier Rank Active Joined_At Attendance_30d Attendance_Total Battles Preferred_Days Current_Plan_ID Plan_End Notes Account_Status Outstanding_CZK Hold_Reason Manage_Token Tier_Eligibility_Source',
  Druzina_Plans: 'Plan_ID Member_ID Product_Code Start_Date End_Date Recurring_Days Payment_ID Status Auto_Renew Sessions_Scheduled Sessions_Used Sessions_NoShow Next_Renewal Created_At Notes Policy_Version Package_Sessions Validity_Days First_Eligible_Session Purchase_Cutoff_Status Price_Snapshot_CZK',
  Druzina_Sessions: 'Session_ID Start_DateTime End_DateTime Weekday Theme Capacity Booking_Deadline Status Calendar_Event_ID Location Booked_Count Attended_Count Created_At Notes Late_Booking_Closes Booking_Window Rules_Version Emergency_Booking_Closes',
  Druzina_Bookings: 'Booking_ID Session_ID Member_ID Plan_ID Payment_ID Booking_Type Status Booked_At Reschedule_Deadline Rescheduled_From Attendance_Checked Attendance_Status Equipment_Note Proof_Required Notes Policy_Version Base_Price_CZK Applied_Price_CZK Cutoff_Class Price_Reason Rule_Snapshot',
  Druzina_Payments: 'Payment_ID Member_ID Product_Code Amount_CZK Declared_At Proof_File_URL Proof_Filename Verification_Status Verified_At Payment_Reference Source_Request_ID Method Notes Expected_Amount_CZK Received_Amount_CZK Outstanding_CZK Cutoff_Class Policy_Version Reconciled_At Reconciliation_Note',
  Druzina_Requests: 'Request_ID Member_ID Status Notes',
  Druzina_Ledger: 'Ledger_ID Member_ID Member_Name Created_At Entry_Type Source_Type Source_ID Description Amount_CZK Due_At Status Blocks_Booking Payment_ID Resolved_At Notes',
  Druzina_Payment_Items: 'Payment_Item_ID Payment_ID Product_Code Description Qty Unit_Amount_CZK Line_Total_CZK Related_Session_ID Related_Plan_ID Status Notes',
  Druzina_Holds: 'Hold_ID Session_ID Member_ID Request_ID Product_Code Created_At Expires_At Status Qty Notes',
  Druzina_Notifications: 'Notification_ID Member_ID Type Channel Scheduled_At Status Related_ID Sent_At Message_Key Notes',
  Druzina_Audit_Log: 'Audit_ID Timestamp Actor Entity_Type Entity_ID Action Old_Value New_Value Policy_Version Notes',
  Druzina_Quotes: 'Quote_ID Member_ID Created_At Expires_At Status Cart_JSON Expected_Amount_CZK Payment_Reference Policy_Version Notes',
  Products: 'Product_ID Offer Price_CZK Payment_URL Active',
};

class Sheet {
  constructor(name, headers = []) { this.name = name; this.data = headers.length ? [headers] : []; this.maxColumns = headers.length || 26; }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); }
  getMaxColumns() { return this.maxColumns; }
  getMaxRows() { return Math.max(1000,this.data.length); }
  insertRowsAfter() { return this; }
  insertColumnsAfter(column, howMany = 1) { this.maxColumns += howMany; this.data.forEach(row => row.splice(column, 0, ...Array(howMany).fill(''))); return this; }
  appendRow(row) { this.data.push([...row]); return this; }
  setFrozenRows() { return this; }
  getRange(row, col, height = 1, width = 1) {
    if(col+width-1>this.maxColumns) throw new Error('Range exceeds sheet grid');
    const self = this;
    const range = {
      getValues() { return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => self.data[row - 1 + i]?.[col - 1 + j] ?? '')); },
      setValues(values) { values.forEach((r, i) => r.forEach((value, j) => { self.data[row - 1 + i] ||= []; self.data[row - 1 + i][col - 1 + j] = value; })); return range; },
      setValue(value) { return range.setValues([[value]]); },
      getValue() { return range.getValues()[0][0]; },
      setFontWeight() { return range; },setNumberFormat() { return range; },
      clearContent() { return range.setValues(Array.from({ length: height }, () => Array(width).fill(''))); },
    };
    return range;
  }
}

function formatDate(date, timezone, format) {
  const opts = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', opts).formatToParts(date).map(x => [x.type, x.value]));
  if (format === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (format === 'MMdd') return `${p.month}${p.day}`;
  if (format === 'u') return String(new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay() || 7);
  if (format === 'Z') {
    const localAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const offsetMinutes = Math.round((localAsUtc - date.getTime()) / 60000);
    return `${offsetMinutes < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')}${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
  }
  if (format === "yyyy-MM-dd'T'HH:mm:ss") return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  if (format === "yyyy-MM-dd'T'HH:mm:ssXXX") {const offset=formatDate(date,timezone,'Z');return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset.slice(0,3)}:${offset.slice(3)}`;}
  throw new Error(`Unimplemented date format: ${format}`);
}

function harness(options = {}) {
  let clock = new Date(options.now || '2026-11-02T12:00:00Z').getTime();
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const sheets = new Map(Object.entries(HEADERS).map(([name, headers]) => [name, new Sheet(name, headers.split(' '))]));
  const prezenckySheet = new Sheet('Prezenční evidence', ['Datum','Název akce / tréninku','Místo','Odpovědná osoba','Typ aktivity','Jméno a příjmení účastníka','Člen / nečlen','Podpis / potvrzení účasti','Bezpečnostní poučení','Incident / úraz','Poznámka / odkaz na event']);
  prezenckySheet.maxColumns = 26; // Confirmed live ledger grid has A:Z even though headers end at K.
  const prezenckySpreadsheet = { getSheetByName(name) { return name === 'Prezenční evidence' ? prezenckySheet : null; } };
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; },
    getSheets() { return [...sheets.values()]; },
  };
  const files = [], calendarEvents = [], triggers = [], emails = [], properties = { ADMIN_TOKEN: 'test-admin-secret' };
  const cacheEntries = new Map();
  const scriptCache = {
    get(key) { const hit=cacheEntries.get(key); if(!hit) return null; if(hit.expiresAt<=clock){cacheEntries.delete(key);return null;} return hit.value; },
    put(key,value,seconds){cacheEntries.set(key,{value:String(value),expiresAt:clock+Number(seconds)*1000});},
    remove(key){cacheEntries.delete(key);}
  };
  if (options.uninstalled) delete properties.ADMIN_TOKEN;
  const calls = { spreadsheetIds: [], folderIds: [], calendarIds: [], lockAcquisitions: 0, lockDepth: 0, calendarWritesUnderLock: [] };
  const propertyStore = {
    getProperty: key => properties[key] ?? null,
    setProperty(key, value) { properties[key] = String(value); return propertyStore; },
    deleteProperty(key) { delete properties[key]; return propertyStore; },
    setProperties(values) { Object.assign(properties,values); return propertyStore; },
    getProperties: () => ({ ...properties }),
  };
  const calendar = {
    getEvents(start, end) { return calendarEvents.filter(e => e.start < end && e.end > start); },
    getEventById(id) { return calendarEvents.find(e => e.getId() === id) || null; },
    createEvent(title, start, end, eventOptions) {
      calls.calendarWritesUnderLock.push(calls.lockDepth > 0);
      const event = { title, start: new Date(start), end: new Date(end), options: eventOptions, tags: {}, id: `calendar-${calendarEvents.length + 1}`, getId() { return this.id; }, getTitle() { return this.title; }, getStartTime() { return this.start; }, getEndTime() { return this.end; }, getTag(key) { return this.tags[key] || ''; }, setTag(key, value) { this.tags[key] = value; return this; }, setTitle(t) { this.title = t; return this; }, setDescription(d) { this.options.description = d; return this; } };
      calendarEvents.push(event); return event;
    },
  };
  const context = vm.createContext({
    Date: FakeDate, console, JSON, Math, Object, Array, String, Number, Boolean, Set, Map, RegExp, Error, isFinite, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    SpreadsheetApp: { openById(id) { calls.spreadsheetIds.push(id); return id === 'SYNTHETIC_PREZENCKY_SPREADSHEET_ID' ? prezenckySpreadsheet : spreadsheet; }, flush() {} },
    Utilities: {
      getUuid: () => crypto.randomUUID(), formatDate,
      base64Decode: value => [...Buffer.from(value, 'base64')],
      newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(value).digest()],
      computeHmacSha256Signature: (value,key) => [...crypto.createHmac('sha256',key).update(value).digest()],
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    },
    CacheService: { getScriptCache(){ return scriptCache; } },
    LockService: { getScriptLock() { return { tryLock(){calls.lockAcquisitions++;calls.lockDepth++;return true;},waitLock() { calls.lockAcquisitions++; calls.lockDepth++; }, releaseLock() { calls.lockDepth = Math.max(0, calls.lockDepth - 1); }, hasLock: () => calls.lockDepth > 0 }; } },
    DriveApp: { getFolderById(id) { calls.folderIds.push(id); return { createFile(blob) { const fileId = `test-receipt-${files.length + 1}`; const file = { blob, trashed: false, getId: () => fileId, getUrl: () => `https://drive.google.com/file/d/${fileId}/view`, getName: () => blob.name, setTrashed(value) { this.trashed = value; return this; } }; files.push(file); return file; } }; }, getFileById(id) { const file = files.find(f => f.getId() === id); if (!file) throw new Error('File not found'); return file; } },
    MailApp: { sendEmail(message) { emails.push(message); } },
    CalendarApp: { getCalendarById(id) { calls.calendarIds.push(id); return calendar; } },
    PropertiesService: { getScriptProperties: () => propertyStore, getUserProperties: () => propertyStore },
    Session: { getActiveUser: () => ({ getEmail: () => options.activeEmail || '' }), getEffectiveUser: () => ({ getEmail: () => 'owner@example.test' }) },
    ScriptApp: {
      getProjectTriggers: () => [...triggers], deleteTrigger(t) { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger(handler) { const builder = { timeBased() { return builder; }, everyMinutes() { return builder; },everyHours() { return builder; }, everyDays() { return builder; }, atHour() { return builder; }, create() { const trigger = { getHandlerFunction: () => handler }; triggers.push(trigger); return trigger; } }; return builder; },
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/test-deployment/exec' }),
    },
  });
  const projectRoot = options.sourceDir||path.resolve(__dirname,'../fixtures/druzina-portal-p13');
  for (const filename of fs.readdirSync(projectRoot).filter(x => x.endsWith('.js')).sort()){
    let source=fs.readFileSync(path.join(projectRoot, filename), 'utf8');
    if(options.futureReleaseSimulation===true&&filename==='DruzinaFioReadiness.js')
      source=source.replace('const DRUS_PAID_BANK_ADAPTER_LIVE = false;','const DRUS_PAID_BANK_ADAPTER_LIVE = true;');
    vm.runInContext(source,context,{filename});
  }
  for(const filename of (options.sourceDir?[]:['DruzinaBillingPolicy.gs','DruzinaFioReadiness.gs','DruzinaSafetyRelease.gs',
    'DruzinaSeniorEvidence.gs','DruzinaFioBridge.gs','DruzinaFioCommit.gs','DruzinaFioProofReconcile.gs','DruzinaMemberAccount.gs','DruzinaPortalApi.gs','DruzinaNotifications.gs','DruzinaBankReceipt.gs','DruzinaBankWorker.gs'])){
    let source=fs.readFileSync(path.resolve(__dirname,'../..',filename),'utf8');
    if(options.futureReleaseSimulation===true && filename==='DruzinaFioReadiness.gs')
      source=source.replace('const DRUS_PAID_BANK_ADAPTER_LIVE = false;','const DRUS_PAID_BANK_ADAPTER_LIVE = true;');
    vm.runInContext(source,context,{filename});
  }
  const api = {
    context, sheets, prezenckySheet, files, calendarEvents, calendar, properties, calls, triggers, emails, scriptCache,
    now: () => new Date(clock), setTime: value => { clock = new Date(value).getTime(); }, advance: milliseconds => { clock += milliseconds; },
    run: (source) => vm.runInContext(source, context),
    call(name, ...args) { if (typeof context[name] !== 'function') throw new Error(`Function unavailable: ${name}`); return context[name](...args); },
    rows(name) { return context.rows_(name.startsWith('Druzina_') || name === 'Products' ? name : `Druzina_${name}`); },
    add(name, values) { return context.appendObj_(name.startsWith('Druzina_') || name === 'Products' ? name : `Druzina_${name}`, values); },
    patch(name, row, values) { return context.patchRow_(name.startsWith('Druzina_') || name === 'Products' ? name : `Druzina_${name}`, row, values); },
    config(key, value) { const row = api.rows('Config').find(r => r.Key === key); if (row) api.patch('Config', row._row, { Value: value }); else api.add('Config', { Key: key, Value: value }); },
    member(overrides = {}) { const payload = { name: 'Test Member', email: `member-${crypto.randomUUID()}@example.test`, phone: '', ...overrides }; const member = context.ensureMember_(payload); const rowPatch = Object.fromEntries(Object.entries(overrides).filter(([key]) => HEADERS.Druzina_Members.split(' ').includes(key))); if (Object.keys(rowPatch).length) { api.patch('Members', member._row, rowPatch); Object.assign(member, rowPatch); } return { payload, member }; },
    session(hoursAway = 72, overrides = {}) { const start = new Date(clock + hoursAway * 3600000); const id = overrides.Session_ID || `TEST-${crypto.randomUUID()}`; api.add('Sessions', { Session_ID: id, Start_DateTime: start.toISOString(), End_DateTime: new Date(start.getTime() + 90 * 60000).toISOString(), Capacity: 20, Status: 'OPEN', Theme: 'Test Training', Location: 'Test location', Booking_Deadline: new Date(start.getTime() - 48 * 3600000).toISOString(), ...overrides }); return context.sessionById_(id); },
    debt(memberId, amount = 240, overrides = {}) { api.add('Ledger', { Ledger_ID: `LED-${crypto.randomUUID()}`, Member_ID: memberId, Amount_CZK: amount, Status: 'OPEN', Blocks_Booking: true, ...overrides }); },
    proof: { dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJXRlc3Q=', name: 'proof.pdf' },
    quote(payload, items) { return context.createQuote({ member: payload, items }); },
    pay(quote, overrides = {}) { return context.submitQuotePayment({ quoteId: quote.quoteId, declaredAmount: quote.amount, proof: api.proof, ...overrides }); },
  };
  api.config('REQUIRE_BOOKING_VERIFICATION', options.enforceEmailAuth === true);
  api.config('CALENDAR_SYNC_ENABLED', false);
  api.config('CURRENT_POLICY_VERSION', 'DRU-2026-10-v2');
  api.config('NOV_POLICY_VERSION', 'DRU-2026-11-v2-PENDING-RELEASE');
  api.config('NOV_ADVANCE_BOOKING_START', '2026-10-25T00:00:00+02:00');
  const products = { 'DRU-TRIAL': 120, 'DRU-JUNIOR-DROPIN': 240, 'DRU-SENIOR-DROPIN': 120, 'DRU-SENIOR-FLEX-202611': 200, 'DRU-JUNIOR-LATE-202610': 300, 'DRU-SENIOR-LATE-202610': 150, 'DRU-JUNIOR-EMERGENCY-202610': 360, 'DRU-SENIOR-EMERGENCY-202610': 180, 'DRU-JUNIOR-LATE-202611': 300, 'DRU-SENIOR-LATE-202611': 250, 'DRU-JUNIOR-EMERGENCY-202611': 360, 'DRU-SENIOR-EMERGENCY-202611': 300, 'DRU-STARTER4-202611': 800, 'DRU-SENIOR4-202611': 650, 'DRU-SENIOR8-202611': 1100, 'DRU-SENIOR12-202611': 1500 };
  Object.entries(products).forEach(([code, price]) => api.add('Products', { Product_ID: code, Offer: code, Price_CZK: price, Payment_URL: 'https://example.test/payment' }));
  return api;
}

module.exports = { harness, HEADERS };
