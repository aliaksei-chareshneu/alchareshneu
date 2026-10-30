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
function serializeOutput(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
}
function writeStable(name, value) {
  fs.mkdirSync(OUTPUT, {recursive: true});
  const file = path.join(OUTPUT, name);
  const next = serializeOutput(value);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return false;
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}
/** Owned website publishing requires no third-party social-media privileges. */
function renderCampaigns(feed) {
  const cards = feed.events.map(e => {
    const start = new Intl.DateTimeFormat('cs-CZ', {
      dateStyle:'long', timeStyle:'short',timeZone:'Europe/Prague'
    }).format(new Date(e.begins_at));
    const link = '../register/?event=' + encodeURIComponent(e.event_id);
    const price = e.price_czk === 0 ? 'Zdarma' : e.price_czk + ' Kč';
    return '<article class="campaign" id="' + htmlEscape(e.event_id) + '">' +
      '<p class="kind">' + htmlEscape(e.community || e.category) + '</p>' +
      '<h2>' + htmlEscape(e.title) + '</h2>' +
      '<p><strong>Kdy:</strong> ' + htmlEscape(start) + '</p>' +
      '<p><strong>Kde:</strong> ' + htmlEscape(e.venue) + '</p>' +
      '<p><strong>Cena:</strong> ' + htmlEscape(price) + '</p>' +
      '<p class="disclaimer">Přihláška je nezávazná; účast, místo a podmínky musí pořadatel osobně potvrdit.</p>' +
      '<a class="cta" href="' + htmlEscape(link) + '">Nezávazně se přihlásit</a></article>';
  }).join('\n');
  return '<!doctype html>\n<html lang="cs">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta name="theme-color" content="#0b1729">\n<meta name="referrer" content="no-referrer">\n' +
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;self&#39;; style-src &#39;self&#39; &#39;unsafe-inline&#39;; object-src &#39;none&#39;; base-uri &#39;self&#39;; form-action &#39;self&#39;">\n' +
    '<meta name="description" content="Aktuálně otevřené nezávazné přihlášky na akce v Brně: pěší výlety a začátečnické workshopy.">\n' +
    '<link rel="canonical" href="' + ORIGIN + '/alchareshneu/autopilot/campaigns.html">\n' +
    '<link rel="stylesheet" href="../brand-theme.css?v=20261028">\n' +
    '<link rel="stylesheet" href="../site-design.css?v=20261027">\n' +
    '<link rel="alternate" type="application/rss+xml" title="IMPERION události" href="rss.xml">\n' +
    '<title>Aktuálně otevřené akce v Brně | IMPERION</title>\n' +
    '<style>main{max-width:1000px;margin:auto;padding:32px 22px 75px}h1{font-size:clamp(2rem,6vw,3.1rem);margin:45px 0 20px}' +
    '.campaigns{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}' +
    '.campaign{border-radius:17px;border:1px solid #42526d;padding:24px;background:#182b44}' +
    '.campaign h2{font-size:1.3rem;line-height:1.35}.campaign p{color:#c6d1e0}' +
    '.kind{color:#e6bf80!important;font-size:.8rem;text-transform:uppercase;font-weight:bold}' +
    '.disclaimer{font-size:.87rem}.cta{display:inline-block;border-radius:9px;background:#e6bf80;color:#101b2d!important;font-weight:700;padding:12px 15px;text-decoration:none}' +
    'a:focus-visible{outline:3px solid #e6bf80;outline-offset:4px}</style>\n' +
    '</head>\n<body data-imperion-scope="autopilot" data-autopilot="owned-campaigns-v1"><main>\n' +
    '<p><a href="./">IMPERION Autopilot</a> · <a href="../calendar/">Kalendář</a></p>\n' +
    '<h1>Vyber si akci v Brně</h1><p>Jen otevřené nezávazné přihlášky z veřejného katalogu. ' +
    'Toto je automaticky aktualizovaný obsah vlastního webu, ne potvrzení účasti.</p>\n' +
    '<section class="campaigns" aria-label="Otevřené akce">\n' +
    (cards || '<p>Nyní nejsou k dispozici žádné ověřené otevřené přihlášky.</p>') +
    '</section><p><a href="./">Zkontrolovat živý katalog</a></p></main></body></html>\n';
}
function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'
  })[c]);
}
function renderRss(feed) {
  const root = ORIGIN + '/alchareshneu/autopilot/';
  const items = feed.events.map(e => {
    const url = root + 'campaigns.html#' + encodeURIComponent(e.event_id);
    const description = e.venue + ' — Nezávazná přihláška, účast vyžaduje osobní potvrzení pořadatelem.';
    return '<item><title>' + xmlEscape(e.title) + '</title>' +
      '<link>' + xmlEscape(url) + '</link>' +
      '<guid isPermaLink="false">' + xmlEscape(e.event_id) + '</guid>' +
      '<description>' + xmlEscape(description) + '</description></item>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0"><channel><title>IMPERION — otevřené přihlášky</title>' +
    '<link>' + xmlEscape(root) + '</link>' +
    '<description>Ověřené otevřené nezávazné přihlášky; pořadatel potvrzuje účast osobně.</description>' +
    '<language>cs-CZ</language>' + items + '</channel></rss>\n';
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
    writeStable('social-drafts.json', result.drafts),
    writeStable('campaigns.html', renderCampaigns(result.feed)),
    writeStable('rss.xml', renderRss(result.feed))].some(Boolean);
  console.log(JSON.stringify({
    status: 'PASS', public_events: result.feed.events.length,
    owner_review_drafts: result.drafts.drafts.length,
    third_party_posts: 0, captured_leads: 'EXISTING_PRIVATE_INTAKE_ONLY',
    changed
  }));
}
if (require.main === module) main().catch(e => {console.error(e.message); process.exitCode = 1;});
module.exports = {short, eligible, build, htmlEscape, renderCampaigns, renderRss, serializeOutput};
