'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eligible,build}=require('../scripts/imperion-autopilot.cjs');
const future='2035-11-14T11:00:00.000Z';
function event(overrides={}){
  return {event_id:'PUB-HIKE-20351114',title:'Community autumn hike',community:'BrnoWalkers',
    category:'Hike',begins_at:future,ends_at:'2035-11-14T14:00:00Z',
    venue:'Velká Klajdovka, Brno',price_czk:0,public_note:'Free event, nonbinding RSVP; organiser confirms each place',
    registration_mode:'FORM',is_open:true,price_verified:true,
    end_time_verified:true,source_active:true,...overrides};
}
test('only server-open, currently future, confirmed metadata is promoted',()=>{
  assert.equal(eligible(event(),Date.parse('2035-01-01')),true);
  for(const fail of [{is_open:false},{registration_mode:'PLANNED'},{source_active:false},
    {price_verified:false},{end_time_verified:false},{event_id:'../../etc/passwd'},
    {venue:'Nová Zbrojovka (не подтверждено)'},{title:'HEMA Training (план)'},
    {price_czk:null},{begins_at:'2020-01-01T00:00:00Z'}]){
    assert.equal(eligible(event(fail),Date.parse('2035-01-01')),false,JSON.stringify(fail));
  }
});
test('calendar tentative labels and unconfirmed public notes cannot be promoted',()=>{
  const now=Date.parse('2035-01-01T00:00:00Z');
  for(const e of [
    event({title:'Walk & Talk (PŘEDBĚŽNÉ / TENTATIVE)'}),
    event({public_note:'PŘEDBĚŽNÝ ZÁJEM, NE POTVRZENÁ AKCE / INTEREST ONLY, NOT A CONFIRMED EVENT'}),
    event({venue:'Místo nepotvrzeno, Brno'}),
    event({title:'Training planned; venue under review'}),
  ])assert.equal(eligible(e,now),false,e.title);
});

test('real 14 Nov event stops public campaign at the verified 1 Nov 23:59 deadline',()=>{
  const orel=event({
    event_id:'PUB-OREL-20261114',
    title:'FREE Beginner HEMA Workshop — Orel Husovice | Morava v pohybu',
    begins_at:'2026-11-14T11:00:00Z',ends_at:'2026-11-14T13:30:00Z',
    venue:'Orlovna Husovice',public_note:'Personal organiser confirmation required',
  });
  const until=Date.parse('2026-11-01T22:59:59Z');
  const after=Date.parse('2026-11-01T23:00:00Z');
  assert.equal(eligible(orel,until),true);
  assert.equal(eligible(orel,after),false);
  const out=build({events:[orel],bookingConfirmed:false},after);
  assert.equal(out.feed.events.length,0);
  assert.equal(out.drafts.drafts.length,0);
});

test('catalog-supplied cutoff takes precedence, malformed dates fail closed',()=>{
  const now=Date.parse('2035-01-01T12:00:00Z');
  assert.equal(eligible(event({registration_closes_at:'2035-01-01T12:01:00Z'}),now),true);
  assert.equal(eligible(event({registration_closes_at:'2035-01-01T11:59:00Z'}),now),false);
  for(const wrong of ['2035-01-02','tomorrow','2035-01-02T12:00:00'])
    assert.equal(eligible(event({registration_closes_at:wrong}),now),false);
});

test('publication queue is review-only without public links or private CRM data',()=>{
  const output=build({events:[event()],bookingConfirmed:false},Date.parse('2035-01-01'));
  assert.equal(output.feed.events.length,1);
  assert.equal(output.drafts.drafts.length,1);
  assert.equal(output.drafts.drafts[0].status,'HOLD_FOR_MANUAL_APPROVAL');
  assert.equal(output.drafts.drafts[0].posted,false);
  assert.equal(output.drafts.drafts[0].published_url,null);
  assert.equal(output.drafts.drafts[0].direct_public_links,false);
  assert.doesNotMatch(output.drafts.drafts[0].text_cs,/https?:\/\//);
  assert.match(output.feed.events[0].registration_url,/\/register\/\?event=PUB-HIKE-/);
});
test('malformed or duplicated public catalog fails closed',()=>{
  assert.throws(()=>build({events:[event()],bookingConfirmed:true},Date.parse('2035-01-01')));
  assert.throws(()=>build({events:[event(),event()],bookingConfirmed:false},Date.parse('2035-01-01')),/Duplicate event id/);
});

test('owned campaigns and RSS are generated from verified events, escaped and require personal confirmation',()=>{
  const {renderCampaigns,renderRss}=require('../scripts/imperion-autopilot.cjs');
  const e=event({title:'Brno autumn <script>alert("x")</script> hike'});
  const feed=build({events:[e],bookingConfirmed:false},Date.parse('2035-01-01')).feed;
  const html=renderCampaigns(feed),rss=renderRss(feed);
  assert.match(html,/data-autopilot="owned-campaigns-v1"/);
  assert.match(html,/brand-theme\.css\?v=20261028/);
  assert.match(html,/site-design\.css\?v=20261027/);
  assert.doesNotMatch(html,/<script>alert/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/Nezávazně se přihlásit/);
  assert.match(html,/Přihláška je nezávazná/);
  assert.match(rss,/<rss version="2.0">/);
  assert.match(rss,/&lt;script&gt;/);
  assert.doesNotMatch(rss,/<script>/);
  assert.equal((rss.match(/<item>/g)||[]).length,1);
});
test('unverified forms are absent from own site campaign feed and RSS',()=>{
 const {renderCampaigns,renderRss}=require('../scripts/imperion-autopilot.cjs');
 const feed=build({events:[event({title:'Workshop (план)'})],bookingConfirmed:false},Date.parse('2035-01-01')).feed;
 assert.equal(feed.events.length,0);
 assert.doesNotMatch(renderCampaigns(feed),/Workshop \(план\)/);
 assert.doesNotMatch(renderRss(feed),/<item>/);
});

test('raw HTML and RSS must not be JSON-encoded before publishing',()=>{
 const {serializeOutput,renderCampaigns,renderRss}=require('../scripts/imperion-autopilot.cjs');
 const feed=build({events:[event()],bookingConfirmed:false},Date.parse('2035-01-01')).feed;
 assert.ok(serializeOutput(renderCampaigns(feed)).startsWith('<!doctype html>'));
 assert.ok(serializeOutput(renderRss(feed)).startsWith('<?xml version="1.0"'));
 assert.ok(serializeOutput(feed).startsWith('{\n'));
 assert.doesNotMatch(serializeOutput(renderRss(feed)).slice(0,20),/^"/);
});
