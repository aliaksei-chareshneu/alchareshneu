'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {preview,POLICY}=require('../ops/imperion-a6-observe-router.cjs');
const NOW='2026-11-12T19:35:00+01:00';
const TYPES=Object.keys(POLICY);
const mandate={mode:'OBSERVE_ONLY',status:'ACTIVE',owner_approval:'OBSERVE_ONLY',budget_czk:0,
  expires_at:'2026-11-13T19:35:00+01:00',allowed_types:TYPES,
  allowed_subjects:['OSVC','DRUZINA_MORAVY_ZS','RESEARCH_INSTITUTION']};
const base={case_id:'IMPTEST01',source_id:'e0001',event_type:'CODE_REVIEW',source_system:'GITHUB',
  legal_subject:'OSVC',received_at:'2026-11-12T19:34:00+01:00',data_class:'SYNTHETIC',
  requested_action:'READ_ONLY_REVIEW'};
function run(changes={},options={}){return preview({now:NOW,mandate,
  signals:[{...base,...changes}],...options});}
function check(r, verdict, reason){
  assert.equal(r.results[0].verdict,verdict);assert.equal(r.results[0].reason,reason);
  for(const k of ['actions_executed','commands_created','emails_sent','posts_published','deployments','payments'])assert.equal(r[k],0,k);
  assert.equal(r.provider_readback,'NOT_PERFORMED');
}
// Twenty explicit scenarios, one independently reported test each.
test('01 A1 DEV preview routes only to human review',()=>{const x=run();check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A1_DEV');});
test('02 A2 CLOUD health source routes to A2',()=>{const x=run({event_type:'CLOUD_HEALTH',source_system:'SUPABASE'});check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A2_CLOUD');});
test('03 A3 GROWTH rights-reviewed draft routes to A3',()=>{const x=run({event_type:'MEDIA_DRAFT',source_system:'COMMUNITY_HUB'});check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A3_GROWTH');});
test('04 A4 SALES aggregate inbound only, never send',()=>{const x=run({event_type:'SALES_INBOUND',source_system:'COMMUNITY_HUB',data_class:'PRIVATE_AGGREGATE'});check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A4_SALES');});
test('05 A5 PC health never executes a PC command',()=>{const x=run({event_type:'PC_HEALTH',source_system:'WINDOWS_BRIDGE'});check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A5_PC');});
test('06 A6 COO self-health review is not a cron trigger',()=>{const x=run({event_type:'COO_HEALTH',source_system:'SUPABASE'});check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A6_COO');});
test('07 A7 GRANTS keeps NGO as applicant',()=>{const x=run({event_type:'GRANT_SOURCE',source_system:'OFFICIAL_SOURCE',legal_subject:'DRUZINA_MORAVY_ZS'});check(x,'ROUTE_PREVIEW','BOUNDED_OBSERVE_ONLY');assert.equal(x.results[0].role,'A7_GRANTS');});
test('08 repeated signal is deduplicated within one batch',()=>{const e={...base};const x=preview({now:NOW,mandate,signals:[e,{...e}]});assert.equal(x.route_previews,1);assert.equal(x.duplicates,1);assert.equal(x.results[1].reason,'DUPLICATE_DELIVERY');assert.equal(x.commands_created,0);});
test('09 reused source event under different case is conflict',()=>{const x=preview({now:NOW,mandate,signals:[base,{...base,case_id:'IMPTEST02'}]});assert.equal(x.results[1].verdict,'DUPLICATE_NOOP');assert.equal(x.results[1].reason,'IDEMPOTENCY_CONFLICT');assert.equal(x.commands_created,0);});
test('10 existing operator command blocks re-enqueue and asks readback',()=>{const x=run({}, {existing_jobs:[{idempotency_key:'GITHUB:CODE_REVIEW:e0001',state:'DONE'}]});check(x,'EXISTS_READBACK','EXISTING_COMMAND_REQUIRES_READBACK');assert.equal(x.results[0].next,'PROVIDER_READBACK');});
test('11 expired mandate blocks event',()=>{const x=run({}, {mandate:{...mandate,expires_at:'2026-11-12T19:34:59+01:00'}});check(x,'BLOCKED','MANDATE_EXPIRED');});
test('12 missing owner authorization blocks event',()=>{const x=run({}, {mandate:{...mandate,owner_approval:'PENDING'}});check(x,'BLOCKED','MANDATE_NOT_AUTHORIZED');});
test('13 positive paid budget is refused even for read-only event',()=>{const x=run({}, {mandate:{...mandate,budget_czk:1}});check(x,'BLOCKED','MANDATE_NOT_AUTHORIZED');});
test('14 out-of-scope mandate type is refused',()=>{const x=run({}, {mandate:{...mandate,allowed_types:['MEDIA_DRAFT']}});check(x,'BLOCKED','MANDATE_SCOPE_MISMATCH');});
test('15 event from wrong source cannot switch routing lane',()=>{const x=run({source_system:'OFFICIAL_SOURCE'});check(x,'BLOCKED','UNTRUSTED_SOURCE_FOR_ROUTE');});
test('16 OSVC cannot be applicant in NGO grant routing fixture',()=>{const x=run({event_type:'GRANT_SOURCE',source_system:'OFFICIAL_SOURCE',legal_subject:'OSVC'});check(x,'BLOCKED','LEGAL_SUBJECT_MISMATCH');});
test('17 private lead text is refused at metadata boundary',()=>{const x=run({event_type:'SALES_INBOUND',source_system:'COMMUNITY_HUB',data_class:'PRIVATE_AGGREGATE',email:'private@example.invalid'});check(x,'BLOCKED','RAW_PAYLOAD_FORBIDDEN');assert.doesNotMatch(JSON.stringify(x),/private@example/);});
test('18 privileged deploy action is denied even on valid source',()=>{const x=run({requested_action:'DEPLOY'});check(x,'BLOCKED','ACTION_NOT_IN_OBSERVE_ALLOWLIST');});
test('19 stale signal escalates, never automatically retries',()=>{const x=run({received_at:'2026-11-12T17:00:00+01:00'});check(x,'WATCHDOG_REVIEW','STALE_EVENT_REQUIRES_OWNER_REVIEW');assert.equal(x.results[0].next,'ESCALATE_OWNER');});
test('20 unknown event type fails closed',()=>{const x=run({event_type:'UNLISTED_OPERATION'});check(x,'BLOCKED','UNKNOWN_EVENT_TYPE');});
