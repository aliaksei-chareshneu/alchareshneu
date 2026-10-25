'use strict';
// Imperion public funnel safety check. Read-only; no network, secrets or new CRM.
// It guards the routes and factual status of public customer-facing entrypoints.
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED = Object.freeze([
  'index.html',
  'corporate/index.html',
  'academy/index.html',
  'druzina/index.html',
  'walkers/index.html',
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

  verify('root:corporate-route', linkWithId(home, 'heroCorporateCta') === 'corporate/',
    'Corporate hero CTA must open the existing corporate service');
  verify('root:audience-route', linkWithId(home, 'heroCta') === '#join',
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

  const corporateHref = linkWithId(corporate, 'corporatePrimaryCta');
  verify('corporate:qualified-intake',
    /docs\.google\.com\/forms\/d\/e\//i.test(corporateHref) ||
    /docs\.google\.com\/forms\/d\/e\//i.test(corporate),
    'Business page needs an existing scoped proposal intake');
  verify('corporate:email-fallback', /mailto:[^"']+Corporate/i.test(corporate),
    'A direct corporate inquiry fallback must be available');
  let academyUrl = '';
  try { academyUrl = decodeURIComponent(linkWithId(academy, 'navBookBtn')); } catch { /* malformed input fails below */ }
  verify('academy:relevant-contact',
    academyUrl.startsWith('https://wa.me/') && /Academy/i.test(academyUrl),
    'Academy booking may not silently route to a corporate or unrelated intake');
  verify('druzina:enquiry-only',
    /^mailto:/i.test(linkWithId(druzina, 'navBookBtn')) &&
    /do not travel or pay before confirmation/i.test(druzina) &&
    /not a booking/i.test(druzina),
    'HEMA is an enquiry, not paid checkout or a confirmed venue');
  verify('walkers:event-intake',
    /docs\.google\.com\/forms\/d\/e\//i.test(linkWithId(walkers, 'navBookBtn')),
    'Walkers event booking must retain its own intake');

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
