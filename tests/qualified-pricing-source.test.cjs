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

test('Academy shows current standard rate but no fixed specialist 1000-CZK tutoring offer', () => {
  const academy = read('academy/index.html');
  const courses = read('academy/courses/index.html');
  const programmes = read('academy/programmes/index.html');
  for (const html of [academy,courses,programmes]) assert.match(html, /690 Kč/);
  assert.doesNotMatch(academy, /(?:specialist lessons|specializovaná|специализированный|спеціалізоване)[^<]{0,55}1[ ,]?000 Kč/i);
  assert.doesNotMatch(courses, /1[ ,]?000 Kč/);
  assert.doesNotMatch(programmes, /(?:specialist individual coaching:|specializovaná individuální lekce:|специализированное:|спеціалізоване:)\s*1[ ,]?000 Kč/i);
  assert.match(academy, /Compare a like-for-like offer/);
  assert.match(courses, /no automatic discount promise/);
  assert.match(programmes, /10-minute service-selection consultation is 200 Kč/);
  assert.doesNotMatch(programmes, /15-minute service-selection consultation is 250 Kč/);
});

test('A2 learning page and translated dynamic results use written specialist quote', () => {
  for (const path of ['academy/a2/index.html','academy/a2/quiz.js']) {
    const src = read(path);
    assert.match(src, /690 Kč/);
    assert.doesNotMatch(src, /1[ ,]?000 Kč/);
    assert.match(src, /písemn|written|письменн|письмов/i);
  }
});

test('first-tutoring CTA has no retired 300-CZK price or prefilled 300-CZK claim', () => {
  const start = read('start/index.html');
  assert.doesNotMatch(start, /300 Kč|300%20(?:CZK|K%C4%8D)/i);
  assert.match(start, /690 Kč \/ 60/);
  assert.match(start, /сопоставим|srovnatel|Compare tutors fairly/);
});

test('historical and association offers remain distinct from personal tutoring', () => {
  const club = read('druzina/permanentky/index.html');
  const walkers = read('walkers/index.html');
  assert.match(club, /240 Kč/);
  assert.match(club, /120 Kč/);
  assert.match(club, /800 Kč/);
  assert.match(walkers, /450 Kč/);
  assert.match(walkers, /490 Kč/);
});
