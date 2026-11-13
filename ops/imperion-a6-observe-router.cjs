'use strict';
/**
 * IMPERION A6, draft-only: deterministic OBSERVE_ONLY routing over metadata from
 * the EXISTING Hub/Supabase/GitHub workstreams. Pure; no I/O, no new queue.
 * This is NOT a producer for operator_commands or a production event trigger.
 */
const POLICY = Object.freeze({
  CODE_REVIEW: ['A1_DEV', ['GITHUB'], ['OSVC']],
  CLOUD_HEALTH: ['A2_CLOUD', ['SUPABASE', 'GITHUB', 'OCI'], ['OSVC', 'DRUZINA_MORAVY_ZS']],
  MEDIA_DRAFT: ['A3_GROWTH', ['COMMUNITY_HUB'], ['OSVC', 'DRUZINA_MORAVY_ZS']],
  SALES_INBOUND: ['A4_SALES', ['COMMUNITY_HUB'], ['OSVC']],
  PC_HEALTH: ['A5_PC', ['WINDOWS_BRIDGE'], ['OSVC']],
  COO_HEALTH: ['A6_COO', ['COMMUNITY_HUB', 'SUPABASE'], ['OSVC', 'DRUZINA_MORAVY_ZS']],
  GRANT_SOURCE: ['A7_GRANTS', ['OFFICIAL_SOURCE'], ['DRUZINA_MORAVY_ZS', 'RESEARCH_INSTITUTION']]
});
const ACTIONS = new Set(['READ_ONLY_REVIEW','SYNTHETIC_TEST']);
const CLASSES = new Set(['PUBLIC','SYNTHETIC','PRIVATE_AGGREGATE']);
const SOURCE_ID = /^[a-zA-Z0-9_-]{3,100}$/;
const EVENT_FIELDS = new Set(['case_id','source_id','event_type','source_system',
  'legal_subject','received_at','data_class','requested_action']);
function t(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
}
function safeId(v) { return typeof v==='string' && SOURCE_ID.test(v); }
function idKey(e) { return [e.source_system,e.event_type,e.source_id].join(':'); }
function preview({now,signals,mandate,existing_jobs=[]}={}) {
  const clock=t(now);
  if(clock===null)throw Error('INVALID_NOW');
  if(!Array.isArray(signals)||signals.length>100)throw Error('INVALID_SIGNAL_BATCH');
  if(!Array.isArray(existing_jobs)||existing_jobs.length>1000)throw Error('INVALID_EXISTING_JOBS');
  // Existing-job snapshots are metadata only, never a substitute for provider readback.
  const existing=new Map();
  for(const j of existing_jobs) {
    if(!j||typeof j!=='object'||typeof j.idempotency_key!=='string'||!j.idempotency_key) continue;
    if(!existing.has(j.idempotency_key))existing.set(j.idempotency_key,j);
  }
  const seen=new Map();
  const results=[];
  for(const event of signals){
    const e=event && typeof event==='object' && !Array.isArray(event)?event:{};
    // An explicit allowlist avoids echoing PII, messages, raw payload, and secrets.
    // SQL claim/done/error/retry events describe lifecycle, NOT new agent intents.
    // Never fabricate a source identity for legacy browser_jobs with null idempotency_key.
    const key = safeId(e.source_id) && safeId(e.event_type) &&
      safeId(e.source_system) ? idKey(e) : null;
    let verdict='BLOCKED',reason='INVALID_SIGNAL',role=null;
    const rule=Object.hasOwn(POLICY,e.event_type)?POLICY[e.event_type]:null;
    const stamp=t(e.received_at);
    if(!key||!safeId(e.case_id)||stamp===null){reason='INVALID_SIGNAL';}
    else if(stamp>clock+300000){reason='FUTURE_SIGNAL';}
    else if(e.payload!==undefined||e.text!==undefined||e.email!==undefined||e.secret!==undefined){reason='RAW_PAYLOAD_FORBIDDEN';}
    else if(Object.keys(e).some(k=>!EVENT_FIELDS.has(k))){reason='UNEXPECTED_EVENT_FIELD';}
    else if(!rule){reason='UNKNOWN_EVENT_TYPE';}
    else if(!rule[1].includes(e.source_system)){reason='UNTRUSTED_SOURCE_FOR_ROUTE';}
    else if(!rule[2].includes(e.legal_subject)){reason='LEGAL_SUBJECT_MISMATCH';}
    else if(!CLASSES.has(e.data_class)){reason='UNKNOWN_DATA_CLASS';}
    else if(e.data_class==='PRIVATE_AGGREGATE' && e.requested_action!=='READ_ONLY_REVIEW'){reason='PRIVATE_DATA_ACTION_BLOCKED';}
    else if(!ACTIONS.has(e.requested_action)){reason='ACTION_NOT_IN_OBSERVE_ALLOWLIST';}
    else if(!mandate||mandate.mode!=='OBSERVE_ONLY'||mandate.status!=='ACTIVE'||
      mandate.owner_approval!=='OBSERVE_ONLY'||mandate.budget_czk!==0){reason='MANDATE_NOT_AUTHORIZED';}
    else if(t(mandate.expires_at)===null||t(mandate.expires_at)<=clock){reason='MANDATE_EXPIRED';}
    else if(!Array.isArray(mandate.allowed_types)||!mandate.allowed_types.includes(e.event_type)||
      !Array.isArray(mandate.allowed_subjects)||!mandate.allowed_subjects.includes(e.legal_subject)){
      reason='MANDATE_SCOPE_MISMATCH';
    }
    else if(existing.has(key)){
      verdict='EXISTS_READBACK';reason='EXISTING_COMMAND_REQUIRES_READBACK';role=rule[0];
    }
    else if(seen.has(key)){
      verdict='DUPLICATE_NOOP';reason=seen.get(key)===e.case_id?'DUPLICATE_DELIVERY':'IDEMPOTENCY_CONFLICT';role=rule[0];
    }
    else if(clock-stamp>3600000){
      verdict='WATCHDOG_REVIEW';reason='STALE_EVENT_REQUIRES_OWNER_REVIEW';role=rule[0];
    }
    else {verdict='ROUTE_PREVIEW';reason='BOUNDED_OBSERVE_ONLY';role=rule[0];}
    if(key&&!seen.has(key))seen.set(key,e.case_id);
    results.push({case_id:safeId(e.case_id)?e.case_id:null,
      idempotency_key:key,role,verdict,reason,next:verdict==='ROUTE_PREVIEW'?'OWNER_REVIEW':
      verdict==='EXISTS_READBACK'?'PROVIDER_READBACK':verdict==='WATCHDOG_REVIEW'?'ESCALATE_OWNER':'NO_ACTION'});
  }
  return {
    schema_version:1,mode:'OBSERVE_ONLY',source:'EXISTING_IMPERION_WORKSTREAMS_METADATA',
    total:signals.length,route_previews:results.filter(r=>r.verdict==='ROUTE_PREVIEW').length,
    blocked:results.filter(r=>r.verdict==='BLOCKED').length,
    duplicates:results.filter(r=>r.verdict==='DUPLICATE_NOOP').length,
    existing_needing_readback:results.filter(r=>r.verdict==='EXISTS_READBACK').length,
    watchdog_flags:results.filter(r=>r.verdict==='WATCHDOG_REVIEW').length,
    results,actions_executed:0,commands_created:0,emails_sent:0,
    posts_published:0,deployments:0,payments:0,provider_readback:'NOT_PERFORMED'
  };
}
module.exports={preview,POLICY};
