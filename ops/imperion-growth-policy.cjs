'use strict';
/**
 * IMPERION Growth Department: fail-closed, deterministic planning/policy layer.
 * Consumes the EXISTING authorized Community Hub snapshot; never publishes,
 * comments, messages, bills, creates leads, or accesses provider credentials.
 * Only a separately audited owner-bound adapter may execute an approved action.
 */
const {createHash}=require('node:crypto');
const ENTITIES=new Set(['OSVC','BRNOWALKERS','DRUZINA_MORAVY_ZS']);
const LANGS=new Set(['cs','en','ru','uk']);
const LIVE=new Set(['PUBLISHED_VERIFIED','POSTED_VERIFIED','PUBLISHED_WEB_VERIFIED']);
const UNSETTLED=/(PENDING|SCHEDULED|ERROR|SUBMITTING|UNVERIFIED|BLOCKED|PUBLISHED_PROVIDER_CONFIRMED)/;
const OWN_SITE='aliaksei-chareshneu.github.io';
const clean=v=>v==null?'':String(v).trim();
const upper=v=>clean(v).toUpperCase();
const bool=v=>v===true;
const httpsUrl=v=>{try {const u=new URL(clean(v));return u.protocol==='https:'?u:null;}catch{return null;}};
const positiveDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
function entityName(name){
  const n=upper(name);
  if(/DRU[\u017dZ]INA MORAVY/.test(n))return 'DRUZINA_MORAVY_ZS';
  if(n.includes('BRNOWALKERS'))return 'BRNOWALKERS';
  if(n.includes('ALIAKSEI CHARESHNEU')||/OSV[\u010cC]/.test(n))return 'OSVC';
  return 'UNKNOWN';
}
function review(snapshot, parseLocalDate){
  if(!snapshot||snapshot.schema_version!==1||snapshot.source_system!=='EXISTING_IMPERION_HUB'||
      !snapshot.data||typeof parseLocalDate!=='function')throw Error('TRUSTED_EXISTING_SNAPSHOT_REQUIRED');
  const events=snapshot.data.Events||snapshot.data.events||[];
  const posts=snapshot.data.SocialPublishing||snapshot.data.social_publishing||[];
  if(!Array.isArray(events)||!Array.isArray(posts)||events.length>4000||posts.length>4000)throw Error('INVALID_CANONICAL_ROWS');
  const now=positiveDate(snapshot.captured_at);
  if(now===null)throw Error('INVALID_REVIEW_TIME');
  const eventIds=new Set();
  const candidates=[];
  for(const event of events){
    const id=clean(event.Event_ID||event.event_id);
    if(!/^[A-Za-z0-9][A-Za-z0-9_:-]{2,119}$/.test(id)||eventIds.has(id))continue;
    eventIds.add(id);
    const status=upper(event.Status||event.status);
    if(!['CONFIRMED','ACTIVE'].includes(status))continue;
    const start=parseLocalDate(event.Start_DateTime||event.Starts_At||event.start_at);
    if(!start)continue;
    const t=Date.parse(start);
    if(t<now||t>now+30*86400000)continue;
    const related=posts.filter(p=>clean(p.Event_ID||p.event_id)===id);
    const published=related.filter(p=>LIVE.has(upper(p.Status||p.status)));
    const unresolved=related.filter(p=>UNSETTLED.test(upper(p.Status||p.status)));
    const price=clean(event.Price_CZK);
    const priceValid=/^\d+(?:\.\d{1,2})?$/.test(price);
    const link=httpsUrl(event.Tally_Form_URL||event.Registration_URL);
    const entity=entityName(event.Data_Controller||event.Legal_Entity||event.Community);
    const checks={
      title:clean(event.Title).length>=6,
      venue:clean(event.Location_Name||event.Location_Address).length>=5,
      price:priceValid,
      registration:!!link&&link.hostname===OWN_SITE,
      entity:ENTITIES.has(entity),
      source_rights:related.some(p=>upper(p.Rights_OK)==='YES'),
      safety_capacity:false, // never infer capacity/insurance from a calendar event
      current_public_http:false, // actual browser/provider readback is separate
    };
    const blockers=Object.keys(checks).filter(k=>!checks[k]);
    if(status==='ACTIVE')blockers.push('ACTIVE_NOT_INDEPENDENTLY_CONFIRMED');
    if(unresolved.length)blockers.push('UNSETTLED_PROVIDER_POST_RECONCILIATION');
    if(published.length)blockers.push('EXISTING_POST_DEDUP_AND_RECENCY_CHECK');
    candidates.push({
      event_id:id,starts_at:start,legal_entity:entity,
      title:clean(event.Title).slice(0,160),price_czk:priceValid?Number(price):null,
      observed_posts:published.length,unsettled_posts:unresolved.length,
      source:'EXISTING_COMMUNITY_HUB/Events+SocialPublishing',
      state:'CREATIVE_REVIEW_ONLY',blockers,
      action:'VERIFY_SOURCES_CAPACITY_RIGHTS_AND_OWNER_SCOPE',
      auto_post:false,auto_reply:false,lead_created:false,
    });
  }
  candidates.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
  return {mode:'READ_ONLY_GROWTH_REVIEW',checked_at:snapshot.captured_at,
    candidates:candidates.slice(0,30),total:candidates.length,
    public_posts_created:0,private_messages_sent:0,leads_created:0,
    payment_verified:'NOT_CHECKED'};
}
/** Standing GO is never inferred from CRM content or model prose. */
function standingGo(grant,request,evidence={},nowIso=''){
  const deny=(code)=>({decision:'DENY',code,may_publish:false});
  if(!grant||grant.state!=='ACTIVE'||grant.owner_authority_verified!==true||
     !/^GO-[A-Za-z0-9_-]{8,80}$/.test(clean(grant.approval_ref)))return deny('NO_VERIFIED_STANDING_GO');
  if(grant.revoked===true||evidence.kill_switch===true)return deny('STOP_OR_REVOKED');
  const now=positiveDate(nowIso),start=positiveDate(grant.valid_from),end=positiveDate(grant.valid_until);
  if(now===null||start===null||end===null||end<=start||end-start>31*86400000||now<start||now>end)
    return deny('TIME_WINDOW_INVALID');
  if(!ENTITIES.has(request.entity)||grant.entity!==request.entity)return deny('LEGAL_ENTITY_MISMATCH');
  if(!Array.isArray(grant.accounts)||!grant.accounts.includes(request.account_id)||
     !Array.isArray(grant.channels)||!grant.channels.includes(request.channel))return deny('CHANNEL_ACCOUNT_NOT_APPROVED');
  if(!Array.isArray(grant.content_types)||!grant.content_types.includes(request.content_type)||
     !Array.isArray(grant.languages)||!grant.languages.includes(request.language)||
     !LANGS.has(request.language))return deny('CONTENT_SCOPE_NOT_APPROVED');
  if(!Number.isSafeInteger(grant.max_posts_per_24h)||grant.max_posts_per_24h<1||grant.max_posts_per_24h>10)
    return deny('RATE_CAP_INVALID');
  if(!Number.isSafeInteger(evidence.provider_posts_last_24h)||
     evidence.provider_posts_last_24h>=grant.max_posts_per_24h)return deny('QUOTA_OR_POST_COUNT_UNKNOWN');
  if(request.cost_czk!==0||request.unsolicited_dm===true||request.contains_customer_pii===true)
    return deny('COST_PRIVACY_OR_OUTBOUND_BLOCK');
  if(!bool(evidence.facts_fresh)||!bool(evidence.venue_verified)||!bool(evidence.capacity_verified)||
     !bool(evidence.rights_verified)||!bool(evidence.publisher_connected)||
     !bool(evidence.recent_posts_reconciled)||!bool(evidence.cta_form_verified)||
     !bool(evidence.legal_entity_verified)||!bool(evidence.grant_terms_verified))return deny('SOURCE_PROVIDER_OR_SAFETY_GATE');
  return {decision:'POLICY_ELIGIBLE_ONLY',code:'INDEPENDENT_PUBLISH_ADAPTER_REQUIRED',may_publish:false,
    approval_ref:grant.approval_ref,scope_entity:grant.entity,scope_account:request.account_id};
}
function classifyComment(comment){
  if(!comment||!clean(comment.comment_id)||!clean(comment.platform)||
     !httpsUrl(comment.post_url)||comment.provider_readback!==true)
    return {route:'HOLD_PROVIDER_READBACK',automatic_reply:false};
  const t=clean(comment.text).toLowerCase();
  if(t.length<1||t.length>3000)return {route:'HUMAN_REVIEW',automatic_reply:false};
  const personal=/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\+?\d[\d\s()-]{7,}\d/i.test(t);
  const capacity=/(мест|свобод|запис|брон|оплат|счет|сч[её]т|available|slot|book|reserve|register|payment|invoice|m[ií]st|kapacit|přihl[aá]š|rezerv|platb|anmeld|реєстр|реєстрац)/i.test(t);
  const info=/(нович|начинающ|beginner|first time|new to|zač[aá]tečn|poprv[eé]|початк|колик|kolik|price|cost|стоим|цен|цена)/i.test(t);
  const route=personal||capacity?'AGENT4_PRIVATE_TRIAGE':info?'FAQ_DRAFT_FOR_APPROVAL':'HUMAN_REVIEW';
  return {route,automatic_reply:false,contains_personal_data:personal,
    intent:capacity?'BOOKING_OR_CAPACITY':info?'GENERAL_FAQ':'OTHER'};
}
function handoff(comment,classification){
  if(!classification||classification.route!=='AGENT4_PRIVATE_TRIAGE'||
     !comment||!clean(comment.comment_id)||!clean(comment.account_id))return null;
  const source=`${clean(comment.platform)}|${clean(comment.account_id)}|${clean(comment.comment_id)}`;
  return {destination:'EXISTING_CRM_INTAKE_AGENT4',handoff_key:'SOCIAL-'+createHash('sha256').update(source).digest('hex').slice(0,24),
    source_type:'PUBLIC_COMMENT',source_post_url:httpsUrl(comment.post_url)?.toString()||null,
    intent:classification.intent,requires_client_opt_in:true,
    raw_text_exported:false,crm_write_performed:false,reply_sent:false,booking_confirmed:false,payment_verified:false};
}
module.exports={review,standingGo,classifyComment,handoff};
