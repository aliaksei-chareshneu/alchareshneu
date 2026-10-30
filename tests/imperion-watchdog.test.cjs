'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assess}=require('../scripts/imperion-watchdog.cjs');
const now=Date.parse('2035-01-01T00:00:00Z');
function fixture(){
 const ev={event_id:'PUB-HIKE-20351114',title:'Autumn community hike',venue:'Brno park',
  begins_at:'2035-11-14T11:00:00Z',is_open:true,source_active:true,
  registration_mode:'FORM',price_czk:0,price_verified:true,end_time_verified:true};
 const feed={schema:'imperion-public-campaigns-v1',booking_confirmed:false,events:[{event_id:ev.event_id}]};
 const social={schema:'imperion-social-drafts-v1',auto_posting:false,review_required:true,
  drafts:[{event_id:ev.event_id,posted:false,status:'HOLD_FOR_MANUAL_APPROVAL',published_url:null,text_cs:'Come join!'}]};
 const rec=(status,body,headers={})=>({status,body,headers});
 return {home:rec(200,'Vyrazíme spolu?'),
  campaigns:rec(200,'data-autopilot="owned-campaigns-v1" id="PUB-HIKE-20351114"'),
  rss:rec(200,'<rss version="2.0"><item>one</item></rss>'),
  feed:rec(200,JSON.stringify(feed)),drafts:rec(200,JSON.stringify(social)),
  registration:rec(200,'<form id="rsvpForm">'),b2b_form:rec(200,'<form id="request">'),
  rsvp_api:rec(200,JSON.stringify({bookingConfirmed:false,events:[ev]}),
   {'access-control-allow-origin':'https://aliaksei-chareshneu.github.io'}),
  b2b_api:rec(200,JSON.stringify({ok:true,service:'osvc_b2b_intake_v1',
   accepting:true,bookingConfirmed:false,paymentCollected:false})),
  private_bridge:rec(401,'{"error":"unauthorized"}')};
}
test('healthy production and guarded external publishing',()=>{
 const r=assess(fixture(),now);assert.equal(r.ok,true);assert.equal(r.endpoints_checked,10);
 assert.equal(r.third_party_posts,0);
});
test('stale event or unapproved social post is incident',()=>{
 const v=fixture();const api=JSON.parse(v.rsvp_api.body);api.events[0].is_open=false;
 v.rsvp_api.body=JSON.stringify(api);assert.match(assess(v,now).errors.join(','),/unapproved/);
 const w=fixture(),posts=JSON.parse(w.drafts.body);posts.auto_posting=true;
 w.drafts.body=JSON.stringify(posts);assert.match(assess(w,now).errors.join(','),/manual approval/);
});
test('public failures, CORS and accidental private exposure are incidents',()=>{
 const v=fixture();v.home.status=404;v.private_bridge.status=200;
 v.rsvp_api.headers['access-control-allow-origin']='*';
 const r=assess(v,now);assert.equal(r.ok,false);
 assert.match(r.errors.join(','),/home: HTTP 404/);
 assert.match(r.errors.join(','),/private_bridge: HTTP 200/);
 assert.match(r.errors.join(','),/invalid CORS/);
});
