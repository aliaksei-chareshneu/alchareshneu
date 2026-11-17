'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const scout = require('../ops/job-scout/muni-public.cjs');

const indexHtml = '<html><body><main>' +
  '<a href="/o-univerzite/kariera-na-mu/volna-mista/81958"><h2>Datový analytik/analytička</h2></a>' +
  '<a href="/o-univerzite/kariera-na-mu/volna-mista/81958">duplicate</a>' +
  '<a href="https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81959">Lektor/lektorka (úvazek 0,5)</a>' +
  '<a href="https://evil.example/o-univerzite/kariera-na-mu/volna-mista/12345">Ignore</a>' +
  '<a href="/o-univerzite/kariera-na-mu/volna-mista/81960?token=secret">Ignore token</a>' +
  '</main></body></html>';
const detailHtml = '<html><body><main><h1>Datový analytik/analytička</h1>' +
  '<p>Termín přihlášek 30. 11. 2026</p>' +
  '<p>Typ úvazku plný | částečný</p>' +
  '<p>Výše pracovního úvazku: 0,5-1,0 FTE / dle domluvy</p>' +
  '<p>Požadujeme Python, statistiku a práci s daty.</p>' +
  '</main></body></html>';
const halfTitleHtml = '<html><body><main><h1>Lektor/lektorka (úvazek 0,5)</h1>' +
  '<p>Termín přihlášek 11. 12. 2026</p><p>Částečný úvazek</p>' +
  '</main></body></html>';
const robots = 'User-agent: *\nDisallow: /private/\nAllow: /o-univerzite/\n';

test('only exact MUNI public job detail URLs are allowed', () => {
  assert.match(scout.allowedUrl('/o-univerzite/kariera-na-mu/volna-mista/81958'), /81958$/);
  for (const bad of [
    'http://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958',
    'https://evil.example/o-univerzite/kariera-na-mu/volna-mista/81958',
    'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958?email=secret',
    'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958#private',
    'https://www.muni.cz/muj/',
  ]) assert.throws(() => scout.allowedUrl(bad));
});

test('index extractor deduplicates official vacancy links', () => {
  const jobs = scout.extractIndex(indexHtml);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Datový analytik/analytička');
  assert.ok(jobs.every(j => j.url.startsWith('https://www.muni.cz/')));
});

test('detail extracts explicit 0.5 FTE but never asserts HPP or insurance', () => {
  const item = { title: 'Datový analytik/analytička', url: 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958' };
  const job = scout.parseDetail(detailHtml, item, new Date('2026-11-17T11:00:00Z'));
  assert.equal(job.deadline, '2026-11-30');
  assert.equal(job.part_time_advertised, true);
  assert.equal(job.half_fte_explicit, true);
  assert.equal(job.expired, false);
  assert.equal(job.hpp_confirmed, false);
  assert.equal(job.insurance_confirmed, false);
  assert.equal(job.prior_application_checked, false);
  assert.equal(job.status, 'PUBLIC_DISCOVERY_ONLY');
});

test('0.5 in the position title is recognized', () => {
  const job = scout.parseDetail(halfTitleHtml, {
    title: 'Lektor/lektorka (úvazek 0,5)',
    url: 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81959',
  }, new Date('2026-11-17T11:00:00Z'));
  assert.equal(job.half_fte_explicit, true);
  assert.equal(job.deadline, '2026-12-11');
});

test('expired deadlines are flagged, not silently presented as open', () => {
  const old = detailHtml.replace('30. 11. 2026', '01. 11. 2026');
  const job = scout.parseDetail(old, {
    title: 'Datový analytik/analytička',
    url: 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958',
  }, new Date('2026-11-17T11:00:00Z'));
  assert.equal(job.expired, true);
  assert.ok(job.score < 0);
});

test('Czech date parser rejects impossible dates', () => {
  assert.equal(scout.dateFromCzech('31. 02. 2026'), null);
  assert.equal(scout.dateFromCzech('30. 11. 2026'), '2026-11-30');
});

test('Czech named-month deadlines are parsed and old postings excluded', () => {
  const item = {
    title: 'Lektor/lektorka',
    url: 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81959',
  };
  assert.equal(scout.dateFromCzech('11. září 2026'), '2026-09-11');
  assert.equal(scout.dateFromCzech('18. listopadu 2026'), '2026-11-18');
  assert.equal(scout.dateFromCzech('31. února 2026'), null);
  assert.equal(scout.dateFromCzech('12. neznámého 2026'), null);
  const expired = scout.parseDetail(
    detailHtml.replace('30. 11. 2026', '11. září 2026'),
    item, new Date('2026-11-17T11:00:00Z')
  );
  assert.equal(expired.deadline, '2026-09-11');
  assert.equal(expired.deadline_verified, true);
  assert.equal(expired.expired, true);
  const upcoming = scout.parseDetail(
    detailHtml.replace('30. 11. 2026', '18. listopadu 2026'),
    item, new Date('2026-11-17T11:00:00Z')
  );
  assert.equal(upcoming.deadline, '2026-11-18');
  assert.equal(upcoming.deadline_verified, true);
  assert.equal(upcoming.expired, false);
});

test('explicit German MA and C1 requirement is a qualification gate, not a 0.5 FTE match', () => {
  const item = {
    title: 'Lektor/lektorka pro Katedru dalších cizích jazyků (úvazek 0,5)',
    url: 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81955',
  };
  const body = '<html><body><main><h1>' + item.title + '</h1>' +
    '<p>Termín přihlášek 11. prosince 2026</p>' +
    '<p>Absolvent magisterského studia programu v oblasti německého jazyka</p>' +
    '<p>Schopnost vyučovat v českém a německém jazyce (minimální úroveň C1)</p>' +
    '</main></body></html>';
  const flagged = scout.parseDetail(body, item, new Date('2026-11-17T11:00:00Z'));
  assert.equal(flagged.deadline, '2026-12-11');
  assert.equal(flagged.half_fte_explicit, true);
  assert.equal(flagged.qualification_gate, 'GERMAN_LANGUAGE_MA_AND_C1');
  const ordinary = scout.parseDetail(halfTitleHtml, item, new Date('2026-11-17T11:00:00Z'));
  assert.equal(ordinary.qualification_gate, null);
  assert.ok(flagged.score < ordinary.score);
});

test('unknown deadline is explicitly unverified, not silently fabricated', () => {
  const item = {
    title: 'Koordinátor',
    url: 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958',
  };
  const job = scout.parseDetail(detailHtml.replace('Termín přihlášek 30. 11. 2026', 'Přihlášky online'), item);
  assert.equal(job.deadline, null);
  assert.equal(job.deadline_verified, false);
  assert.equal(job.hpp_confirmed, false);
});

test('robots parser rejects disallowed pages and honors specific allow', () => {
  assert.equal(scout.robotsAllows(robots, 'https://www.muni.cz/private/data'), false);
  assert.equal(scout.robotsAllows(robots, 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958'), true);
  assert.equal(scout.robotsAllows('User-agent: *\nDisallow: /o-univerzite/\n', scout.ORIGIN + scout.INDEX_PATH), false);
  assert.equal(scout.robotsAllows('User-agent: *\nDisallow: /\nAllow: /o-univerzite/\n', scout.ORIGIN + scout.INDEX_PATH), true);
});

test('HTTP client only performs public GET without credentials and rejects redirect', async () => {
  let observed;
  const fetcher = async (url, options) => {
    observed = { url, options };
    return {
      status: 200, url,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => indexHtml,
    };
  };
  await scout.fetchPublicText(scout.ORIGIN + scout.INDEX_PATH, 'index', fetcher);
  assert.equal(observed.options.method, 'GET');
  assert.equal(observed.options.redirect, 'manual');
  assert.equal(observed.options.credentials, 'omit');
  await assert.rejects(() => scout.fetchPublicText(scout.ORIGIN + scout.INDEX_PATH, 'index',
    async () => ({ status: 302, url: 'https://evil.example', headers: { get: () => '' } })));
});

test('synthetic E2E creates public research only and zero submissions', async () => {
  const first = scout.ORIGIN + scout.INDEX_PATH;
  const a = 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81958';
  const b = 'https://www.muni.cz/o-univerzite/kariera-na-mu/volna-mista/81959';
  const pages = new Map([
    [scout.ROBOTS_URL, { body: robots, type: 'text/plain' }],
    [first, { body: indexHtml, type: 'text/html' }],
    [a, { body: detailHtml, type: 'text/html' }],
    [b, { body: halfTitleHtml, type: 'text/html' }],
  ]);
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, method: options.method });
    const page = pages.get(url);
    if (!page) throw Error('UNEXPECTED_URL');
    return {
      status: 200, url,
      headers: { get: key => key === 'content-type' ? page.type : null },
      text: async () => page.body,
    };
  };
  const result = await scout.scout({ pages: 1, details: 2, fetcher });
  assert.equal(result.status, 'PUBLIC_RESEARCH_ONLY');
  assert.equal(result.index_count, 2);
  assert.equal(result.details_checked, 2);
  assert.equal(result.applications_sent, 0);
  assert.equal(result.cv_uploaded, false);
  assert.equal(result.private_data_processed, false);
  assert.equal(result.crm_writes, 0);
  assert.ok(result.jobs.every(j => j.status === 'PUBLIC_DISCOVERY_ONLY'));
  assert.ok(requests.every(r => r.method === 'GET'));
});

test('bounded runs reject unlimited crawling and missing opt-in', async () => {
  await assert.rejects(() => scout.scout({ pages: 100, details: 100 }), /BOUNDS_INVALID/);
  assert.throws(() => scout.allowedUrl(scout.ORIGIN + scout.INDEX_PATH + '?page=100', 'index'));
});
