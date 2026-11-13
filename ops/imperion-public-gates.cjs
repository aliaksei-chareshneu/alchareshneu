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
  'academy/courses/index.html',
  'academy/programmes/index.html',
  'druzina/index.html',
  'walkers/index.html',
  'start/index.html',
  'druzina/prihlaska/index.html',
  'register/index.html',
  'register/en/index.html',
  'register/ru/index.html',
  'register/uk/index.html',
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
  const academyCourses = pages['academy/courses/index.html'] || '';
  const academyProgrammes = pages['academy/programmes/index.html'] || '';
  const druzina = pages['druzina/index.html'] || '';
  const walkers = pages['walkers/index.html'] || '';

  // Intent-first public homepage: the main Academy CTA points to the
  // verified tutoring enquiry; companies retain a separate portfolio link.
  // Each service-specific route must exist and remain nonbinding (no
  // checkout, invented availability, or paid training confirmation).
  const verifiedAcademyForm='https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform';
  const academyHeroRoute=linkWithId(home,'heroCta').replace(/&amp;/g,'&');
  verify('root:academy-route', academyHeroRoute==='academy/programmes/?lang=en&programme=LESSON#enquire'
    && /id="goal-paths"/.test(home)
    && /id="interest-form"/.test(academyProgrammes)
    && /imperion-academy-intake/.test(academyProgrammes),
    'Primary lesson CTA must reach the approved Academy enquiry, not an unverified checkout');
  verify('root:druzina-route', linkWithId(home,'intentDruzinaCta')==='register/?lang=en'
    && /id="safety" type="checkbox" required/.test(pages['register/index.html'] || '')
    && /id="paymentProof"/.test(pages['register/index.html'] || ''),
    'First-training CTA must use the existing guarded nonbinding Družina intake');
  verify('root:walkers-route', linkWithId(home,'intentWalkersCta')==='register/en/'
    && (pages['register/en/index.html'] || '').includes('imperion-register')
    && (pages['register/index.html'] || '').includes('imperion-register'),
    'Event CTA must use the existing RSVP route, never a direct checkout');
  verify('root:corporate-route', linkWithId(home,'intentBusinessCta')==='corporate/'
    && /mailto:/i.test(corporate)
    && (pages['corporate/request/index.html'] || '').includes('RECEIVED_UNCONFIRMED'),
    'Business portfolio CTA must reach the existing owner-owned inquiry, not an invented sale');
  verify('root:audience-route', linkWithId(home,'heroCorporateCta')==='start/?lang=en'
    && (pages['start/index.html'] || '').length>0,
    'Further activities CTA must open the existing language-aware service picker');
  // 55 on 13 Nov is explicitly the owner's dated report, not a live Google API rating.
  verify('root:review-link', /<a[^>]*class="intent-google"[^>]*href="https:\\/\\/maps\\.app\\.goo\\.gl\\/fEbnJHxiVoAx1v498"/.test(home)
    && /data-intent="reviews">55 Google reviews · owner-reported \\(13 Nov 2026\\)/.test(home)
    && /const GOOGLE_REVIEW_COUNT = 55;/.test(home)
    && home.includes("отзывов на Google · 13.11.2026")
    && home.includes("Google reviews · 13.11.2026")
    && home.includes("recenzí na Google · 13.11.2026")
    && home.includes("відгуків на Google · 13.11.2026"),
    'Owner-reported 55 Google reviews on 13 November 2026 must be dated, linked, and not presented as an independently verified rating');
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
  // Approved 13 Nov conversion path: course catalogue first, only then a written
  // enquiry. Do not weaken the gate to accept an arbitrary local path.
  // A course-specific contact AND the previously verified form must survive.
  const academyWhatsapp=/^https:\/\/wa\.me\/420702914842\?text=.*Academy/i.test(academyUrl);
  const catalogueFirst=
    academyUrl==='courses/?lang=cs' &&
    /data-i18n="academy.ctaRegister"[^>]*href="courses\/\?lang=cs"/.test(academy) &&
    /<article class="course"/.test(academyCourses) &&
    /id="PY01"/.test(academyCourses) &&
    academyCourses.includes('https://wa.me/420702914842?text=') &&
    academyCourses.includes(verifiedAcademyForm);
  const academyDirect=
    academyUrl==='programmes/?lang=cs&amp;programme=LESSON#enquire' &&
    /data-i18n="academy\.ctaRegister"[^>]*href="programmes\/\?lang=cs&amp;programme=LESSON#enquire"/.test(academy) &&
    /id="interest-form"/.test(academyProgrammes) &&
    /value="LESSON"/.test(academyProgrammes) &&
    /value="CONSULT"/.test(academyProgrammes) &&
    /academy-request-day/.test(academyProgrammes) &&
    /imperion-academy-intake/.test(academyProgrammes) &&
    academyCourses.includes('https://wa.me/420702914842?text=') &&
    academyCourses.includes(verifiedAcademyForm);
  verify('academy:relevant-contact',
    academyDirect || academyUrl===verifiedAcademyForm || academyWhatsapp || catalogueFirst,
    'Academy must reach its approved direct enquiry OR the verified course catalogue with working course-specific contact and approved fallback form');
  const dmForm = fs.readFileSync(path.join(__dirname,'../register/index.html'),'utf8');
  const dmLegacy = fs.readFileSync(path.join(__dirname,'../druzina/prihlaska/index.html'),'utf8');
  const dmApi = fs.readFileSync(path.join(__dirname,'../supabase/functions/imperion-register/index.ts'),'utf8');
  verify('druzina:enquiry-only',
    /^\.\.\/register\/\?lang=(en|cs|ru|uk)$/.test(linkWithId(druzina,'navBookBtn')) &&
    dmForm.includes('id="safety" type="checkbox" required') &&
    dmForm.includes('id="paymentResumeToken"') &&
    dmForm.includes('id="paymentProof"') &&
    dmApi.includes("return reply({ok:true,status:'RECEIVED',confirmed:false") &&
    dmLegacy.includes('window.location.replace(target.href)') &&
    !dmLegacy.includes('<form ') &&
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
