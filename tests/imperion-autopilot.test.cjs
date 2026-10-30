'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eligible,build}=require('../scripts/imperion-autopilot.cjs');
const future='2035-11-14T11:00:00.000Z';
function event(overrides={}){
  return {event_id:'PUB-HIKE-20351114',title:'Community autumn hike',community:'BrnoWalkers',
    category:'Hike',begins_at:future,ends_at:'2035-11-14T14:00:00Z',
    venue:'Velká Klajdovka, Brno',price_czk:0,public_note:'Interest only',
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
