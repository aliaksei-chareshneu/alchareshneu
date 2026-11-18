'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sandbox = {window:{}};
vm.runInNewContext(read('register/event-i18n.js'), sandbox, {filename:'register/event-i18n.js'});
const locale = sandbox.window.ImperionEventI18n;

const cases = [
  ['Družina — техника и тактика (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Družina — групповой бой и строй (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Družina — техника и работа в паре (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Družina — сценарии и тактика (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Družina — групповой бой (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Družina — техника (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Družina — сценарии (план)', 'Nová Zbrojovka, Brno (точка не подтверждена)', 'HEMA Training'],
  ['Advanced HEMA — workshop I (площадка не подтверждена)', 'Brno, площадка подбирается (MENDELU B1/B2 недоступны)', 'Workshop'],
  ['BrnoWalkers — Brno Mysteries & Christmas Lights (29 Nov)', 'Outside Měnínská brána, Měnínská 7, Brno', 'Guided Walk'],
  ['BrnoWalkers — Obřany → Bílovice nad Svitavou | Free community hike', 'Brno hlavní nádraží — main entrance', 'Hike']
];

test('catalogue titles and venues do not leak Cyrillic into Czech or English', () => {
  for(const [title,venue,category] of cases) {
    const event = {title,venue,category,community:'Družina Moravy'};
    for(const language of ['cs','en']) {
      const shown = locale.title(event,language) + ' ' + locale.venue(event,language);
      assert.doesNotMatch(shown,/[\u0400-\u052f]/u, language + ': ' + title);
      assert.ok(shown.length>15);
    }
  }
});

test('new unknown Russian catalogue items receive an explicit neutral label', () => {
  const e={title:'Непереведённое событие',venue:'Неподтверждённое место',community:'Družina Moravy'};
  assert.doesNotMatch(locale.title(e,'cs')+' '+locale.venue(e,'cs'),/[\u0400-\u052f]/u);
  assert.doesNotMatch(locale.title(e,'en')+' '+locale.venue(e,'en'),/[\u0400-\u052f]/u);
});

test('booking notice is localized without changing the underlying event ID', () => {
  const e={event_id:'PUB-WALK-20261129',public_note:'29 Nov 15:30; 190 Kč per person.',title:'BrnoWalkers — Brno Mysteries & Christmas Lights (29 Nov)'};
  assert.match(locale.note(e,'cs'),/190 Kč/);
  assert.match(locale.note(e,'en'),/non-binding request/);
  assert.equal(e.event_id,'PUB-WALK-20261129');
});

test('registration pages load the catalogue language module before calendar JS', () => {
  for (const page of ['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html']) {
    const html=read(page);
    assert.ok(html.includes('event-i18n.js'),page);
    assert.ok(html.indexOf('event-i18n.js') < html.indexOf('event-calendar.js'),page);
    assert.ok(html.includes('eventTitle(e)'),page);
    assert.ok(html.includes('eventVenue(e)'),page);
  }
});

test('homepage and public calendar also use the shared language dictionary', () => {
  assert.match(read('index.html'),/register\/event-i18n\.js/);
  assert.match(read('conversion-frontdoor.js'),/ImperionEventI18n\?\.title/);
  assert.match(read('calendar/index.html'),/register\/event-i18n\.js/);
  assert.match(read('calendar/index.html'),/localize\.title\(source,lang\)/);
});
