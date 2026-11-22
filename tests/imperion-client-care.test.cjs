'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const care=require('../ops/imperion-client-care.cjs');
const agent=require('../ops/imperion-agent-team.cjs');
const at='2026-11-20T19:00:00+01:00';
const base=()=>({schema_version:1,source_system:'EXISTING_IMPERION_HUB',
  snapshot_id:'safe-client-care-synthetic',captured_at:at,
  data:{Leads:[],Revenue_Actions:[],SocialPublishing:[],Events:[],IMPERION_Agent_Jobs:[],ShortFactory:[],
    Druzina_Enrollment_Pipeline:[]}});
const row=(id,more={})=>({Lead_ID:id,Stage:'Active',Action_Status:'OWNER_REVIEW',
  'Коммерческий допуск — REVIEW / HOLD / STOP':'REVIEW',
  Next_Action_At:'20.11.2026 18:00',...more});

test('only authorized canonical private snapshot is accepted',()=>{
  const x=base();
  assert.equal(care.review(x).state,'OWNER_REVIEW_ONLY');
  assert.equal(care.review({...x,source_system:'NEW_SALES_CRM'}).state,'INVALID_OR_UNAUTHORIZED_SNAPSHOT');
  assert.equal(care.review({...x,captured_at:'20.11.2026 19:00'}).state,'INVALID_OR_UNAUTHORIZED_SNAPSHOT');
  assert.equal(care.review({...x,data:{Leads:{}}}).state,'INVALID_LEADS_SNAPSHOT');
});
test('owner due action is identified but NEVER sent, booked or counted as cash',()=>{
  const x=base();x.data.Leads=[row('LEAD-A',{
    Email:'not-to-expose@example.invalid',Notes:'Private medical information no output',
    Paid_CZK:5000,Sessions_Remaining:1,Renewal_At:'20.11.2026 17:00',
    Service_Review_At:'20.11.2026 18:30',Client_Care_Action:'Call about private matters'})];
  const r=care.review(x);
  assert.equal(r.queue_total,1);
  assert.equal(r.queue[0].purpose,'RENEWAL_OWNER_REVIEW');
  assert.equal(r.queue[0].paid_czk_status,'CRM_CLAIM_NOT_BANK_VERIFIED');
  assert.equal(r.queue[0].contact_allowed,false);
  assert.equal(r.queue[0].automatic_message,false);
  assert.equal(r.external_actions,0);
  assert.equal(r.payments_verified,0);
  assert.equal(r.ngo_contacts_used,0);
  assert.doesNotMatch(JSON.stringify(r),/not-to-expose|Private medical|Call about private/);
});
test('no follow-up before explicit due date: quiet until due',()=>{
  const x=base();x.data.Leads=[row('LEAD-B',{Next_Action_At:'21.11.2026 18:00'})];
  const r=care.review(x);
  assert.equal(r.queue_total,0);
  assert.equal(r.counts.future_quiet,1);
});
test('opt-out, stopped aliases and same-contact duplicates do not leak into review queue',()=>{
  const x=base();x.data.Leads=[
    row('LEAD-C',{Email:'alias@example.invalid'}),
    row('LEAD-D',{Email:'alias@example.invalid',Action_Status:'CLOSED_NO_OUTREACH'}),
    row('LEAD-E',{Action_Status:'STOP_OUTBOUND'}),
    row('LEAD-F',{Action_Status:'WAIT_INBOUND_NO_CHASE'}),
    row('LEAD-G',{Source:'TEST_FIXTURE'}),
  ];
  const r=care.review(x);
  assert.equal(r.queue_total,0);
  assert.equal(r.counts.stopped_or_alias,3);
  assert.equal(r.counts.no_chase,1);
  assert.equal(r.counts.qa_excluded,1);
});
test('repeating a Lead_ID creates at most one owner item',()=>{
  const x=base();x.data.Leads=[row('LEAD-H'),row('LEAD-H')];
  const r=care.review(x);
  assert.equal(r.queue_total,1);
  assert.equal(r.counts.duplicate,1);
});

test('typed Sheets opt-outs and contradictory aliases always suppress owner sales queue',()=>{
  for(const fields of [{Opt_Out:true},{Do_Not_Contact:1},
    {Opt_Out:'',Do_Not_Contact:'YES'},{Opt_Out:false,Do_Not_Contact:true}]){
    const x=base();x.data.Leads=[row('LEAD-OPT',{Email:'same@example.invalid',...fields}),
      row('LEAD-ALIAS',{Email:'same@example.invalid'})];
    const r=care.review(x);
    assert.equal(r.queue_total,0);assert.equal(r.counts.stopped_or_alias,2);
  }
});

test('explicit non-OSVC controller in Leads is held instead of relabelled',()=>{
  for(const fields of [{Legal_Entity:'DRUZINA_MORAVY_ZS'},
    {legal_entity:'JRDM'},{Data_Controller:'PERSONAL'},
    {Legal_Entity:'OSVC',Data_Controller:'DRUZINA_MORAVY_ZS'}]){
    const x=base();x.data.Leads=[row('LEAD-WRONG',fields)];
    const r=care.review(x);
    assert.equal(r.queue_total,0);assert.equal(r.counts.controller_conflict,1);
    assert.equal(r.external_actions,0);
  }
});
test('commercial HOLD is visible as owner check, never auto messaging approval',()=>{
  const x=base();x.data.Leads=[row('LEAD-I',{
    'Коммерческий допуск — REVIEW / HOLD / STOP':'HOLD — check lawful history'})];
  const r=care.review(x);
  assert.equal(r.queue[0].state,'HOLD_VERIFY_OWNER_BASIS');
  assert.equal(r.queue[0].external_send_go_required,true);
  assert.equal(r.queue[0].message_channel,'NOT_VERIFIED');
});
test('unknown text deadlines and date-only fields do not become fabricated reminders',()=>{
  const x=base();x.data.Leads=[
    row('LEAD-J',{Next_Action_At:'Next week after reply, send a quote'}),
    row('LEAD-K',{Next_Action_At:'21.11.2026'}),
    row('LEAD-L',{Next_Action_At:'25.10.2026 02:30'}),
    row('LEAD-M',{Next_Action_At:'29.03.2026 02:30'})
  ];
  const r=care.review(x);
  assert.equal(r.queue_total,0);
  assert.equal(r.counts.missing_or_unparseable_deadline,4);
});
test('Czech local datetime is Prague-aware and rejects DST ambiguity',()=>{
  assert.equal(care.dueAt('20.11.2026 19:00'),'2026-11-20T18:00:00.000Z');
  assert.equal(care.dueAt('01.07.2026 12:00'),'2026-07-01T10:00:00.000Z');
  assert.equal(care.dueAt('25.10.2026 02:30'),null);
  assert.equal(care.dueAt('29.03.2026 02:30'),null);
  assert.equal(care.dueAt('30.02.2026 12:00'),null);
  assert.equal(care.explicitTime('2026-02-30T12:00:00+01:00'),null);
});
test('no automated chase after >=2 actions for inactive lead',()=>{
  const x=base();x.data.Leads=[row('LEAD-N',{Stage:'Contacted',Followup_Count:2})];
  const r=care.review(x);
  assert.equal(r.queue_total,0);
  assert.equal(r.counts.no_chase,1);
});
test('NGO membership must never be folded into OSVC sales',()=>{
  const x=base();x.data.Druzina_Enrollment_Pipeline=[
    {Lead_ID:'DM-001',Stage:'REGISTERED_PERSONAL_PLACE_CONFIRMED',Due_Date:'20.11.2026 18:00'}];
  const r=care.review(x);
  assert.equal(r.queue_total,0);
  assert.equal(r.ngo_commercial_cross_sell,false);
  assert.equal(r.ngo_contacts_used,0);
});
test('existing five-function preview includes only an owner-review client care projection',async()=>{
  const x=base();x.data.Leads=[row('LEAD-P')];
  const r=await agent.runAll(x);
  assert.equal(r.client_care.queue_total,1);
  assert.equal(r.client_care.external_actions,0);
  assert.equal(r.mode,'READ_ONLY_PREVIEW');
  assert.equal(r.external_messages_sent,0);
  assert.equal(r.new_crm_records,0);
});

// A large existing Leads backlog must not disappear behind the first 50 owner cases.
test('pagination must expose every due case with no sending, duplicates or PII',()=>{
  const x=base();x.data.Leads=Array.from({length:117},(_,i)=>
    row('LEAD-PAGED-'+String(i).padStart(3,'0'),{
      Email:'internal'+i+'@example.invalid',
      Notes:'PRIVATE_SHOULD_NEVER_BE_EXPORTED',
    }));
  const p1=care.review(x),p2=care.review(x,{page:2}),p3=care.review(x,{page:3});
  assert.equal(p1.queue_total,117);
  assert.deepEqual([p1.queue.length,p2.queue.length,p3.queue.length],[50,50,17]);
  assert.deepEqual([p1.next_page,p2.next_page,p3.next_page],[2,3,null]);
  assert.deepEqual([p1.queue_page_count,p2.queue_page_count,p3.queue_page_count],[3,3,3]);
  assert.equal(new Set([...p1.queue,...p2.queue,...p3.queue].map(a=>a.lead_id)).size,117);
  for(const page of [p1,p2,p3]){
    assert.equal(page.external_actions,0);
    assert.equal(page.payments_verified,0);
    assert.equal(page.queued_for_sending,0);
    assert.doesNotMatch(JSON.stringify(page),/PRIVATE_SHOULD_NEVER_BE_EXPORTED|example\.invalid/);
  }
});
test('invalid client-care page arguments fail closed and preserve default API',()=>{
  const x=base();x.data.Leads=[row('LEAD-ONE')];
  assert.equal(care.review(x).queue_page,1);
  for(const page of [0,-1,'2',1.5,101,NaN]){
    const r=care.review(x,{page});
    assert.equal(r.state,'INVALID_REVIEW_PAGE');
    assert.equal(r.external_actions,0);
  }
});

test('agent team paginates same private snapshot and remains read-only',async()=>{
  const x=base();x.data.Leads=Array.from({length:52},(_,i)=>row('LEAD-TEAM-'+i));
  const r=await agent.runAll(x,{clientCarePage:2});
  assert.equal(r.client_care.queue_total,52);
  assert.equal(r.client_care.queue_page,2);
  assert.equal(r.client_care.queue.length,2);
  assert.equal(r.client_care.next_page,null);
  assert.equal(r.mode,'READ_ONLY_PREVIEW');
  assert.equal(r.external_messages_sent,0);
  assert.equal(r.new_crm_records,0);
  assert.equal(r.payments_created,0);
});
