// Case IMP-QUALIFIED-PRICE-POSITION-20261110: static, no network or test leads.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

test('root homepage does not advertise retired Druzina subscriptions', () => {
  const s = read('index.html');
  assert.doesNotMatch(s, /(?:455|910|1[ ,]?435|2[ ,]?870|4[ ,]?120|8[ ,]?235) Kč/);
  for (const amount of ['240 Kč','120 Kč','800 Kč','560 Kč']) assert.ok(s.includes(amount), amount);
  assert.match(s, /Starter 4/);
  assert.match(s, /14\.11\.2026/);
  assert.match(s, /БЕСПЛАТН|BEZPLATN|FREE beginner workshop/);
});

test('Academy uses approved standard rate while specialist work remains quoted separately', () => {
  const academy = read('academy/index.html');
  const courses = read('academy/courses/index.html');
  const programmes = read('academy/programmes/index.html');
  for (const html of [academy,courses,programmes]) { assert.match(html, /1 000 Kč/); assert.doesNotMatch(html, /690 Kč/); }
  assert.doesNotMatch(academy, /(?:specialist lessons|specializovaná|специализированный|спеціалізоване)[^<]{0,55}1[ ,]?000 Kč/i);
  assert.match(courses, /1[ ,]?000 Kč/);
  assert.doesNotMatch(programmes, /(?:specialist individual coaching:|specializovaná individuální lekce:|специализированное:|спеціалізоване:)\s*1[ ,]?000 Kč/i);
  assert.match(academy, /Compare a like-for-like offer/);
  assert.match(courses, /no automatic discount promise/);
  assert.match(programmes, /15-minute service-selection consultation is 250 Kč/);
  assert.doesNotMatch(programmes, /10-minute service-selection consultation is 200 Kč/);
});

test('A2 learning page and translated dynamic results use written specialist quote', () => {
  for (const path of ['academy/a2/index.html','academy/a2/quiz.js']) {
    const src = read(path);
    assert.match(src, /1 000 Kč/);
    assert.doesNotMatch(src, /690 Kč/);
    assert.match(src, /písemn|written|письменн|письмов/i);
  }
});

test('first-tutoring CTA has no retired 300-CZK price or prefilled 300-CZK claim', () => {
  const start = read('start/index.html');
  assert.doesNotMatch(start, /300 Kč|300%20(?:CZK|K%C4%8D)/i);
  assert.match(start, /1 000 Kč \/ 60/);
  assert.match(start, /сопоставим|srovnatel|Compare tutors fairly/);
});

test('historical and association offers remain distinct from personal tutoring', () => {
  const club = read('druzina/permanentky/index.html');
  const walkers = read('walkers/index.html');
  assert.match(club, /240 Kč/);
  assert.match(club, /120 Kč/);
  assert.match(club, /800 Kč/);
  // Existing live 29 November Brno Mysteries listing is 190 Kč/person, not the retired 450 Kč offer.
  assert.match(walkers, /190 Kč\/person/);
  assert.match(walkers, /490 Kč/);
});

test('Czech-default search snippets focus on real buyers, not an unapproved umbrella name', () => {
  const targets = [
    ['index.html', /Doučování, výlety a HEMA v Brně/],
    ['academy/index.html', /Doučování češtiny a CERMAT/],
    ['corporate/index.html', /Firemní školení AI a Pythonu v Brně/],
    ['walkers/index.html', /BrnoWalkers \| Výlety a procházky/],
    ['druzina/index.html', /Historický šerm a HEMA v Brně/],
    ['about/index.html', /Aliaksei Chareshneu, PhD/],
    ['start/index.html', /Výuka, firemní AI a výlety v Brně/],
    ['academy/programmes/index.html', /Příprava na CERMAT, češtinu A2 a přijímačky/]
  ];
  for (const [path, title] of targets) {
    const html = read(path);
    assert.match(html, /<html lang="cs">/);
    assert.match(html, title, path);
    assert.match(html, /<meta name="description" content="[^"]+">/, path);
    assert.doesNotMatch(html, /<title>[^<]*IMPERION/, path);
  }
  assert.match(read('druzina/index.html'), /Družina Moravy z\. s\. v Brně/);
  assert.match(read('corporate/index.html'), /jasně vymezený rozsah/);
});

test('search-facing Academy prices and CTA are consistent with current owner-approved new-enquiry offer', () => {
  const sources = ['academy/index.html', 'academy/programmes/index.html', 'academy/courses/index.html', 'academy/a2/index.html', 'academy/a2/quiz.js', 'start/index.html'];
  for (const path of sources) {
    const src = read(path);
    assert.match(src, /1 000 Kč/, path);
    assert.doesNotMatch(src, /690 Kč/, path);
  }
  for (const path of ['academy/index.html', 'academy/programmes/index.html', 'start/index.html', 'corporate/index.html']) {
    const src = read(path);
    assert.match(src, /250 Kč/, path);
    assert.doesNotMatch(src, /200 Kč/, path);
  }
  const catalog = read('academy/academy-service-catalog.js');
  assert.match(catalog, /amount=1000;exact=true;mode='STANDARD_LESSON'/);
  assert.doesNotMatch(catalog, /amount=690/);
  assert.match(read('academy/academy-choice-v4.js'), /1 000 Kč \/ 60 min/);
  assert.match(read('academy/academy-choice-v4.js'), /250 Kč \/ 15 min/);
  assert.match(read('index.html'), /consultCta:'15-minute service-choice call · 250 Kč/);
});

test('Czech main content is visible before JS; English remains a separately selectable language', () => {
  const start = read('start/index.html');
  const programmes = read('academy/programmes/index.html');
  assert.match(start, /data-locale="en" lang="en" hidden/);
  assert.match(start, /data-locale="cs" lang="cs">/);
  assert.match(programmes, /data-locale="en" lang="en" hidden/);
  assert.match(programmes, /data-locale="cs" lang="cs">/);
  assert.match(start, /new URLSearchParams\(location.search\)/);
  assert.match(programmes, /params.get\("lang"\)\|\|"cs"/);
});

test('important programme and course pages are in one canonical public sitemap', () => {
  const sitemap = read('sitemap.xml');
  for (const slug of ['academy/programmes/', 'academy/courses/', 'corporate/', 'walkers/', 'druzina/', 'start/']) {
    assert.ok(sitemap.includes('<loc>https://aliaksei-chareshneu.github.io/alchareshneu/' + slug + '</loc>'), slug);
  }
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(locs.length, new Set(locs).size, 'duplicate sitemap URLs');
  assert.doesNotMatch(read('about/index.html'), /hreflang="cs" href="[^"]+\?lang=cs"/);
});
