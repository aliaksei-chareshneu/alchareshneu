// Static regression gate for the IMPERION SEO/AEO entity split.
// Uses built-in Node APIs only; no network calls and no write access.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = 'https://aliaksei-chareshneu.github.io/alchareshneu/';
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const graph = name => {
  const source = read(name);
  const blocks = [...source.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length, name + ': missing JSON-LD');
  return blocks.map(block => JSON.parse(block[1]));
};

test('OSVC and association have distinct stable structured-data identities', () => {
  const home = graph('index.html');
  const person = home.find(item => item['@type'] === 'Person');
  const osvc = home.find(item => item['@type'] === 'ProfessionalService');
  assert.equal(person['@id'], root + '#person');
  assert.equal(osvc['@id'], root + '#osvc');
  assert.equal(osvc.provider['@id'], person['@id']);

  const druzina = graph('druzina/index.html').find(item => item['@type'] === 'SportsOrganization');
  assert.equal(druzina['@id'], root + 'druzina/#organization');
  assert.equal(druzina.legalName, 'Družina Moravy z.s.');
  assert.ok(!Object.hasOwn(druzina, 'provider'), 'The association cannot be a personal OSVC service');
  assert.notEqual(druzina['@id'], osvc['@id']);

  const academy = graph('academy/index.html').find(item => item['@type'] === 'Service');
  const walkers = graph('walkers/index.html').find(item => item['@type'] === 'TouristTrip');
  const corporate = graph('corporate/index.html').find(item => item['@type'] === 'Service');
  const technical = graph('corporate/technical-answers/index.html').find(item => item['@type'] === 'Service');
  for (const [name, value] of Object.entries({academy, walkers, corporate, technical})) {
    assert.equal(value.provider['@id'], root + '#osvc', name + ': wrong legal provider');
    assert.ok(!JSON.stringify(value).includes('#localbusiness'), name + ': legacy mixed identifier');
  }
  assert.equal(corporate['@id'], root + 'corporate/#service');
  assert.equal(technical['@id'], root + 'corporate/technical-answers/#service');
  assert.ok(!JSON.stringify(technical).includes('Družina Moravy'));
  const calendar = graph('calendar/index.html').find(item => item['@type'] === 'CollectionPage');
  assert.deepEqual(calendar.about.map(item => item['@id']), [root + '#osvc', root + 'druzina/#organization']);
});

test('B2B answer-first section is visible in source with 4 localized Q&As', () => {
  const html = read('corporate/technical-answers/index.html');
  const section = html.match(/<section class="section aeo-answers" id="answers"[\s\S]*?<\/section>/);
  assert.ok(section, 'The answer-first content must be crawlable HTML, not JS-only');
  const articleCount = [...section[0].matchAll(/<article class="answer-card">/g)].length;
  assert.equal(articleCount, 4);
  for (let i = 1; i <= 4; i++) {
    assert.ok(section[0].includes('data-t="answerQ' + i + '"'));
    assert.ok(section[0].includes('data-t="answerA' + i + '"'));
  }
  assert.match(section[0], /14 900 Kč/);
  assert.match(section[0], /href="#brief"/);
  const match = html.match(/var aeoTranslations=(\{[^\n]+\});/);
  assert.ok(match, 'Missing four-language source copy');
  const dictionary = JSON.parse(match[1]);
  for (const code of ['cs','en','ru','uk']) {
    assert.ok(dictionary[code].answerTitle);
    assert.ok(dictionary[code].answerCta);
    for (let i = 1; i <= 4; i++) {
      assert.ok(dictionary[code]['answerQ' + i]);
      assert.ok(dictionary[code]['answerA' + i]);
    }
  }
  assert.match(html, /href="\.\.\/request\/\?lang=cs&amp;service=DATA_PILOT/);
  assert.ok(!graph('corporate/technical-answers/index.html').some(item => item['@type'] === 'FAQPage'),
    'Do not promise FAQ rich results');
});

test('Updated crawlable landing pages stay in sitemap', () => {
  const map = read('sitemap.xml');
  for (const uri of ['', 'academy/', 'walkers/', 'druzina/', 'calendar/', 'corporate/', 'corporate/technical-answers/']) {
    const marker = '<loc>' + root + uri + '</loc>';
    const at = map.indexOf(marker);
    assert.ok(at >= 0, 'Missing sitemap entry for ' + uri);
    assert.equal(map.indexOf(marker, at + marker.length), -1, 'Duplicate sitemap entry for ' + uri);
    const after = map.slice(at + marker.length);
    const updated = after.match(/^\s*<lastmod>([^<]+)<\/lastmod>/);
    assert.ok(updated, 'Missing lastmod for ' + uri);
    assert.equal(updated[1], '2026-11-14', 'Review lastmod before merging later');
  }
});
