'use strict';
/**
 * IMPERION public job discovery adapter (MUNI only).
 * No CV, applicant identity, login, email, POST, application, or CRM writes.
 * Uses only existing GitHub Actions and public official pages.
 */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ORIGIN = 'https://www.muni.cz';
const INDEX_PATH = '/o-univerzite/kariera-na-mu/vyberte-si-z-volnych-mist-na-muni';
const DETAIL_PATH = /^\/o-univerzite\/kariera-na-mu\/volna-mista\/[0-9]{4,8}\/?$/;
const ROBOTS_URL = ORIGIN + '/robots.txt';
const USER_AGENT = 'IMPERION-Public-Job-Scout/0.1';
const MAX_BYTES = 1500000;
const TITLE_SIGNALS = [
  /datov|data |analyt|bioinformat|statisti|python|software|program|IT\b/i,
  /biochem|molekul|protein|laborant|chem|biolog|výzkum|research|postdoc/i,
  /lektor|výuk|vzděláv|koordin|projekt|administr|metodik/i,
];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function allowedUrl(input, type = 'detail') {
  const url = new URL(input, ORIGIN);
  if (url.protocol !== 'https:' || url.hostname !== 'www.muni.cz' ||
      url.port || url.username || url.password || url.hash) {
    throw Error('SOURCE_NOT_ALLOWLISTED');
  }
  if (type === 'detail') {
    if (!DETAIL_PATH.test(url.pathname) || url.search) throw Error('DETAIL_NOT_ALLOWLISTED');
  } else if (type === 'index') {
    if (url.pathname !== INDEX_PATH || (url.search && !/^\?page=[1-4]$/.test(url.search))) {
      throw Error('INDEX_NOT_ALLOWLISTED');
    }
  } else {
    throw Error('UNKNOWN_URL_TYPE');
  }
  return url.href;
}

function extractIndex(html) {
  if (typeof html !== 'string' || html.length > MAX_BYTES) throw Error('INDEX_INVALID');
  const doc = new JSDOM(html).window.document;
  const seen = new Set();
  const jobs = [];
  for (const anchor of doc.querySelectorAll('a[href]')) {
    let url;
    try { url = allowedUrl(anchor.getAttribute('href'), 'detail'); }
    catch { continue; }
    const title = clean(anchor.textContent);
    if (title.length < 5 || title.length > 180 || seen.has(url)) continue;
    seen.add(url);
    jobs.push({ title, url });
  }
  return jobs;
}

const CZECH_MONTHS = Object.freeze({
  ledna: 1, leden: 1, února: 2, únor: 2, března: 3, březen: 3,
  dubna: 4, duben: 4, května: 5, květen: 5, června: 6, červen: 6,
  července: 7, červenec: 7, srpna: 8, srpen: 8, září: 9,
  října: 10, říjen: 10, listopadu: 11, listopad: 11,
  prosince: 12, prosinec: 12,
});

function dateFromCzech(text) {
  // MUNI displays "30. listopadu 2026"; numeric dates also occur in other sources.
  const m = String(text).normalize('NFC').match(
    /\b(\d{1,2})\.\s*(\d{1,2})\.?\s*(20\d{2})\b|\b(\d{1,2})\.\s*([a-záčďéěíňóřšťúůýž]+)\s+(20\d{2})\b/i
  );
  if (!m) return null;
  const day = Number(m[1] || m[4]);
  const month = m[2] ? Number(m[2]) : CZECH_MONTHS[m[5].toLowerCase()];
  const year = Number(m[3] || m[6]);
  if (!month || month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) return null;
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function todayPrague(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function titleScore(title) {
  const t = clean(title);
  let score = TITLE_SIGNALS.reduce((sum, signal) => sum + (signal.test(t) ? 18 : 0), 0);
  if (/0[,.]5|částečný|part.time/i.test(t)) score += 25;
  if (/PhD candidate|doktorand/i.test(t)) score -= 25;
  return score;
}

function parseDetail(html, item, now = new Date()) {
  if (typeof html !== 'string' || html.length > MAX_BYTES) throw Error('DETAIL_INVALID');
  const doc = new JSDOM(html).window.document;
  const main = doc.querySelector('main') || doc.body;
  const body = clean(main.textContent);
  const title = clean(doc.querySelector('h1')?.textContent) || item.title;
  const deadlineFragment = body.match(
    /(?:Termín přihlášek|Uzávěrka přihlášek)\s*:?\s*(\d{1,2}\.\s*(?:\d{1,2}\.?\s*|[a-záčďéěíňóřšťúůýž]+\s+)20\d{2})/i
  );
  const deadline = deadlineFragment ? dateFromCzech(deadlineFragment[1]) : null;
  const half = /(?:0[,.]5\s*(?:[-–]\s*1[,.]0)?\s*(?:FTE|úvaz(?:ek|ku)))|(?:úvaz(?:ek|ku)\s*0[,.]5)/i.test(body + ' ' + title);
  const partTime = half || /(?:Typ úvazku.{0,70}částečný|Částečný úvazek)/i.test(body);
  const expired = deadline ? deadline < todayPrague(now) : false;
  // This is a public advert requirement, not a claim about any applicant's skills.
  // Explicit specialized credentials must not be mistaken for a generic 0.5 FTE fit.
  const germanDegreeAndC1 =
    /magistersk[eé]ho studia.{0,110}německého jazyka/i.test(body) &&
    /(?:úroveň C1|rodilý mluvčí)/i.test(body);
  const qualificationGate = germanDegreeAndC1 ? 'GERMAN_LANGUAGE_MA_AND_C1' : null;
  const score = titleScore(title) + (half ? 35 : partTime ? 15 : 0) -
    (expired ? 100 : 0) - (qualificationGate ? 100 : 0);
  return {
    title, url: allowedUrl(item.url, 'detail'), deadline,
    deadline_verified: Boolean(deadline),
    qualification_gate: qualificationGate,
    part_time_advertised: partTime, half_fte_explicit: half,
    expired, score,
    hpp_confirmed: false, insurance_confirmed: false,
    requirements_verified: false, prior_application_checked: false,
    status: 'PUBLIC_DISCOVERY_ONLY',
  };
}

function parseRobots(text) {
  if (typeof text !== 'string' || text.length > 200000) throw Error('ROBOTS_INVALID');
  const groups = [];
  let agents = [], rules = [], hasRule = false;
  function flush() {
    if (agents.length) groups.push({ agents, rules });
    agents = []; rules = []; hasRule = false;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) { if (hasRule) flush(); continue; }
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (hasRule) flush();
      agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && agents.length) {
      rules.push({ key, value }); hasRule = true;
    }
  }
  flush();
  return groups;
}

function robotsAllows(robots, url) {
  const groups = parseRobots(robots);
  const ua = USER_AGENT.toLowerCase();
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && ua.startsWith(a)));
  const matching = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  const rules = matching.flatMap(g => g.rules);
  const target = new URL(url).pathname + new URL(url).search;
  const matches = rules.filter(rule => {
    if (!rule.value) return false;
    const end = rule.value.endsWith('$');
    const withoutEnd = end ? rule.value.slice(0, -1) : rule.value;
    const pattern = withoutEnd.split('*').map(s => s.replace(/[^a-zA-Z0-9_]/g, '\\$&')).join('.*');
    return new RegExp('^' + pattern + (end ? '$' : '')).test(target);
  }).sort((a, b) => b.value.replace(/\*/g, '').length - a.value.replace(/\*/g, '').length ||
    (a.key === 'allow' ? -1 : 1));
  return !matches.length || matches[0].key === 'allow';
}

async function fetchPublicText(url, type, fetcher = fetch) {
  if (type !== 'robots') allowedUrl(url, type);
  else if (url !== ROBOTS_URL) throw Error('ROBOTS_URL_INVALID');
  const response = await fetcher(url, {
    method: 'GET', redirect: 'manual', credentials: 'omit',
    headers: { Accept: type === 'robots' ? 'text/plain' : 'text/html', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (response.status !== 200 || response.url && response.url !== url) {
    throw Error('SOURCE_HTTP_OR_REDIRECT_' + response.status);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !(type === 'robots' ? /text\/plain/i : /text\/html/i).test(contentType)) {
    throw Error('SOURCE_CONTENT_TYPE');
  }
  if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) throw Error('SOURCE_OVERSIZE');
  const text = await response.text();
  if (text.length > MAX_BYTES) throw Error('SOURCE_OVERSIZE');
  return text;
}

async function scout({ pages = 1, details = 3, fetcher = fetch, pause = async () => {} } = {}) {
  if (!Number.isInteger(pages) || pages < 1 || pages > 4 ||
      !Number.isInteger(details) || details < 1 || details > 10) throw Error('BOUNDS_INVALID');
  const robots = await fetchPublicText(ROBOTS_URL, 'robots', fetcher);
  const index = [];
  for (let page = 1; page <= pages; page++) {
    const url = allowedUrl(ORIGIN + INDEX_PATH + (page === 1 ? '' : '?page=' + page), 'index');
    if (!robotsAllows(robots, url)) throw Error('ROBOTS_DENY_INDEX');
    const html = await fetchPublicText(url, 'index', fetcher);
    index.push(...extractIndex(html));
    await pause();
  }
  const unique = [...new Map(index.map(item => [item.url, item])).values()]
    .sort((a, b) => titleScore(b.title) - titleScore(a.title) || a.url.localeCompare(b.url));
  const jobs = [];
  for (const item of unique.slice(0, details)) {
    if (!robotsAllows(robots, item.url)) throw Error('ROBOTS_DENY_DETAIL');
    const html = await fetchPublicText(item.url, 'detail', fetcher);
    jobs.push(parseDetail(html, item));
    await pause();
  }
  return {
    schema: 'imperion-public-job-scout-v1', checked_at: new Date().toISOString(),
    source: ORIGIN + INDEX_PATH, status: 'PUBLIC_RESEARCH_ONLY',
    index_count: unique.length, details_checked: jobs.length,
    jobs: jobs.filter(j => !j.expired).sort((a, b) => b.score - a.score),
    applications_sent: 0, cv_uploaded: false, private_data_processed: false,
    crm_writes: 0, paid_api_requests: 0,
  };
}

async function main(args = process.argv.slice(2)) {
  if (!args.includes('--live')) throw Error('LIVE_OPT_IN_REQUIRED');
  const get = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i < 0 ? fallback : args[i + 1];
  };
  const out = get('--out', '');
  if (!out || !path.isAbsolute(out)) throw Error('ABSOLUTE_OUT_REQUIRED');
  const pages = Number(get('--pages', '1')), details = Number(get('--details', '3'));
  const report = await scout({
    pages, details, pause: () => new Promise(resolve => setTimeout(resolve, 750)),
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({
    status: report.status, index_count: report.index_count,
    details_checked: report.details_checked,
    title_signal_matches: report.jobs.filter(j => j.score > 0).length,
    deadlines_verified: report.jobs.filter(j => j.deadline_verified).length,
    deadlines_unknown: report.jobs.filter(j => !j.deadline_verified).length,
    applications_sent: 0, private_data_processed: false,
  }));
  // Public employer data only, no applicant details. Makes the daily scan actionable
  // without GitHub artifact storage, extra APIs, emails, or a second CRM.
  for (const job of report.jobs.slice(0, 10)) {
    console.log('PUBLIC_VACANCY ' + JSON.stringify({
      title: job.title.slice(0, 140), url: job.url,
      deadline: job.deadline || 'NOT_VERIFIED',
      half_fte_explicit: job.half_fte_explicit,
      part_time_advertised: job.part_time_advertised,
      qualification_gate: job.qualification_gate || 'NOT_ASSESSED',
      title_score: job.score, status: job.status,
    }));
  }
}

if (require.main === module) {
  main().catch(e => {
    console.error('PUBLIC_JOB_SCOUT_BLOCKED:', String(e.message).slice(0, 140));
    process.exitCode = 1;
  });
}
module.exports = {
  ORIGIN, INDEX_PATH, ROBOTS_URL, allowedUrl, extractIndex, dateFromCzech,
  titleScore, parseDetail, parseRobots, robotsAllows, fetchPublicText, scout,
};
