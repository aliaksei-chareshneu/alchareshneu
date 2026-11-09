'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../ops/imperion-growth-policy.cjs');
const at='2026-11-08T15:35:00+01:00';
const iso=s=>s==='2026-11-14 12:00'?'2026-11-14T11:00:00.000Z':null;
function snapshot(status='CONFIRMED') {return {schema_version:1,source_system:'EXISTING_IMPERION_HUB',snapshot_id:'pilot-20261108',captured_at:at,data:{Events:[{
  Event_ID:'PUB-OREL-20261114',Status:status,Title:'Beginners HEMA workshop',Start_DateTime:'2026-11-14 12:00',
  Location_Name:'Orlovna Husovice',Price_CZK:'0',Data_Controller:'Družina Moravy z.s.',
  Tally_Form_URL:'https://aliaksei-chareshneu.github.io/alchareshneu/register/?event=PUB-OREL-20261114'}],
  SocialPublishing:[{Job_ID:'OLD-POST',Event_ID:'PUB-OREL-20261114',Status:'PUBLISHED_VERIFIED',Rights_OK:'YES'},
    {Job_ID:'BLOCKED-METRICOOL',Event_ID:'PUB-OREL-20261114',Status:'ERROR_METRICOOL_ACCOUNT_LIMIT_NOT_LIVE'}]}}}
const approved={state:'ACTIVE',owner_authority_verified:true,approval_ref:'GO-CURRENT-20261108',
  valid_from:'2026-11-08T00:00:00+01:00',valid_until:'2026-11-20T00:00:00+01:00',
  entity:'DRUZINA_MORAVY_ZS',accounts:['owned-page-001'],channels:['facebook_page'],
  content_types:['EVENT_INFO'],languages:['cs'],max_posts_per_24h:1};
const request={entity:'DRUZINA_MORAVY_ZS',account_id:'owned-page-001',channel:'facebook_page',content_type:'EVENT_INFO',language:'cs',cost_czk:0};
const evidence={provider_posts_last_24h:0,facts_fresh:true,venue_verified:true,capacity_verified:true,
  rights_verified:true,publisher_connected:true,recent_posts_reconciled:true,cta_form_verified:true,
  legal_entity_verified:true,grant_terms_verified:true,unresolved_provider_jobs:0,
  safe_capacity:30,confirmed_persons:5,promised_places:2,pending_requests:0};
test('existing confirmed event discovered without pretending seats, copyright or publication',()=>{
  const r=G.review(snapshot(),iso);assert.equal(r.total,1);const a=r.candidates[0];
  assert.equal(a.event_id,'PUB-OREL-20261114');assert.equal(a.legal_entity,'DRUZINA_MORAVY_ZS');assert.equal(a.observed_posts,1);
  assert.equal(a.unsettled_posts,1);assert.equal(a.auto_post,false);
  assert.ok(a.blockers.includes('safety_capacity'));
  assert.ok(a.blockers.includes('EXISTING_POST_DEDUP_AND_RECENCY_CHECK'));
  assert.ok(a.blockers.includes('UNSETTLED_PROVIDER_POST_RECONCILIATION'));
  assert.equal(r.public_posts_created,0);
});
test('actual Hub ACTIVE event is discovered but requires independent confirmation',()=>{
  const r=G.review(snapshot('ACTIVE'),iso);assert.equal(r.total,1);
  assert.ok(r.candidates[0].blockers.includes('ACTIVE_NOT_INDEPENDENTLY_CONFIRMED'));
  assert.equal(r.candidates[0].auto_post,false);
});
test('cancelled and draft events cannot become campaigns',()=>{
  for(const status of ['CANCELLED','DRAFT','TENTATIVE'])assert.equal(G.review(snapshot(status),iso).total,0);
});
test('standing GO is deny-by-default and never confers publishing credentials',()=>{
  assert.equal(G.standingGo(null,request,evidence,at).code,'NO_VERIFIED_STANDING_GO');
  assert.equal(G.standingGo({...approved,revoked:true},request,evidence,at).code,'STOP_OR_REVOKED');
  assert.equal(G.standingGo(approved,{...request,account_id:'different'},evidence,at).code,'CHANNEL_ACCOUNT_NOT_APPROVED');
  assert.equal(G.standingGo(approved,request,{...evidence,capacity_verified:false},at).code,'SOURCE_PROVIDER_OR_SAFETY_GATE');
  assert.equal(G.standingGo(approved,request,{...evidence,provider_posts_last_24h:null},at).code,'QUOTA_OR_POST_COUNT_UNKNOWN');
  assert.equal(G.standingGo(approved,{...request,cost_czk:5},evidence,at).code,'COST_PRIVACY_OR_OUTBOUND_BLOCK');
  assert.equal(G.standingGo(approved,request,{...evidence,kill_switch:true},at).code,'STOP_OR_REVOKED');
  const allow=G.standingGo(approved,request,evidence,at);
  assert.equal(allow.decision,'POLICY_ELIGIBLE_ONLY');assert.equal(allow.may_publish,false);
});
test('real-like comment routing creates no replies and sends qualified requests to agent4 without PII',()=>{
  const base={platform:'facebook',account_id:'owned-page-001',post_url:'https://www.facebook.com/posts/123',
    provider_readback:true,comment_id:'c-1'};
  const q=G.classifyComment({...base,text:'Jsem začátečník, můžu se učit?'});
  assert.equal(q.route,'FAQ_DRAFT_FOR_APPROVAL');assert.equal(q.automatic_reply,false);
  const p=G.classifyComment({...base,text:'Есть ли свободные места? Вот моя почта user@example.com'});
  assert.equal(p.route,'AGENT4_PRIVATE_TRIAGE');assert.equal(p.contains_personal_data,true);
  const h=G.handoff({...base,text:'user@example.com'},p);
  assert.equal(h.destination,'EXISTING_CRM_INTAKE_AGENT4');assert.equal(h.crm_write_performed,false);
  assert.equal(h.reply_sent,false);assert.equal(h.payment_verified,false);
  assert.equal(JSON.stringify(h).includes('user@example.com'),false);
  assert.equal(h.handoff_key,G.handoff({...base},p).handoff_key);
  assert.equal(G.classifyComment({...base,provider_readback:false,text:'Price?'}).route,'HOLD_PROVIDER_READBACK');
});

test('unknown provider and manual HOLD states are unresolved, never erased',()=>{
 const p=snapshot();p.data.SocialPublishing.push(
  {Job_ID:'M-1',Event_ID:'PUB-OREL-20261114',Status:'HOLD_SAFETY_CAPACITY__READY_MANUAL_ONLY__NOT_LIVE'},
  {Job_ID:'M-2',Event_ID:'PUB-OREL-20261114',Status:'RULES_OR_ACCESS_GATE__NOT_POSTED'},
  {Job_ID:'M-3',Event_ID:'PUB-OREL-20261114',Status:'PUBLISHED_PROVIDER_CONFIRMED'});
 const e=G.review(p,iso).candidates[0];
 assert.equal(e.existing_social_jobs,5);
 assert.equal(e.unsettled_posts,4);
 assert.ok(e.blockers.includes('UNSETTLED_PROVIDER_POST_RECONCILIATION'));
 assert.ok(e.blockers.includes('source_rights'));
});
test('past post rights cannot be recycled and a mismatched registration link is rejected',()=>{
 const p=snapshot();
 p.data.Events[0].Tally_Form_URL='https://aliaksei-chareshneu.github.io/alchareshneu/register/?event=SOME_OTHER_EVENT';
 const e=G.review(p,iso).candidates[0];
 assert.ok(e.blockers.includes('registration'));
 assert.ok(e.blockers.includes('source_rights'));
 assert.equal(e.auto_post,false);
});
test('capacity must be verified in numbers: no invitations with missing cap, full cap or unresolved requests',()=>{
 const missing={...evidence};
 delete missing.safe_capacity;
 assert.equal(G.standingGo(approved,request,missing,at).code,'CAPACITY_NUMBERS_MISSING');
 assert.equal(G.standingGo(approved,request,{...evidence,safe_capacity:7},at).code,'CAPACITY_NOT_OPEN_FOR_NEW_INVITATIONS');
 assert.equal(G.standingGo(approved,request,{...evidence,pending_requests:1},at).code,'CAPACITY_NOT_OPEN_FOR_NEW_INVITATIONS');
 assert.equal(G.standingGo(approved,request,{...evidence,unresolved_provider_jobs:1},at).code,'UNRESOLVED_EXISTING_POSTS');
 const ok=G.standingGo(approved,request,evidence,at);
 assert.equal(ok.decision,'POLICY_ELIGIBLE_ONLY');
 assert.equal(ok.may_publish,false);
});
test('public comment source URL strips PII query and rejects fake hosts and unverified readback',()=>{
 const base={platform:'facebook',account_id:'owned-page-001',comment_id:'c-28',
  post_url:'https://www.facebook.com/posts/123?email=leak%40example.com#p',
  provider_readback:true,text:'How can I book?'};
 const cl=G.classifyComment(base);
 const h=G.handoff(base,cl);
 assert.equal(cl.route,'AGENT4_PRIVATE_TRIAGE');
 assert.equal(h.source_post_url,'https://www.facebook.com/posts/123');
 assert.equal(JSON.stringify(h).includes('leak%40example.com'),false);
 const bad={...base,post_url:'https://facebook.com.evil.test/posts/123'};
 assert.equal(G.classifyComment(bad).route,'HOLD_PROVIDER_READBACK');
 assert.equal(G.handoff(bad,cl),null);
 assert.equal(G.handoff({...base,provider_readback:false},cl),null);
});
