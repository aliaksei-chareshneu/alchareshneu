'use strict';
/**
 * IMPERION Agent #3 -> Agent #4 integration contract.
 * Pure, side-effect-free adapter; NO second Telegram consumer, CRM, queue or publisher.
 * All evidence parameters must come from independently authenticated provider/owner
 * adapters, NEVER from customer/model text. Never invoke provider writes from here.
 */
const {createHash}=require('node:crypto');

const CRM=Object.freeze({
  OSVC:'Leads',
  DRUZINA_MORAVY_ZS:'Druzina_Enrollment_Pipeline'
});
const CHANNELS=new Set(['telegram_dm','whatsapp_dm','gmail','messenger_dm',
  'instagram_dm','facebook_page_comment','instagram_comment']);
const MANUAL=new Set(['facebook_group','facebook_profile','whatsapp_group',
  'whatsapp_channel','tiktok','youtube_community']);
const PRIVACY=new Set(['PRIVATE_CUSTOMER','PRIVATE_MEMBER','PRIVATE_EMAIL']);
const GOOD_LOCAL=new Set(['imperion-qwen35:4b','qwen3:4b']);
const WEAK_LOCAL=new Set(['imperion-qwen3-cpu:0.6b','qwen3:0.6b']);
const iso = v => typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v)&&Number.isFinite(Date.parse(v))? Date.parse(v):null;
const str = v => typeof v==='string'?v.trim():'';
const fail = code => ({state:code,external_actions:0,crm_written:false,provider_receipt:null});
function keyOf(event) {
  const entity=str(event.entity),account=str(event.account_id),channel=str(event.channel);
  const providerId=str(event.provider_message_id);
  if(!CRM[entity]||!account||!CHANNELS.has(channel)||!providerId)return null;
  return 'IMP4-'+createHash('sha256').update([entity,account,channel,providerId].join('|')).digest('hex').slice(0,24);
}
function optOut(text) {
  return /(?:^|[\s,.;!?])(stop|unsubscribe|opt[\s-]?out|don't contact|do not contact|nepsat|nepi[sš]te|odhl[aá]sit)(?:$|[\s,.;!?])|(?:не\s*(?:пишите|присылайте|беспокойте)|відписатися|не\s*пишіть)/iu.test(str(text));
}
function intake(event={}, evidence={}) {
  const sourceKey=keyOf(event);
  if(!sourceKey)return fail('HOLD_UNKNOWN_CONTROLLER_ACCOUNT_OR_SOURCE');
  if(event.owner_selftest===true)return {...fail('OWNER_TEST_NOT_CUSTOMER_LEAD'),source_key:sourceKey};
  if(evidence.providerReceiptVerified!==true)return {...fail('HOLD_PROVIDER_RECEIPT'),source_key:sourceKey};
  if(evidence.duplicateSourceKeys instanceof Set &&
    evidence.duplicateSourceKeys.has(sourceKey))return {...fail('DUPLICATE_NO_NEW_LEAD'),source_key:sourceKey};
  if(evidence.optedOut===true||optOut(event.text))return {...fail('SUPPRESS_OUTBOUND_OPT_OUT'),source_key:sourceKey,
    target_crm_tab:CRM[event.entity],opt_out:true};
  if(evidence.ownerAccountBound!==true||evidence.legalControllerVerified!==true||
      evidence.identityVerified!==true||evidence.historyReviewed!==true||
      evidence.lawfulContactContext!==true)return {...fail('HOLD_IDENTITY_CONTROLLER_HISTORY_OR_BASIS'),
        source_key:sourceKey};
  return {...fail('INTERNAL_AGENT4_REVIEW_ONLY'),source_key:sourceKey,
    target_crm_tab:CRM[event.entity],controller:event.entity,
    source_channel:event.channel,client_stage:'UNQUALIFIED',
    requires_human_review:true,customer_record_verified:false};
}
/**
 * No external LLM is authorized for protected conversations. For public drafts,
 * delegate to existing ops/imperion-free-model-router.cjs instead of creating
 * a competing provider chain. For private drafts, only loopback Ollama is eligible.
 * A candidate is not a tested production switch; must pass per-model QA.
 */
function modelRoute(request={}, runtime={}) {
  if(request.action!=='DRAFT'||request.send===true||request.publish===true)
    return fail('MODEL_NOT_ALLOWED_TO_EXECUTE_ACTIONS');
  if(request.purpose==='PUBLIC_COPY_DRAFT') {
    if(request.data_classification!=='PUBLIC_APPROVED'||
       request.source_approved!==true||request.external_ai_approved!==true)
      return fail('PUBLIC_SOURCE_OR_EXTERNAL_AI_NOT_APPROVED');
    return {...fail('DELEGATE_EXISTING_PUBLIC_MODEL_ROUTER'),
      module:'ops/imperion-free-model-router.cjs',model:null,
      owner_review_required:true};
  }
  if(!['SALES_PRIVATE_DRAFT','SALES_PRIVATE_CLASSIFY'].includes(request.purpose)||
      !PRIVACY.has(request.data_classification))
    return fail('UNSUPPORTED_PRIVATE_MODEL_PURPOSE');
  if(runtime.oci_relay_only===true&&runtime.pc_online!==true)
    return fail('OCI_RELAY_NOT_A_PRIVATE_LLM');
  if(runtime.pc_online!==true||runtime.ollama_loopback_healthy!==true||
      runtime.endpoint!=='http://127.0.0.1:11434'||
      runtime.local_private_processing_approved!==true)
    return fail('LOCAL_PRIVATE_MODEL_NOT_VERIFIED');
  const model=str(runtime.selected_model);
  if(WEAK_LOCAL.has(model))return fail('WEAK_0_6B_REJECTED_FOR_CUSTOMER_DRAFT');
  if(!GOOD_LOCAL.has(model))return fail('MODEL_NOT_IN_REVIEWED_ALLOWLIST');
  if(!Array.isArray(runtime.installed_models)||!runtime.installed_models.includes(model))
    return fail('MODEL_NOT_INSTALLED');
  if(runtime.model_fixture_passed!==true||runtime.model_hallucination_gate_passed!==true)
    return fail('MODEL_QUALITY_ACCEPTANCE_MISSING');
  return {...fail('LOCAL_MODEL_DRAFT_ELIGIBLE'),provider:'ollama_local',
    endpoint:'http://127.0.0.1:11434',model,
    compute_location:'WINDOWS_ZMRZLINA',data_egress:'NONE_BY_DESIGN',
    owner_review_required:true,automatic_sends:false};
}
/** Authorization is a preview and cannot create provider effects. */
function actionGate(action={},evidence={},nowIso='') {
  if(!CRM[action.entity])return fail('UNKNOWN_LEGAL_CONTROLLER');
  if(action.channel==='facebook_group'||MANUAL.has(action.channel))
    return fail('MANUAL_PACKAGE_REQUIRED');
  if(!CHANNELS.has(action.channel)&&!['facebook_page','telegram_channel','instagram_feed',
      'instagram_reel','instagram_story','youtube_video'].includes(action.channel))
    return fail('CHANNEL_API_UNVERIFIED');
  if(action.effect!=='SEND'&&action.effect!=='PUBLISH')return fail('UNSUPPORTED_EFFECT');
  if(evidence.killSwitchOn===true)return fail('KILL_SWITCH_ACTIVE');
  const go=action.go||{};
  const start=iso(go.valid_from),end=iso(go.valid_until),now=iso(nowIso);
  if(go.ownerVerifiedByPrivateAdapter!==true||!/^GO-[a-zA-Z0-9_-]{8,80}$/.test(str(go.approval_ref))||
     go.entity!==action.entity||go.account_id!==action.account_id||
     go.channel!==action.channel||go.effect!==action.effect||
     go.payload_sha256!==action.payload_sha256||!/^([a-f0-9]{64})$/.test(str(action.payload_sha256))||
     start===null||end===null||now===null||end<=start||end-start>86400000||now<start||now>end)
    return fail('NO_TRUSTED_EXACT_PAYLOAD_GO');
  if(evidence.duplicateChecked!==true||evidence.unknownPriorDelivery===true)
    return fail('DUPLICATE_OR_UNCERTAIN_PRIOR_DELIVERY');
  if(evidence.providerAccountVerified!==true||evidence.providerPermissionVerified!==true||
     evidence.providerQuotaVerified!==true||evidence.lawfulBasisVerified!==true||
     evidence.optOutChecked!==true||evidence.recipientOptedOut===true)
    return fail('PROVIDER_OR_CONTACT_BASIS_NOT_VERIFIED');
  if(action.effect==='PUBLISH'&&
     (evidence.mediaRightsVerified!==true||evidence.contentFactsVerified!==true||
      evidence.publisherOwnerVerified!==true))
    return fail('PUBLICATION_RIGHTS_OR_FACTS_MISSING');
  if(action.effect==='SEND'&&
     (evidence.threadHistoryReviewed!==true||evidence.identityVerified!==true))
    return fail('SEND_IDENTITY_OR_HISTORY_MISSING');
  if(action.offer_id&&
     (evidence.offerConfirmed!==true||evidence.priceAndTermsVerified!==true))
    return fail('COMMERCIAL_OFFER_NOT_VERIFIED');
  return {...fail('ELIGIBLE_FOR_SEPARATE_AUTHENTICATED_PROVIDER_ACTION'),
    approved_effect:action.effect,approval_ref:go.approval_ref,automatic_sends:false};
}
/** Never promote an unknown ACK to LIVE/DELIVERED or retry blindly. */
function reconcile(ack={},readback={},type='post') {
  if(ack.error)return {...fail('PROVIDER_ERROR'),blind_retry_allowed:false};
  const providerId=str(ack.provider_id);
  if(!providerId)return {...fail('RECONCILIATION_REQUIRED'),blind_retry_allowed:false};
  if(type==='message') {
    if(readback.provider_id!==providerId||readback.ackVerified!==true)
      return {...fail('MESSAGE_ACK_READBACK_PENDING'),provider_id:providerId};
    return {...fail('MESSAGE_API_ACCEPTED_NOT_DELIVERED'),provider_id:providerId,
      recipient_delivery_verified:false};
  }
  if(type!=='post')return fail('UNKNOWN_RECEIPT_TYPE');
  if(readback.provider_id!==providerId||readback.permalinkVerified!==true||
     !/^https:\/\/[^@\s]+$/.test(str(readback.permalink)))
    return {...fail('POST_PROVIDER_CONFIRMED_NOT_LIVE'),provider_id:providerId};
  if(readback.firstCommentRequired===true&&readback.firstCommentVerified!==true)
    return {...fail('POST_LIVE_FIRST_COMMENT_PENDING'),provider_id:providerId,
      permalink:readback.permalink,live_verified:true};
  return {...fail('POST_LIVE_VERIFIED'),provider_id:providerId,
    permalink:readback.permalink,live_verified:true};
}
module.exports={CRM,CHANNELS,MANUAL,GOOD_LOCAL,WEAK_LOCAL,keyOf,optOut,intake,
  modelRoute,actionGate,reconcile};
