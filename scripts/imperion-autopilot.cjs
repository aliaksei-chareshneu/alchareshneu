'use strict';
/** IMPERION public campaign autopilot.
 * Only public, server-open, verified forms from the existing Supabase catalog.
 * No private CRM access, no social auto-posting or platform bypasses.
 */
const fs = require('node:fs');
const path = require('node:path');
const API = 'https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const ORIGIN = 'https://aliaksei-chareshneu.github.io';
const OUTPUT = path.resolve(__dirname, '../autopilot');
const UNCERTAIN = /\b(?:HOLD|TBD|TBC|planned)\b|план|не\s*подтвержд|уточня|nepotvrzen|předběžn(?:ý|é)\s*termín/i;
function short(value, limit = 180) {
  return String(value == null ? '' : value).normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
function eligible(e, now = Date.now()) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  if (e.is_open !== true || e.registration_mode !== 'FORM' ||
      e.price_verified !== true || e.end_time_verified !== true ||
      e.source_active !== true) return false;
  if (!/^PUB-[A-Z0-9-]{4,90}$/.test(short(e.event_id, 110))) return false;
  const start = Date.parse(e.begins_at);
  if (!Number.isFinite(start) || start <= now) return false;
  if (!Number.isInteger(e.price_czk) || e.price_czk < 0 || e.price_czk > 100000) return false;
  if (short(e.title).length < 5 || short(e.venue).length < 3) return false;
  if (UNCERTAIN.test(short(e.title) + ' ' + short(e.venue))) return false;
  return true;
}
function build(source, now = Date.now()) {
  if (!source || !Array.isArray(source.events) || source.events.length > 120 ||
      source.bookingConfirmed !== false) throw new Error('Unexpected public catalog contract');
  const ids = new Set();
  const events = source.events.filter(e => eligible(e, now)).map(e => {
    const id = short(e.event_id, 110);
    if (ids.has(id)) throw new Error('Duplicate event id ' + id);
    ids.add(id);
    return {
      event_id: id, title: short(e.title), community: short(e.community, 90),
      category: short(e.category, 90), begins_at: new Date(e.begins_at).toISOString(),
      ends_at: Number.isFinite(Date.parse(e.ends_at)) ? new Date(e.ends_at).toISOString() : null,
      venue: short(e.venue, 180), price_czk: e.price_czk,
      public_note: short(e.public_note, 320),
      registration_url: ORIGIN + '/alchareshneu/register/?event=' + encodeURIComponent(id),
      status: 'OPEN_PRELIMINARY_ONLY'
    };
  }).sort((a, b) => a.begins_at.localeCompare(b.begins_at));
  const drafts = events.map(e => {
    const dt = new Intl.DateTimeFormat('cs-CZ', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Prague'
    }).format(new Date(e.begins_at));
    return {
      event_id: e.event_id, status: 'HOLD_FOR_MANUAL_APPROVAL',
      destination: 'OWN_PROFILE_OR_EXPLICITLY_ALLOWED_COMMUNITY_ONLY',
      direct_public_links: false, posted: false, published_url: null,
      text_cs: 'Chystá se ' + e.title + '.\n' +
        'Kdy: ' + dt + '\nKde: ' + e.venue + '\n' +
        (e.price_czk === 0 ? 'Zdarma.' : 'Cena: ' + e.price_czk + ' Kč.') +
        '\n\nChceš informace? Napiš mi soukromou zprávu s názvem akce. ' +
        'Přihláška je nezávazná; účast platí až po osobním potvrzení pořadatelem.'
    };
  });
  return {
    feed: {schema: 'imperion-public-campaigns-v1', source: 'existing_public_rsvp_catalog',
      booking_confirmed: false, events},
    drafts: {schema: 'imperion-social-drafts-v1', auto_posting: false,
      review_required: true, drafts}
  };
}
function writeStable(name, value) {
  fs.mkdirSync(OUTPUT, {recursive: true});
  const file = path.join(OUTPUT, name);
  const next = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return false;
  fs.writeFileSync(file, next, 'utf8');
  return true;
}
async function main() {
  const response = await fetch(API, {headers: {'Origin': ORIGIN, 'Accept': 'application/json'},
    signal: AbortSignal.timeout(20000)});
  if (!response.ok || response.headers.get('access-control-allow-origin') !== ORIGIN)
    throw new Error('Verified catalog fetch/CORS failed: ' + response.status);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 300000) throw new Error('Unexpected catalog size');
  const raw = await response.text();
  if (raw.length > 300000) throw new Error('Catalog exceeds safe bounds');
  const result = build(JSON.parse(raw));
  const changed = [writeStable('feed.json', result.feed),
    writeStable('social-drafts.json', result.drafts)].some(Boolean);
  console.log(JSON.stringify({
    status: 'PASS', public_events: result.feed.events.length,
    owner_review_drafts: result.drafts.drafts.length,
    third_party_posts: 0, captured_leads: 'EXISTING_PRIVATE_INTAKE_ONLY',
    changed
  }));
}
if (require.main === module) main().catch(e => {console.error(e.message); process.exitCode = 1;});
module.exports = {short, eligible, build};
