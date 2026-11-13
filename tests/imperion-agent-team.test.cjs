'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const A = require('../ops/imperion-agent-team.cjs');
const at = '2026-10-28T09:00:00+01:00';
function sample() {
  return {
    schema_version:1, source_system:'EXISTING_IMPERION_HUB',
    snapshot_id:'synthetic-no-clients-20261028', captured_at:at,
    data:{
      Leads:[],
      Revenue_Actions:[
        {Lead_ID:'B2B-DEMO-1',Stage:'Warm',Company:'Sample Co',Email:'demo@example.org',
          Next_Action_At:'2026-10-27T10:00:00+01:00',Quoted_CZK:12000,
          Email_History_Check:'UNVERIFIED',Stop_List_Checked:'FALSE'},
        {Lead_ID:'B2B-DEMO-2',Stage:'Lost',Email:'lost@example.org',Quoted_CZK:90000},
        {Lead_ID:'B2B-DEMO-3',Stage:'Open',Email:'blocked@example.org',Opt_Out:'TRUE'},
        {Lead_ID:'B2B-DEMO-4',Stage:'Warm',Email:'demo@example.org',Quoted_CZK:20000}
      ],
      SocialPublishing:[
        {Job_ID:'PUB-SYN-01',Status:'DRAFT',approved_public_snapshot:{
          job_id:'PUB-SYN-01',owner_entity:'OSVC',rights_status:'owned',
          data_classification:'PUBLIC_APPROVED',public_source_approved:true,
          external_ai_approved:false,image_rights_approved:false,
          source_lang:'en',existing_status:'DRAFT',
          source_text:'Synthetic test on 31.10.2026 at 18:00. Fee 350 CZK. https://example.org/test'
        }},
        {Job_ID:'PUB-SYN-02',Status:'DELIVERY_UNVERIFIED'},
        {Job_ID:'PUB-SYN-03',Status:'PUBLISHED_VERIFIED'},
        {Job_ID:'PUB-SYN-02',Status:'DRAFT'}
      ],
      Events:[
        {Event_ID:'DEMO-1',Status:'Confirmed',Starts_At:'2026-10-29T09:00:00+01:00'},
        {Event_ID:'DEMO-2',Status:'Draft',Starts_At:'2026-10-29T09:00:00+01:00'}
      ],
      IMPERION_Agent_Jobs:[
        {Job_ID:'FOLLOWUP-SYN',Status:'OPEN',Due_At:'2026-10-28T08:30:00+01:00'},
        {Job_ID:'DONE-SYN',Status:'DONE',Due_At:'2026-10-27T08:30:00+01:00'}
      ],
      ShortFactory:[
        {job_id:'VID-SYN-1',status:'QUEUED_SAFE_SOURCE',rights_status:'owned',source_sha256:'a'.repeat(64)},
        {job_id:'VID-SYN-2',status:'QUEUED_SAFE_SOURCE',rights_status:'unknown',source_sha256:'b'.repeat(64)}
      ]
    }
  };
}
test('snapshot is bound to existing CRM, not arbitrary private or forged sources',()=>{
  assert.equal(A.validSnapshot(sample()).source_system,'EXISTING_IMPERION_HUB');
  assert.throws(()=>A.validSnapshot({...sample(),source_system:'NEW_CRM'}),/UNVERIFIED_SNAPSHOT_SOURCE/);
  assert.throws(()=>A.validSnapshot({...sample(),captured_at:'2026-10-28'}),/UNVERIFIED_SNAPSHOT_SOURCE/);
  assert.throws(()=>A.validSnapshot({...sample(),schema_version:2}),/INVALID_SNAPSHOT_SCHEMA/);
  assert.throws(()=>A.validSnapshot({...sample(),data:{...sample().data,Events:{}}}),/INVALID_EVENTS_ROWS/);
});
test('rejects bad date, handles explicit offset, does not assume midnight Prague',()=>{
  assert.equal(A.iso('2026-10-28T08:00:00+01:00'),'2026-10-28T07:00:00.000Z');
  assert.equal(A.iso('2026-10-28'),null);
  assert.equal(A.dueState('2026-10-28',at),'DATE_REVIEW');
  assert.equal(A.dueState('2026-10-28T08:59:00+01:00',at),'OVERDUE');
  assert.equal(A.dueState('2026-10-28T09:01:00+01:00',at),'WITHIN_24H');
});
test('actual Hub Start_DateTime accepts unambiguous Prague local hours; blocks DST ambiguity',()=>{
  assert.equal(A.pragueEventIso('2026-10-28 09:00'),'2026-10-28T08:00:00.000Z');
  assert.equal(A.pragueEventIso('2026-07-01 12:00'),'2026-07-01T10:00:00.000Z');
  assert.equal(A.pragueEventIso('2026-10-25 02:30'),null);
  assert.equal(A.pragueEventIso('2026-03-29 02:30'),null);
  assert.equal(A.pragueEventIso('2026-02-30 12:00'),null);
  const x=sample();x.data.Events[0].Starts_At=undefined;
  x.data.Events[0].Start_DateTime='2026-10-29 09:00';
  assert.equal(A.chief(x).next_7_days_events.length,1);
});
test('chief shows urgent but not done tasks and excludes draft events',()=>{
  const out=A.chief(sample());
  assert.equal(out.open_tasks,1);
  assert.equal(out.urgent,1);
  assert.equal(out.priority_tasks[0].id,'FOLLOWUP-SYN');
  assert.deepEqual(out.next_7_days_events.map(e=>e.id),['DEMO-1']);
  assert.equal(out.unread_email,'NOT_CHECKED');
  assert.equal(out.accepted_results,'REQUIRES_RECEIPTS');
});
test('a DONE claim without receipt is surfaced for proof audit, never silently accepted',()=>{
  const x=sample();
  const out=A.chief(x);
  assert.equal(out.open_tasks,1);
  assert.equal(out.claimed_completed_total,1);
  assert.equal(out.claimed_completed_missing_evidence,1);
  assert.deepEqual(out.completed_needing_readback[0],{
    id:'DONE-SYN',status:'DONE',evidence_uri_present:false,
    independent_provider_readback:'NOT_CHECKED',next:'LOCATE_RECEIPT_AND_VERIFY_PROVIDER'
  });
  assert.equal(out.accepted_results,'REQUIRES_RECEIPTS');
});
test('a supplied evidence URL is not independent provider readback',()=>{
  const x=sample();
  x.data.IMPERION_Agent_Jobs[1].Evidence_URI='https://example.org/synthetic-receipt';
  const out=A.chief(x);
  assert.equal(out.claimed_completed_missing_evidence,0);
  assert.equal(out.completed_needing_readback[0].independent_provider_readback,'NOT_CHECKED');
  assert.equal(out.completed_needing_readback[0].next,'VERIFY_PROVIDER_RECORD');
});
test('sales preserves no-contact/closed gates, de-duplicates contacts and never sends',()=>{
  const out=A.sales(sample());
  assert.equal(out.closed_or_opted_out,2);
  assert.equal(out.duplicates_rejected,1);
  assert.equal(out.candidates_total,1);
  assert.equal(out.candidates[0].next,'VERIFY_HISTORY_AND_STOP_LIST');
  assert.equal(out.outbound_sent,0);
  assert.equal(out.cleared_cash,'NOT_CHECKED');
});
test('verified history still requires owner action, never auto-sends',()=>{
  const x=sample();x.data.Revenue_Actions[0].Email_History_Check='VERIFIED';
  x.data.Revenue_Actions[0].Stop_List_Checked='VERIFIED';
  const out=A.sales(x);
  assert.equal(out.candidates[0].next,'OWNER_REVIEW_NEXT_ACTION');
  assert.equal(out.candidates[0].external_message_sent,false);
});
test('social source validation cannot be mistaken for generated content or a post',async()=>{
  const out=await A.social(sample());
  assert.equal(out.jobs[0].state,'SOURCE_VALIDATED_PREVIEW_NOT_RENDERED');
  assert.equal(out.jobs[0].preview_generated,false);
  assert.equal(out.jobs[0].published,false);
  assert.equal(out.jobs[1].state,'NO_AUTORETRY_RECONCILE_PROVIDER');
  assert.equal(out.jobs[2].state,'PROVIDER_READBACK_NEEDED');
  assert.equal(out.jobs[3].state,'DUPLICATE_SOURCE_JOB_ID');
  assert.equal(out.published_by_this_run,0);
});
test('social fails closed if source job id differs or public rights missing',async()=>{
  const x=sample();x.data.SocialPublishing=x.data.SocialPublishing.slice(0,1);
  x.data.SocialPublishing[0].approved_public_snapshot.job_id='WRONG-ID';
  assert.equal((await A.social(x)).jobs[0].state,'SOURCE_JOB_ID_MISMATCH');
  x.data.SocialPublishing[0].approved_public_snapshot.job_id='PUB-SYN-01';
  x.data.SocialPublishing[0].approved_public_snapshot.rights_status='unknown';
  assert.equal((await A.social(x)).jobs[0].state,'SOURCE_RIGHTS_OR_FACT_GATE_BLOCKED');
});
test('existing scheduled/pending records never get requeued even with approved snapshot',async()=>{
  const x=sample();x.data.SocialPublishing=x.data.SocialPublishing.slice(0,1);
  for(const s of ['SCHEDULED_PENDING','PENDING','SCHEDULED','BUFFER_SUBMITTING','ERROR','PUBLISHED','POSTED_UNVERIFIED']){
    x.data.SocialPublishing[0].Status=s;
    const out=await A.social(x);
    assert.equal(out.jobs[0].state,'NO_AUTORETRY_RECONCILE_PROVIDER',s);
    assert.equal(out.published_by_this_run,0);
  }
});
test('live Hub action status and Owner_Approval are recognized without inventing trust',()=>{
  const x=sample();
  x.data.IMPERION_Agent_Jobs[0].Owner_Approval='PENDING';
  assert.equal(A.chief(x).priority_tasks[0].approval,'PENDING');
  x.data.Revenue_Actions[0].Action_Status='CLOSED_NO_MORE_FOLLOWUP';
  assert.equal(A.sales(x).candidates_total,0);
});
test('commercial queue excludes explicit QA synthetic rows from totals and action candidates',()=>{
  const x=sample();
  x.data.Revenue_Actions=[
    {Lead_ID:'REAL-1',Stage:'Warm',Expected_CZK:15000},
    {Lead_ID:'QA-1',Stage:'Warm',Action_Status:'QA_SYNTHETIC_EXCLUDE_FROM_SALES_NO_ORDER_NO_CASH',Expected_CZK:90000},
    {Lead_ID:'FIXTURE-2',Stage:'Warm',Source:'TEST_FIXTURE',Expected_CZK:120000}
  ];
  const out=A.sales(x);
  assert.equal(out.source_rows,3);
  assert.equal(out.qa_only_excluded,2);
  assert.equal(out.candidates_total,1);
  assert.equal(out.candidates[0].id,'REAL-1');
  assert.equal(out.outbound_sent,0);
  assert.equal(out.cleared_cash,'NOT_CHECKED');
});
test('real opt-out blocks every repeated action with same Lead_ID even without email',()=>{
  const x=sample();
  x.data.Revenue_Actions=[
    {Lead_ID:'SAME-1',Stage:'Warm',Expected_CZK:18000},
    {Lead_ID:'SAME-1',Stage:'Do_Not_Contact',Expected_CZK:25000},
    {Lead_ID:'OTHER-2',Stage:'Warm',Expected_CZK:3000}
  ];
  const out=A.sales(x);
  assert.equal(out.closed_or_opted_out,2);
  assert.equal(out.candidates_total,1);
  assert.equal(out.candidates[0].id,'OTHER-2');
});
test('synthetic QA fixture is excluded but cannot poison real contact stop-list',()=>{
  const x=sample();
  x.data.Revenue_Actions=[
    {Lead_ID:'REAL-A',Stage:'Warm',Email:'buyer@example.invalid',Expected_CZK:4000},
    {Lead_ID:'QA-ALIAS',Stage:'Lost',Email:'buyer@example.invalid',
      Source:'QA_SYNTHETIC',Opt_Out:true,Expected_CZK:100000}
  ];
  const out=A.sales(x);
  assert.equal(out.qa_only_excluded,1);
  assert.equal(out.closed_or_opted_out,0);
  assert.equal(out.candidates_total,1);
  assert.equal(out.candidates[0].id,'REAL-A');
});
test('non QA real STOP action blocks all rows for that Lead_ID',()=>{
  const x=sample();
  x.data.Revenue_Actions=[
    {Lead_ID:'REAL-B',Stage:'Warm',Action_Status:'OPEN'},
    {Lead_ID:'REAL-B',Stage:'Warm',Action_Status:'STOP_NO_CONTACT'}
  ];
  const out=A.sales(x);
  assert.equal(out.qa_only_excluded,0);
  assert.equal(out.closed_or_opted_out,2);
  assert.equal(out.candidates_total,0);
});
test('seo audits existing files without publication or external crawl',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imperion-seo-'));
  try{
    fs.mkdirSync(path.join(dir,'corporate'));
    fs.writeFileSync(path.join(dir,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://example.org/sitemap.xml');
    fs.writeFileSync(path.join(dir,'sitemap.xml'),'<loc>https://example.org/alchareshneu/corporate/</loc>');
    fs.writeFileSync(path.join(dir,'index.html'),'<title>Landing page</title>');
    fs.writeFileSync(path.join(dir,'corporate','index.html'),'<title>Corporate services</title><meta name="description" content="Synthetic">');
    const out=A.seo(dir);
    assert.equal(out.total,8);
    assert.equal(out.passed,8);
    assert.equal(out.live_site_crawled,false);
    assert.equal(out.public_code_modified,false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('video examines existing queue only: no rendering or payment',()=>{
  const out=A.video(sample());
  assert.equal(out.eligible_in_supplied_snapshot,1);
  assert.equal(out.clips_rendered,0);
  assert.equal(out.published,0);
  assert.equal(out.actual_source_hashes_checked,false);
});
test('single integrated run: no paid calls, double CRM, customer messages or posting',async()=>{
  const out=await A.runAll(sample());
  assert.equal(out.mode,'READ_ONLY_PREVIEW');
  assert.equal(out.new_crm_records,0);
  assert.equal(out.external_messages_sent,0);
  assert.equal(out.external_posts_published,0);
  assert.equal(out.payments_created,0);
  assert.equal(out.video.eligible_in_supplied_snapshot,1);
});
test('rejects oversize batch rather than hanging',()=>{
  const x=sample();x.data.Leads=Array.from({length:4001},()=>({}));
  assert.throws(()=>A.validSnapshot(x),/INVALID_LEADS_ROWS/);
});


test('optional private closed-loop aggregate is source-only, not bank proof',()=>{
  const x=sample();
  assert.equal(A.closedLoop(x).state,'SOURCE_NOT_ATTACHED');
  x.control_audit={
    schema_version:1,mode:'READ_ONLY_PRIVATE_OWNER_AUDIT',
    source:'EXISTING_IMPERION_COMMUNITY_HUB',checked_at:at,
    counts:{bookings_total:0,booking_confirmed_claims:0,payments_total:2,
      payment_partial_claims:2,payment_verified_claims_unverified_by_provider:0,
      quotes_total:0,agent_jobs_total:3,agent_completed_claims:1,
      completed_claims_without_stored_receipt:1,open_exceptions:21,
      private_personal_name:'SHOULD_NOT_LEAK'},
    hard_gates_unverified:['D18','D26'],
    bank_readback:'NOT_PERFORMED',booking_provider_readback:'NOT_PERFORMED',
    bank_verified_receipts:0,provider_verified_bookings:0,
    provider_verified_agent_completion:0,paid_checkout_release_allowed:false,
    published_or_sent_or_charged:0,new_triggers_or_records:0
  };
  const r=A.closedLoop(x);
  assert.equal(r.state,'PRIVATE_CRM_CLAIMS_REVIEWED');
  assert.equal(r.counts.payment_partial_claims,2);
  assert.equal(r.outstanding_release_gates,2);
  assert.equal(r.bank_verified,false);
  assert.equal(r.paid_checkout_allowed,false);
  assert.equal(r.provider_readback,'NOT_PERFORMED');
  assert.doesNotMatch(JSON.stringify(r),/SHOULD_NOT_LEAK/);
});
test('forged paid, sent, provider or impossible counters fail closed',()=>{
  const x=sample();
  x.control_audit={
    schema_version:1,mode:'READ_ONLY_PRIVATE_OWNER_AUDIT',
    source:'EXISTING_IMPERION_COMMUNITY_HUB',checked_at:at,
    counts:{bookings_total:0,booking_confirmed_claims:0,payments_total:0,
      payment_partial_claims:0,payment_verified_claims_unverified_by_provider:0,
      quotes_total:0,agent_jobs_total:0,agent_completed_claims:0,
      completed_claims_without_stored_receipt:0,open_exceptions:0},
    hard_gates_unverified:[],
    bank_readback:'NOT_PERFORMED',booking_provider_readback:'NOT_PERFORMED',
    bank_verified_receipts:0,provider_verified_bookings:0,
    provider_verified_agent_completion:0,paid_checkout_release_allowed:false,
    published_or_sent_or_charged:0,new_triggers_or_records:0
  };
  assert.equal(A.closedLoop(x).state,'PRIVATE_CRM_CLAIMS_REVIEWED');
  for(const change of [{paid_checkout_release_allowed:true},{bank_verified_receipts:1},
    {bank_readback:'PROVIDER_SUCCEEDED'},{published_or_sent_or_charged:1},
    {counts:{...x.control_audit.counts,payments_total:-1}},
    {checked_at:'2026-11-01'},{hard_gates_unverified:['D18','secret']}]) {
    const bad={...x,control_audit:{...x.control_audit,...change}};
    assert.equal(A.closedLoop(bad).state,'INVALID_OR_UNSAFE_SOURCE_AUDIT');
    assert.equal(A.closedLoop(bad).paid_checkout_allowed,false);
  }
});


test('Sales4 model guard is wired into EXISTING Agent3 preview and fail-closed by default',async()=>{
  const out=await A.runAll(sample());
  assert.equal(out.sales_private_model_gate.state,'LOCAL_PRIVATE_MODEL_NOT_VERIFIED');
  assert.equal(out.sales_private_model_gate.external_actions,0);
  assert.equal(out.new_crm_records,0);
  assert.equal(out.external_messages_sent,0);
});
test('independent verified 4B runtime may be previewed but never executes',async()=>{
  const runtime={pc_online:true,ollama_loopback_healthy:true,
    endpoint:'http://127.0.0.1:11434',local_private_processing_approved:true,
    selected_model:'imperion-qwen35:4b',installed_models:['imperion-qwen35:4b'],
    model_fixture_passed:true,model_hallucination_gate_passed:true};
  const out=await A.runAll(sample(),{agent4ModelRuntime:runtime});
  assert.equal(out.sales_private_model_gate.state,'LOCAL_MODEL_DRAFT_ELIGIBLE');
  assert.equal(out.sales_private_model_gate.automatic_sends,false);
  assert.equal(out.sales_private_model_gate.external_actions,0);
  assert.equal(out.external_messages_sent,0);
});
