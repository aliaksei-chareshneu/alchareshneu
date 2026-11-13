'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../ops/imperion-social-sales-routing.cjs');
const now='2026-11-13T19:30:00+01:00';
const event={entity:'OSVC',account_id:'owned-tg-bot',channel:'telegram_dm',
  provider_message_id:'own-msg-02',text:'I want to book a lesson'};
const evidence={providerReceiptVerified:true,ownerAccountBound:true,
  legalControllerVerified:true,identityVerified:true,historyReviewed:true,
  lawfulContactContext:true,duplicateSourceKeys:new Set()};
const local={pc_online:true,ollama_loopback_healthy:true,
  endpoint:'http://127.0.0.1:11434',local_private_processing_approved:true,
  selected_model:'imperion-qwen35:4b',installed_models:['imperion-qwen35:4b','qwen3:4b'],
  model_fixture_passed:true,model_hallucination_gate_passed:true};
const task={action:'DRAFT',purpose:'SALES_PRIVATE_DRAFT',
  data_classification:'PRIVATE_CUSTOMER'};
const payload_sha256='a'.repeat(64);
const action={entity:'OSVC',account_id:'owned-page',channel:'facebook_page',
  effect:'PUBLISH',payload_sha256,offer_id:''};
const go={ownerVerifiedByPrivateAdapter:true,approval_ref:'GO-OWNER-20261113',
  entity:action.entity,account_id:action.account_id,channel:action.channel,
  effect:action.effect,payload_sha256,
  valid_from:'2026-11-13T19:00:00+01:00',
  valid_until:'2026-11-13T20:00:00+01:00'};
const pubEvidence={duplicateChecked:true,unknownPriorDelivery:false,
  providerAccountVerified:true,providerPermissionVerified:true,
  providerQuotaVerified:true,lawfulBasisVerified:true,optOutChecked:true,
  recipientOptedOut:false,mediaRightsVerified:true,contentFactsVerified:true,
  publisherOwnerVerified:true,threadHistoryReviewed:true,identityVerified:true,
  offerConfirmed:true,priceAndTermsVerified:true};
test('canonical accounts map only to existing OSVC/NGO CRM tables',()=>{
  assert.equal(R.CRM.OSVC,'Leads');assert.equal(R.CRM.DRUZINA_MORAVY_ZS,'Druzina_Enrollment_Pipeline');
  assert.equal(R.CRM.BRNOWALKERS,undefined);
});
test('cross-account provider IDs do not collide',()=>{
  assert.notEqual(R.keyOf(event),R.keyOf({...event,account_id:'another-owned-tg-bot'}));
  assert.notEqual(R.keyOf(event),R.keyOf({...event,entity:'DRUZINA_MORAVY_ZS'}));
  assert.equal(R.keyOf(event),R.keyOf({...event,text:'modified customer wording'}));
});
test('provider source and controller must be explicitly present',()=>{
  for(const x of [
    {entity:'BRNOWALKERS'}, {channel:'facebook_group'}, {account_id:''},
    {provider_message_id:''}])
    assert.equal(R.intake({...event,...x},evidence).state,'HOLD_UNKNOWN_CONTROLLER_ACCOUNT_OR_SOURCE');
});
test('owner-only self test is never a buyer lead',()=>{
  let r=R.intake({...event,owner_selftest:true},evidence);
  assert.equal(r.state,'OWNER_TEST_NOT_CUSTOMER_LEAD');assert.equal(r.crm_written,false);
});
test('provider receipt is required before internal intake',()=>{
  assert.equal(R.intake(event,{...evidence,providerReceiptVerified:false}).state,'HOLD_PROVIDER_RECEIPT');
});
test('same source ID is idempotent across repeated delivery',()=>{
  let r=R.intake(event,{...evidence,duplicateSourceKeys:new Set([R.keyOf(event)])});
  assert.equal(r.state,'DUPLICATE_NO_NEW_LEAD');assert.equal(r.external_actions,0);
});
test('opt-out overrides sales intent in EN CS RU UK',()=>{
  for(const text of ['STOP','unsubscribe now','prosím nepište','не пишите мне','не пишіть мені']){
    const r=R.intake({...event,text},evidence);
    assert.equal(r.state,'SUPPRESS_OUTBOUND_OPT_OUT',text);
    assert.equal(r.opt_out,true);
  }
  assert.equal(R.intake(event,{...evidence,optedOut:true}).state,'SUPPRESS_OUTBOUND_OPT_OUT');
});
test('unknown history, seller, identity or legal basis prevents CRM handoff',()=>{
  for(const key of ['ownerAccountBound','legalControllerVerified','identityVerified','historyReviewed','lawfulContactContext']){
    assert.equal(R.intake(event,{...evidence,[key]:false}).state,'HOLD_IDENTITY_CONTROLLER_HISTORY_OR_BASIS');
  }
});
test('internal handoff is metadata-only and no CRM write is claimed',()=>{
  const r=R.intake(event,evidence);
  assert.equal(r.state,'INTERNAL_AGENT4_REVIEW_ONLY');
  assert.equal(r.target_crm_tab,'Leads');
  assert.equal(r.customer_record_verified,false);
  assert.equal(r.crm_written,false);
  assert.ok(!JSON.stringify(r).includes(event.text));
});
test('Druzina intake never defaults to OSVC',()=>{
  const r=R.intake({...event,entity:'DRUZINA_MORAVY_ZS'},evidence);
  assert.equal(r.target_crm_tab,'Druzina_Enrollment_Pipeline');
  assert.equal(r.controller,'DRUZINA_MORAVY_ZS');
});
test('model cannot send, post or be selected for execution',()=>{
  for(const x of [{action:'SEND'}, {send:true}, {publish:true}])
    assert.equal(R.modelRoute({...task,...x},local).state,'MODEL_NOT_ALLOWED_TO_EXECUTE_ACTIONS');
});
test('private data never routes to existing external public model adapter',()=>{
  assert.equal(R.modelRoute({...task,purpose:'PUBLIC_COPY_DRAFT'},local).state,'PUBLIC_SOURCE_OR_EXTERNAL_AI_NOT_APPROVED');
  assert.equal(R.modelRoute({...task,purpose:'PUBLIC_COPY_DRAFT',data_classification:'PUBLIC_APPROVED',
    source_approved:true,external_ai_approved:true},local).state,'DELEGATE_EXISTING_PUBLIC_MODEL_ROUTER');
});
test('OCI micro is relay, not proof of private Ollama inference',()=>{
  assert.equal(R.modelRoute(task,{...local,oci_relay_only:true,pc_online:false}).state,'OCI_RELAY_NOT_A_PRIVATE_LLM');
});
test('private local model demands PC, loopback, permission and health',()=>{
  for(const x of [{pc_online:false},{ollama_loopback_healthy:false},
    {endpoint:'https://remote-model.example'},{local_private_processing_approved:false}]){
    assert.equal(R.modelRoute(task,{...local,...x}).state,'LOCAL_PRIVATE_MODEL_NOT_VERIFIED');
  }
});
test('0.6B known-bad client model cannot autonomously draft a reply',()=>{
  for(const model of ['imperion-qwen3-cpu:0.6b','qwen3:0.6b'])
    assert.equal(R.modelRoute(task,{...local,selected_model:model,
      installed_models:[model]}).state,'WEAK_0_6B_REJECTED_FOR_CUSTOMER_DRAFT');
});
test('unknown or uninstalled models cannot be selected',()=>{
  assert.equal(R.modelRoute(task,{...local,selected_model:'gpt-6'}).state,'MODEL_NOT_IN_REVIEWED_ALLOWLIST');
  assert.equal(R.modelRoute(task,{...local,installed_models:[]}).state,'MODEL_NOT_INSTALLED');
});
test('4B model remains blocked before model-quality fixture acceptance',()=>{
  for(const x of [{model_fixture_passed:false},{model_hallucination_gate_passed:false}])
    assert.equal(R.modelRoute(task,{...local,...x}).state,'MODEL_QUALITY_ACCEPTANCE_MISSING');
});
test('approved local 4B route makes drafts only and never sends',()=>{
  const r=R.modelRoute(task,local);
  assert.equal(r.state,'LOCAL_MODEL_DRAFT_ELIGIBLE');
  assert.equal(r.provider,'ollama_local');
  assert.equal(r.automatic_sends,false);
  assert.equal(r.external_actions,0);
  assert.equal(r.model,'imperion-qwen35:4b');
});
test('unsupported private scope cannot leak to a provider',()=>{
  assert.equal(R.modelRoute({...task,data_classification:'PRIVATE_BANK'},local).state,'UNSUPPORTED_PRIVATE_MODEL_PURPOSE');
});
test('manual Facebook groups and WhatsApp cannot be API released',()=>{
  for(const channel of ['facebook_group','facebook_profile','whatsapp_group','tiktok']){
    assert.equal(R.actionGate({...action,channel},pubEvidence,now).state,'MANUAL_PACKAGE_REQUIRED');
  }
});
test('GO cannot be supplied solely as a spreadsheet or model claim',()=>{
  assert.equal(R.actionGate(action,pubEvidence,now).state,'NO_TRUSTED_EXACT_PAYLOAD_GO');
  assert.equal(R.actionGate({...action,go:{...go,ownerVerifiedByPrivateAdapter:false}},pubEvidence,now).state,'NO_TRUSTED_EXACT_PAYLOAD_GO');
});
test('scoped GO binds actor, account, content SHA, platform, action, time',()=>{
  for(const patch of [{account_id:'foreign-account'},{effect:'SEND'},
    {payload_sha256:'b'.repeat(64)}]){
    assert.equal(R.actionGate({...action,...patch,go},pubEvidence,now).state,'NO_TRUSTED_EXACT_PAYLOAD_GO');
  }
  assert.equal(R.actionGate({...action,go},pubEvidence,'2026-11-14T19:30:00+01:00').state,'NO_TRUSTED_EXACT_PAYLOAD_GO');
});
test('fail closed on 24h+ unscoped standing approval',()=>{
  const longer={...go,valid_until:'2026-11-15T19:00:00+01:00'};
  assert.equal(R.actionGate({...action,go:longer},pubEvidence,now).state,'NO_TRUSTED_EXACT_PAYLOAD_GO');
});
test('kill switch, previous uncertain delivery and optout remain hard blocks',()=>{
  for(const [patch,code] of [
    [{killSwitchOn:true},'KILL_SWITCH_ACTIVE'],
    [{unknownPriorDelivery:true},'DUPLICATE_OR_UNCERTAIN_PRIOR_DELIVERY'],
    [{recipientOptedOut:true},'PROVIDER_OR_CONTACT_BASIS_NOT_VERIFIED'],
    [{providerQuotaVerified:false},'PROVIDER_OR_CONTACT_BASIS_NOT_VERIFIED']])
    assert.equal(R.actionGate({...action,go},{...pubEvidence,...patch},now).state,code);
});
test('public rights and controller identity must be checked even with GO',()=>{
  for(const field of ['mediaRightsVerified','contentFactsVerified','publisherOwnerVerified'])
    assert.equal(R.actionGate({...action,go},{...pubEvidence,[field]:false},now).state,'PUBLICATION_RIGHTS_OR_FACTS_MISSING');
});
test('approved scope is still a non-executing provider preview',()=>{
  const r=R.actionGate({...action,go},pubEvidence,now);
  assert.equal(r.state,'ELIGIBLE_FOR_SEPARATE_AUTHENTICATED_PROVIDER_ACTION');
  assert.equal(r.external_actions,0);
  assert.equal(r.provider_receipt,null);
});
test('uncertain send cannot be blindly replayed',()=>{
  const r=R.reconcile({},{},'message');
  assert.equal(r.state,'RECONCILIATION_REQUIRED');
  assert.equal(r.blind_retry_allowed,false);
});
test('Telegram API acceptance is not recipient delivery',()=>{
  const r=R.reconcile({provider_id:'3'},{provider_id:'3',ackVerified:true},'message');
  assert.equal(r.state,'MESSAGE_API_ACCEPTED_NOT_DELIVERED');
  assert.equal(r.recipient_delivery_verified,false);
});
test('post ACK alone is not independently verified LIVE',()=>{
  assert.equal(R.reconcile({provider_id:'123'},{}).state,'POST_PROVIDER_CONFIRMED_NOT_LIVE');
});
test('first comment required is tracked separately',()=>{
  const r=R.reconcile({provider_id:'p-123'},{
    provider_id:'p-123',permalinkVerified:true,
    permalink:'https://www.facebook.com/posts/p-123',firstCommentRequired:true,firstCommentVerified:false});
  assert.equal(r.state,'POST_LIVE_FIRST_COMMENT_PENDING');
  assert.equal(r.live_verified,true);
});
test('independently verified provider post and comment can pass receipt',()=>{
  const r=R.reconcile({provider_id:'p-123'},{
    provider_id:'p-123',permalinkVerified:true,
    permalink:'https://www.facebook.com/posts/p-123',firstCommentRequired:true,firstCommentVerified:true});
  assert.equal(r.state,'POST_LIVE_VERIFIED');
  assert.equal(r.external_actions,0);
});
test('source exceptions cannot be turned into fake bank cash claims',()=>{
  const r=R.intake({...event,text:'I already paid 1 000 CZK'},evidence);
  assert.equal(r.customer_record_verified,false);
  assert.equal(r.crm_written,false);
});
