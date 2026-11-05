const APP = Object.freeze({
  SPREADSHEET_ID: 'SYNTHETIC_SPREADSHEET_ID',
  RECEIPT_FOLDER_ID: 'SYNTHETIC_RECEIPT_FOLDER_ID',
  CALENDAR_ID: 'SYNTHETIC_CALENDAR_ID',
  PREZENCKY_SPREADSHEET_ID: 'SYNTHETIC_PREZENCKY_SPREADSHEET_ID',
  TIMEZONE: 'Europe/Prague',
  LOCATION: 'Dukelská třída 157/44, Brno',
  SESSION_HORIZON_DAYS: 70,
  DEFAULT_CAPACITY: 20,
  HOLD_MINUTES: 20,
  MAX_PROOF_BYTES: 5 * 1024 * 1024,
  ALLOWED_PROOF_MIME: ['image/jpeg', 'image/png', 'application/pdf'],
  VERSION: 'DRU-PORTAL-2026-11-02-v2.4-p13-FIO-READINESS-SAFE'
});

const SHEETS = Object.freeze({
  CONFIG: 'Druzina_Config',
  MEMBERS: 'Druzina_Members',
  PLANS: 'Druzina_Plans',
  SESSIONS: 'Druzina_Sessions',
  BOOKINGS: 'Druzina_Bookings',
  PAYMENTS: 'Druzina_Payments',
  REQUESTS: 'Druzina_Requests',
  LEDGER: 'Druzina_Ledger',
  PAYMENT_ITEMS: 'Druzina_Payment_Items',
  HOLDS: 'Druzina_Holds',
  NOTIFICATIONS: 'Druzina_Notifications',
  AUDIT: 'Druzina_Audit_Log',
  CONSENTS: 'Druzina_Consents',
  QUOTES: 'Druzina_Quotes',
  PRODUCTS: 'Products'
});
