'use strict';
/**
 * IMPERION OSVC client care review over EXISTING private Community Hub/Leads.
 * Pure, owner-side, NO new CRM, timers, API connections, messages or payments.
 * Dates and legal consent must never be inferred from customer/model free text.
 * The authorized private snapshot stays on the owner machine.
 */
const {createHash} = require('node:crypto');

const STOP = /(?:^|[_\s-])(STOP|CLOSED|LOST|CANCELLED|BLACKLIST|DO_NOT_CONTACT|OPT_OUT|DNC)(?:$|[_\s-])/i;
const NO_CHASE = /WAIT_INBOUND|NO_CHASE|NO_MORE_(?:EMAIL|FOLLOWUP)|NO_OUTBOUND|PASSIVE_WAIT|FINAL_FOLLOWUP|FOLLOWUP_ALREADY_SENT/i;
const QA = /(?:^|[_\s-])(?:QA_SYNTHETIC|SYNTHETIC_QA|QA_FIXTURE|TEST_FIXTURE|TEST_ONLY|DEMO_ONLY|MOCK_LEAD)(?:$|[_\s-])/i;
const ACTIVE = new Set(['ACTIVE', 'IN_PROGRESS', 'BOOKED', 'PAID', 'DELIVERED', 'COMPLETED', 'RECURRING']);
const SOURCE = 'EXISTING_IMPERION_HUB/Leads';

const string = v => typeof v === 'string' ? v.trim() : '';
const col = (r, ...names) => {
  for (const n of names) if (Object.hasOwn(r, n)) return r[n];
  return '';
};
function explicitTime(value) {
  const s = string(value);
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.exec(s);
  if (!m) return null;
  const [y,month,d,h,min,sec] = m.slice(1,7).map((n,i) => i===5 && n===undefined ? 0 : Number(n));
  const tz=m[7],sign=tz[0]==='-'?-1:1;
  const oh=tz==='Z'?0:Number(tz.slice(1,3)),om=tz==='Z'?0:Number(tz.slice(4,6));
  if (oh>14 || om>59 || (oh===14 && om>0)) return null;
  const offset=tz==='Z'?0:sign*(oh*60+om);
  const nominal=Date.UTC(y,month-1,d,h,min,sec);
  const check=new Date(nominal);
  if (check.getUTCFullYear()!==y || check.getUTCMonth()!==month-1 || check.getUTCDate()!==d ||
      check.getUTCHours()!==h || check.getUTCMinutes()!==min || check.getUTCSeconds()!==sec) return null;
  const time=nominal-offset*60000;
  return Number.isFinite(time)?new Date(time).toISOString():null;
}
const pragueParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function localPrague(value) {
  const s=string(value);
  const eu=/^(\d\d)\.(\d\d)\.(\d{4})\s+(\d\d):(\d\d)$/.exec(s);
  const iso=/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)$/.exec(s);
  if (!eu && !iso) return null;
  const [y,mo,d,h,mi]=eu ?
    [Number(eu[3]),Number(eu[2]),Number(eu[1]),Number(eu[4]),Number(eu[5])] :
    iso.slice(1).map(Number);
  const base=Date.UTC(y,mo-1,d,h,mi);
  const date=new Date(base);
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d||
     date.getUTCHours()!==h||date.getUTCMinutes()!==mi)return null;
  const key=[y,mo,d,h,mi].join('-');
  const matches=[1,2].map(hours=>new Date(base-hours*3600000)).filter(candidate=>{
    const p=Object.fromEntries(pragueParts.formatToParts(candidate).map(x=>[x.type,Number(x.value)]));
    return [p.year,p.month,p.day,p.hour,p.minute].join('-')===key;
  });
  // Prague DST skipped/repeated local hour: fail closed.
  return matches.length===1?matches[0].toISOString():null;
}
function dueAt(value) { return explicitTime(value)||localPrague(value); }
function fingerprint(v) { return createHash('sha256').update(v).digest('hex').slice(0,20); }
function idOf(r) {
  const raw=string(col(r,'Lead_ID','lead_id'));
  return raw&&raw.length<=120&&/^[A-Za-z0-9_.:-]+$/.test(raw)?raw:null;
}
function flags(r) {
  const stage=string(col(r,'Stage','stage')).toUpperCase();
  const status=string(col(r,'Action_Status','action_status')).toUpperCase();
  const gate=string(col(r,'Коммерческий допуск — REVIEW / HOLD / STOP','Commercial_Gate')).toUpperCase();
  const stopped=STOP.test(stage)||STOP.test(status)||gate.startsWith('STOP')||
    ['Opt_Out','Do_Not_Contact'].some(k => r[k] === true || r[k] === 1 ||
      ['TRUE','YES','1'].includes(string(r[k]).toUpperCase()));
  const quiet=NO_CHASE.test(status);
  const hold=gate.startsWith('HOLD')||/(?:^|[_\s-])HOLD(?:$|[_\s-])/.test(status);
  const qa=['Source','Action_Status','Stage','Lead_ID'].some(k=>QA.test(string(col(r,k,k.toLowerCase()))));
  return {stage,status,stopped,quiet,hold,qa};
}
function identifiers(r) {
  const id=idOf(r),email=string(col(r,'Email')).toLowerCase(),
    phone=string(col(r,'Phone_Number')).replace(/[^0-9]/g,''),
    telegram=string(col(r,'Telegram_Handle')).toLowerCase();
  return [
    id&&'id:'+id.toLowerCase(),email&&email.includes('@')&&'email:'+fingerprint(email),
    phone.length>=8&&'phone:'+fingerprint(phone),
    telegram&&'telegram:'+fingerprint(telegram)
  ].filter(Boolean);
}
function review(snapshot) {
  const data=snapshot?.data;
  const checked=explicitTime(snapshot?.captured_at);
  if(snapshot?.schema_version!==1||snapshot?.source_system!=='EXISTING_IMPERION_HUB'||
     !checked||!data||typeof data!=='object'||Array.isArray(data))
    return {state:'INVALID_OR_UNAUTHORIZED_SNAPSHOT',source:SOURCE,external_actions:0};
  const records=Object.hasOwn(data,'Leads')?data.Leads:data.leads;
  if(!Array.isArray(records)||records.length>4000||
     records.some(r=>!r||typeof r!=='object'||Array.isArray(r)))
    return {state:'INVALID_LEADS_SNAPSHOT',source:SOURCE,external_actions:0};
  const hardStop=new Set();
  for(const r of records)if(flags(r).stopped&&!flags(r).qa)
    for(const token of identifiers(r)) hardStop.add(token);
  const seen=new Set(),tasks=[];
  const counts={rows:records.length,qa_excluded:0,stopped_or_alias:0,
    controller_conflict:0,
    no_chase:0,duplicate:0,missing_id:0,missing_or_unparseable_deadline:0,
    future_quiet:0,owner_review_due:0};
  const now=Date.parse(checked);
  for(const r of records){
    const f=flags(r);
    if(f.qa){counts.qa_excluded++;continue;}
    // Leads is the legacy OSVC tab, but explicit row metadata must never be
    // overwritten with OSVC merely because a misplaced row reached this tab.
    if(['Legal_Entity','legal_entity','Data_Controller'].some(k =>
      Object.hasOwn(r,k) && string(r[k]) && string(r[k])!=='OSVC')){
      counts.controller_conflict++;continue;
    }
    const id=idOf(r);
    if(!id){counts.missing_id++;continue;}
    const tokens=identifiers(r);
    if(f.stopped||tokens.some(t=>hardStop.has(t))){counts.stopped_or_alias++;continue;}
    if(f.quiet){counts.no_chase++;continue;}
    const key=id.toLowerCase();
    if(seen.has(key)){counts.duplicate++;continue;}
    seen.add(key);
    const followups=Number(col(r,'Followup_Count'));
    if(!ACTIVE.has(f.stage)&&Number.isInteger(followups)&&followups>=2){
      counts.no_chase++;continue;
    }
    const due=[];
    const next=dueAt(col(r,'Next_Action_At'));
    if(next)due.push({date:next,purpose:'NEXT_STEP_OWNER_REVIEW',rank:3});
    const service=dueAt(col(r,'Service_Review_At'));
    if(service&&string(col(r,'Client_Care_Action')))
      due.push({date:service,purpose:'SERVICE_OUTCOME_OWNER_REVIEW',rank:1});
    const renewal=dueAt(col(r,'Renewal_At'));
    const remainingRaw=col(r,'Sessions_Remaining');
    const remaining=Number(remainingRaw);
    if(renewal&&ACTIVE.has(f.stage)&&remainingRaw!==''&&
       remainingRaw!==null&&remainingRaw!==undefined&&
       Number.isInteger(remaining)&&remaining>=0&&remaining<=1)
      due.push({date:renewal,purpose:'RENEWAL_OWNER_REVIEW',rank:0});
    if(!due.length){counts.missing_or_unparseable_deadline++;continue;}
    due.sort((a,b)=>a.rank-b.rank||a.date.localeCompare(b.date));
    const selected=due.find(d=>Date.parse(d.date)<=now);
    if(!selected){counts.future_quiet++;continue;}
    counts.owner_review_due++;
    const paid=Number(col(r,'Paid_CZK'));
    tasks.push({
      lead_id:id,legal_entity:'OSVC',due_at:selected.date,purpose:selected.purpose,
      state:f.hold?'HOLD_VERIFY_OWNER_BASIS':'DUE_OWNER_REVIEW',
      next:'CHECK_EXISTING_THREAD_CRM_OPT_OUT_PRICE_AND_PROVIDER_RECEIPTS',
      message_channel:'NOT_VERIFIED',marketing_consent:'NOT_VERIFIED',
      paid_czk_status:Number.isFinite(paid)&&paid>0?'CRM_CLAIM_NOT_BANK_VERIFIED':'NOT_VERIFIED',
      contact_allowed:false,automatic_message:false,external_send_go_required:true
    });
  }
  tasks.sort((a,b)=>a.due_at.localeCompare(b.due_at)||a.lead_id.localeCompare(b.lead_id));
  return {state:'OWNER_REVIEW_ONLY',source:SOURCE,checked_at:checked,controller:'OSVC',
    counts,queue_total:tasks.length,queue:tasks.slice(0,50),
    queued_for_sending:0,external_actions:0,new_crm_records:0,payments_verified:0,
    bank_provider_readback:'NOT_PERFORMED',
    ngo_contacts_used:0,ngo_commercial_cross_sell:false,
    next:'OWNER_MAY_VERIFY_DUE_CASES_IN_CANONICAL_CRM; NO_AUTOMATED_FOLLOWUP'};
}
module.exports={explicitTime,localPrague,dueAt,review};
