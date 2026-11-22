'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('regular HEMA shows the fixed Dukelska meeting point in all four languages', () => {
  const window = {};
  const js = fs.readFileSync('register/event-i18n.js', 'utf8');
  vm.runInNewContext(js, { window }, { timeout: 2000 });
  const localize = window.ImperionEventI18n;
  for (const eventId of ['PUB-HEMA-20261123', 'PUB-HEMA-20261128', 'PUB-HEMA-20261130', 'PUB-HEMA-20261207']) {
    for (const lang of ['cs', 'en', 'ru', 'uk']) {
      const place = localize.venue({
        event_id: eventId,
        venue: 'Nová Zbrojovka, Brno (точка не подтверждена)'
      }, lang);
      assert.match(place, /Dukelská třída 157\\/44/);
      assert.doesNotMatch(place, /Nová Zbrojovka|unconfirmed|nepotvrzeno|не подтверждена/i);
    }
  }
  // A different activity at Nová Zbrojovka must not be silently relocated.
  assert.match(localize.venue({
    event_id: 'PUB-MVP-CALI-20261124',
    venue: 'Nová Zbrojovka, Brno — přesný sraz po potvrzení'
  }, 'en'), /Nová Zbrojovka/);
});

test('landing pages use Dukelska for the meeting point and retain honest payment gate', () => {
  for (const path of ['druzina/index.html', 'druzina/start/index.html']) {
    const html = fs.readFileSync(path, 'utf8');
    assert.match(html, /Dukelská třída 157\\/44/);
  }
  for (const lang of ['','en/','ru/','uk/']) {
    const html=fs.readFileSync('register/'+lang+'index.html','utf8');
    assert.match(html, /bez soukromého kódu/);
    assert.match(html, /paymentProofField[^>]*class="field" hidden/);
  }
  const api=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
  assert.match(api, /payment_not_open/);
  assert.match(api, /bankVerified:false/);
});
