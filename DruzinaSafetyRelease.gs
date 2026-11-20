/**
 * Družina Booking Portal p11 — fail-closed paid release and per-session safe capacity.
 * Installed into the EXISTING owner-bound Apps Script (not a new backend).
 * No mutations, API calls, mail, bank charges, or public releases happen here.
 */
const DRUS_ENQUIRY_URL = 'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/prihlaska/';
const DRUS_CAPACITY_SHEET = 'Druzina_Training_Capacity_Gate';

function drusPaidRelease_(){
  try {
    const p=PropertiesService.getScriptProperties(), cfg=configMap_();
    const required=[
      'DRU_PAID_BOOKING_APPROVED',
      'DRU_LEGAL_SELLER_CONFIRMED',
      'DRU_FIO_SETTLEMENT_SELLER_CONFIRMED',
      'DRU_FIO_READONLY_CONFIRMED',
      'DRU_OSVC_ACTIVITY_INSURANCE_VERIFIED',
      'DRU_TRADE_AUTHORIZATION_VERIFIED',
      'DRU_BOOKING_OTP_LIVE_VERIFIED',
      'DRU_BANK_RECONCILIATION_E2E_VERIFIED',
      'DRU_BOOKING_RELEASE_E2E_VERIFIED'
    ];
    if(required.some(k=>p.getProperty(k)!=='YES')) return {ok:false,code:'BOOKING_PAUSED'};
    if(!String(cfg.RULES_VERSION||'').trim()||!String(cfg.SAFETY_FORM_VERSION||'').trim()||
       !/^DRU-2026-11-v2(?:-|$)/.test(String(cfg.NOV_POLICY_VERSION||'')))
      return {ok:false,code:'BOOKING_PAUSED'};
    if(String(cfg.REQUIRE_BOOKING_VERIFICATION).toUpperCase()==='FALSE')
      return {ok:false,code:'BOOKING_PAUSED'};
    // Canonical property keys of the existing DruzinaFioBridge, never
    // the obsolete FIO_OSVC_* aliases. No token/account value is returned.
    if(!drusBankConfigReady_(p)||!DRUS_PAID_BANK_ADAPTER_LIVE)
      return {ok:false,code:'BOOKING_PAUSED'};
    return {ok:true,code:'OWNER_RELEASE_GATES_CONFIGURED'};
  }catch(_){return {ok:false,code:'BOOKING_PAUSED'};}
}
function drusRequirePaid_(){
  if(!drusPaidRelease_().ok)
    throw new Error('Paid bookings are paused until bank, seller, consent and per-date safety checks pass. Enquire via the official site.');
}
function drusInt_(v,zeroOK){
  const s=String(v==null?'':v).trim();
  if(!/^(0|[1-9][0-9]{0,3})$/.test(s))return null;
  const n=Number(s); return Number.isSafeInteger(n)&&(zeroOK||n>0)?n:null;
}
function drusVerified_(v){return String(v||'').trim().toUpperCase()==='VERIFIED';}
function drusCapacityFromRow_(session,gate){
  if(!session||!gate||String(session.Status)!=='OPEN'||String(gate.Session_ID)!==String(session.Session_ID))return 0;
  if(String(session.Notes||'').toUpperCase().includes('CANCELLED'))return 0;
  if(String(gate.Slot_State)!=='CONFIRMED'||String(gate.Publish_Confirmed_Only)!=='YES'||
     String(gate.Newcomer_Ready)!=='YES')return 0;
  for(const name of ['Instructor_Verified','Venue_Permission_Verified',
    'Activity_Insurance_Verified','Participant_Safety_Form_Valid','Equipment_Check']){
    if(!drusVerified_(gate[name]))return 0;
  }
  const guardian=String(gate.Guardian_Gate_If_Minors||'').toUpperCase();
  if(!['VERIFIED','NOT_APPLICABLE'].includes(guardian))return 0;
  if(!String(gate.Evidence_Source||'').trim()||
     !String(gate.Reviewer_and_proof_of_100_TOTAL_not_ready||'').trim())return 0;
  const signed=drusInt_(gate.Max_Attendance_Checked,false),
        staff=drusInt_(gate.Staff_And_Marshals_Count,false),
        bystanders=drusInt_(gate.Other_Humans_Count_Parents_Spectators,true),
        bookable=drusInt_(gate.BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA,false),
        legacy=drusInt_(session.Capacity,false);
  if(signed===null||staff===null||bystanders===null||bookable===null||legacy===null)return 0;
  if(signed>100||staff+bystanders>=100||signed<staff+bystanders)return 0;
  return Math.max(0,Math.min(signed-staff-bystanders,100-staff-bystanders,bookable,legacy));
}
function drusCapacityGateMap_(){
  const map={};
  if(!ss_().getSheetByName(DRUS_CAPACITY_SHEET))return map;
  rows_(DRUS_CAPACITY_SHEET).forEach(r=>{
    const id=String(r.Session_ID||''); if(id)map[id]=r;
  });
  return map;
}
function drusSafeCapacity_(session,map){
  const gates=map||drusCapacityGateMap_();
  return drusCapacityFromRow_(session,gates[String(session&&session.Session_ID)||'']);
}
function drusRequireSession_(session,map){
  if(drusSafeCapacity_(session,map)<=0)
    throw new Error('The selected training is not approved for paid booking at this date and venue.');
}
function drusRequireMemberConsent_(member){
  const cfg=configMap_(),record=consentMap_()[String(member&&member.Member_ID)||''];
  if(!consentStatus_(record,cfg).ready)
    throw new Error('Participant safety/rules/guardian evidence is not verified. Please contact the organizer.');
}
function drusNeverProofAsPayment_(){
  throw new Error('A payment screenshot is not bank settlement. Proof-only checkout is disabled; contact the organizer for verified payment instructions.');
}

function drusApprovedProductActive_(){
  const allowed=['DRU-FIRSTVISIT-202611','DRU-JUNIOR-FLEX-202611',
    'DRU-SENIOR-FLEX-202611','DRU-STARTER4-202611'];
  const p=productMap_();
  return allowed.some(k=>p[k]&&String(p[k].Active).toUpperCase()==='TRUE');
}
