'use strict';
// Imperion public funnel safety check. Read-only; no network, secrets or new CRM.
// It guards the routes and factual status of public customer-facing entrypoints.
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED = Object.freeze([
  'index.html',
  'corporate/index.html',
  'corporate/request/index.html',
  'academy/index.html',
  'druzina/index.html',
  'walkers/index.html',
  // Event Command v1 requires a coordinated backend and existing CRM importer.
  'supabase/functions/imperion-b2b-intake/index.ts',
  'ops/site-event-offers-go.sql',
  'imperion-intake-sync.gs',
]);

function linkWithId(html, id) {
  const elements = String(html || '').match(/<a\b[^>]*>/gi) || [];
  for (const tag of elements) {
    const found = tag.match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (!found || found[1] !== id) continue;
    return tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  }
  return '';
}

function runAudit(pages) {
  const errors = [];
  const warnings = [];
  let checked = 0;
  const verify = (id, ok, note) => {
    checked++;
    if (!ok) errors.push({ id, note });
  };
  for (const file of REQUIRED) verify('required:' + file,
    typeof pages[file] === 'string' && pages[file].length > 0,
    'Missing or empty required public page');

  const home = pages['index.html'] || '';
  const corporate = pages['corporate/index.html'] || '';
  const academy = pages['academy/index.html'] || '';
  const druzina = pages['druzina/index.html'] || '';
  const walkers = pages['walkers/index.html'] || '';

  // The home hero may point to the service explanation OR straight to the
  // guarded OSVC quote form, but never to an invented checkout.
  const heroCorporateRoute=linkWithId(home,'heroCta').replace(/&amp;/g,'&');
  const b2bQuote=pages['corporate/request/index.html']||'';
  const b2bGuarded=/<form[^>]*id="request"/.test(b2bQuote)
    && /id="privacyAck"[^>]*type="checkbox" required/.test(b2bQuote)
    && /imperion-b2b-intake/.test(b2bQuote)
    && /RECEIVED_UNCONFIRMED/.test(b2bQuote)
    && /bookingConfirmed:false|Nezávazná|non-binding/i.test(b2bQuote);
  const stagedEventCodes = /<option value="EVENT_HOST"/.test(b2bQuote)
    && /<option value="EVENT_PROGRAM"/.test(b2bQuote)
    && /'EVENT_HOST'/.test(pages['supabase/functions/imperion-b2b-intake/index.ts'] || '')
    && /'EVENT_PROGRAM'/.test(pages['supabase/functions/imperion-b2b-intake/index.ts'] || '')
    && /'EVENT_HOST'/.test(pages['ops/site-event-offers-go.sql'] || '')
    && /'EVENT_PROGRAM'/.test(pages['ops/site-event-offers-go.sql'] || '')
    && /EVENT_HOST:'Other'/.test(pages['imperion-intake-sync.gs'] || '')
    && /EVENT_PROGRAM:'Other'/.test(pages['imperion-intake-sync.gs'] || '');
  verify('root:corporate-route',
    heroCorporateRoute==='corporate/technical-answers/?lang=en'
    || (heroCorporateRoute==='corporate/request/?lang=en&service=DATA_PILOT&src=home_hero'&&b2bGuarded)
    || (heroCorporateRoute==='corporate/request/?lang=en&service=EVENT_HOST&src=home_hero'&&b2bGuarded&&stagedEventCodes),
    'Corporate hero CTA must have an existing guarded quote form, server allowlist, schema gate and CRM importer. Source validation is not LIVE proof.');
  verify('root:audience-route', linkWithId(home, 'heroCorporateCta') === 'start/',
    'Personal/community hero CTA must open the relevant choices');
  const clubCard = home.match(/<a\b[^>]*class=["'][^"']*\bventure-card\b[^"']*["'][^>]*href=["']druzina\/["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
  verify('root:club-card', /(?:plan|confirm|date|term|dotaz)/i.test(clubCard)
    && !/3\s*[×x]\s*(?:a week|týdně|в неделю|на тиждень)/i.test(clubCard)
    && !/trial-price-auto|first session\s*<|first session\s*\d+\s*kč/i.test(clubCard),
  'Club card must not promise a paid trial or outdated weekly frequency');

  const jsonScripts = [...home.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let validSchemas = 0;
  let hasOwnerService = false;
  let ownerIsPerson = false;
  for (const match of jsonScripts) {
    try {
      const value = JSON.parse(match[1]);
      const values = Array.isArray(value) ? value : [value];
      for (const schema of values) {
        validSchemas++;
        if (schema['@type'] === 'Person' && /Aliaksei Chareshneu/i.test(schema.name || '') && !/Družina Moravy/i.test(JSON.stringify(schema.alternateName || ''))) ownerIsPerson = true;
        if (schema['@type'] === 'ProfessionalService' && /Brno/i.test(JSON.stringify(schema.areaServed || schema.address || ''))) {
          hasOwnerService = true;
        }
        if (JSON.stringify(schema).includes('"streetAddress"') || JSON.stringify(schema).includes('"geo"')) {
          errors.push({ id: 'schema:unverified-address', note: 'Public schema contains a precise unverified venue/address or approximate geocoordinates' });
        }
      }
    } catch {
      errors.push({ id: 'schema:invalid-json', note: 'Invalid JSON-LD on home page' });
    }
  }
  verify('schema:owner-identity', ownerIsPerson,
    'Owner personal identity must not claim the separate association as a legal alias');
  verify('schema:osvc-service', hasOwnerService && validSchemas > 0,
    'Use owner professional service schema with city-level coverage, not the association as the commercial seller');

  verify('corporate:qualified-intake',
    /mailto:[^"']*subject=Corporate/i.test(corporate) ||
    /mailto:[^"']*subject=AI%20PILOT/i.test(corporate),
    'Business page must offer a direct scoped corporate proposal email');
  verify('corporate:email-fallback', /mailto:/i.test(corporate),
    'A direct corporate inquiry path must remain available');
  let academyUrl='';
  try { academyUrl=decodeURIComponent(linkWithId(academy,'navBookBtn')); } catch { /* fail closed */ }
  verify('academy:relevant-contact',
    academyUrl.startsWith('https://wa.me/') && /Academy/i.test(academyUrl),
    'Academy first-lesson enquiry must reach its own service');
  const dmForm = fs.readFileSync(path.join(__dirname,'../druzina/prihlaska/index.html'),'utf8');
  verify('druzina:enquiry-only',
    /^prihlaska\/\?lang=(en|cs|ru|uk)$/.test(linkWithId(druzina,'navBookBtn')) &&
    dmForm.includes("intent:'DRUZINA_ENQUIRY'") &&
    dmForm.includes('id="safety" type="checkbox" required') &&
    dmForm.includes('id="adult" type="checkbox" required') &&
    dmForm.includes('out.confirmed!==false') &&
    druzina.includes('New HEMA training applications are open; paid attendance is confirmed individually.') &&
    druzina.includes('Přihlášky na plánované tréninky HEMA jsou otevřené; placenou účast potvrzujeme jednotlivě.') &&
    druzina.includes('Заявки на тренировки HEMA открыты; платное участие подтверждается индивидуально.') &&
    druzina.includes('Заявки на тренування HEMA відкриті; платну участь підтверджуємо індивідуально.') &&
    druzina.includes('Do not pay or travel without written confirmation') &&
    druzina.includes('No online payment.') &&
    !/docs[.]google[.]com\/forms\/d\/e|revolut[.]me\//i.test(druzina),
    'Družina enquiry button must lead to guarded, consented non-booking intake with four-language payment safety');
  let walkersUrl='';
  try { walkersUrl=decodeURIComponent(linkWithId(walkers,'navBookBtn')); } catch { /* fail closed */ }
  verify('walkers:event-intake',
    walkersUrl === '../register/' && /https:\/\/wa\.me\/420702914842/.test(walkers),
    'Walkers event enquiry must stay service-specific');

  if (/Dukelská třída 157\/44/.test(home)) {
    warnings.push({ id: 'root:legacy-copy', note: 'Legacy inert club translation strings still reference a retired venue; do not re-enable them' });
  }

  return { status: errors.length ? 'BLOCKED' : 'PASS', checked, errors, warnings,
    scope: 'PUBLIC_SOURCE_ONLY', cash_verified: false, production_verified: false };
}

function main(args = process.argv.slice(2)) {
  if (args.length && !(args.length === 1 && args[0] === '--json')) {
    console.error('Usage: node ops/imperion-public-gates.cjs [--json]');
    return 2;
  }
  const root = path.resolve(__dirname, '..');
  const pages = Object.fromEntries(REQUIRED.map(file => [file,
    fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '']));
  const result = runAudit(pages);
  console.log(JSON.stringify(result, null, 2));
  return result.status === 'PASS' ? 0 : 1;
}
if (require.main === module) process.exitCode = main();
module.exports = { REQUIRED, linkWithId, runAudit, main };
