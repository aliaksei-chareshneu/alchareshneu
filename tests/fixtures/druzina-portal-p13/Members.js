function normalizeEmail_(x){ return String(x||'').trim().toLowerCase(); }
function normalizePhone_(x){ return String(x||'').replace(/[^0-9+]/g,''); }

function ensureSeniorTierColumn_(){
  return withLock_(()=>{
    const sheet=sh_(SHEETS.MEMBERS), headers=headers_(SHEETS.MEMBERS);
    if(headers.indexOf('Tier_Eligibility_Source')<0){
      const nextColumn=headers.length+1;
      const capacity=sheet.getMaxColumns();
      if(capacity<nextColumn) sheet.insertColumnsAfter(capacity,nextColumn-capacity);
      sheet.getRange(1,nextColumn).setValue('Tier_Eligibility_Source');
    }
  });
}

function memberByToken_(token) {
  if (!token) return null;
  return findOne_(SHEETS.MEMBERS, r => String(r.Manage_Token || '') === String(token));
}

function findMember_(email, phone) {
  const e=normalizeEmail_(email), p=normalizePhone_(phone);
  if (!e && !p) return null;
  return findOne_(SHEETS.MEMBERS, r => (e && normalizeEmail_(r.Email)===e) || (p && normalizePhone_(r.Phone)===p));
}

function ensureMember_(payload) {
  return withLock_(()=>{
  ensureSeniorTierColumn_();
  if(!normalizeEmail_(payload.email)&&!normalizePhone_(payload.phone)) throw new Error('Email or phone is required');
  let m = findMember_(payload.email, payload.phone);
  if (m) {
    if (!m.Manage_Token) {
      const tok=id_('MNG');
      patchRow_(SHEETS.MEMBERS,m._row,{Manage_Token:tok});
      m.Manage_Token=tok;
    }
    return m;
  }
  const memberId=id_('MEM'), token=id_('MNG');
  appendObj_(SHEETS.MEMBERS, {
    Member_ID:memberId, Full_Name:String(payload.name||'').trim(), Email:normalizeEmail_(payload.email), Phone:normalizePhone_(payload.phone),
    Telegram_Handle:String(payload.telegram||'').trim(), Tier:'Junior', Rank:'Otrok', Active:true, Joined_At:nowIso_(),
    Attendance_30d:0, Attendance_Total:0, Battles:0, Preferred_Days:'', Current_Plan_ID:'', Plan_End:'', Notes:'Created by booking portal',
    Account_Status:'ACTIVE', Outstanding_CZK:0, Hold_Reason:'', Manage_Token:token, Tier_Eligibility_Source:'AUTO_30D'
  });
  return findOne_(SHEETS.MEMBERS,r=>String(r.Member_ID)===memberId);
  });
}

function outstandingFor_(memberId) {
  const open = findAll_(SHEETS.LEDGER, r => String(r.Member_ID)===String(memberId) && String(r.Status)==='OPEN' && String(r.Blocks_Booking).toUpperCase()!=='FALSE');
  return open.reduce((s,r)=>s+money_(r.Amount_CZK),0);
}

function refreshMemberAccount_(member, attendanceCount) {
  const out=outstandingFor_(member.Member_ID);
  const ledgerHold=!!findOne_(SHEETS.LEDGER,r=>String(r.Member_ID)===String(member.Member_ID)&&String(r.Status)==='OPEN'&&String(r.Blocks_Booking).toUpperCase()!=='FALSE');
  const manualHold=String(member.Account_Status)==='HOLD'&&String(member.Hold_Reason||'')!=='Outstanding balance';
  const patch={Outstanding_CZK:out, Account_Status:ledgerHold||manualHold?'HOLD':'ACTIVE', Hold_Reason:manualHold?String(member.Hold_Reason||'Account hold'):ledgerHold?'Outstanding balance':''};
  patchRow_(SHEETS.MEMBERS,member._row,patch);
  Object.assign(member,patch);
  return refreshMemberTier_(member,attendanceCount);
}

function memberBlocked_(member) {
  return String(member.Account_Status)==='HOLD'||money_(member.Outstanding_CZK)>0;
}

// Senior is earned by attendance, never by volunteering, equipment work or merely buying dates.
// A verified payment is required; a submitted receipt remains provisional until reconciliation.
function verifiedPaidAttendance30d_(){
  const now=Date.now(), since=now-30*86400000;
  const sessionStarts={};
  rows_(SHEETS.SESSIONS).forEach(s=>{
    const start=new Date(s.Start_DateTime).getTime();
    if(Number.isFinite(start)&&start>=since&&start<=now) sessionStarts[String(s.Session_ID)]=start;
  });
  const paid={};
  rows_(SHEETS.PAYMENTS).forEach(p=>{
    if(String(p.Verification_Status)==='VERIFIED'&&money_(p.Amount_CZK)>0) paid[String(p.Payment_ID)]=String(p.Member_ID);
  });
  const seen={}, counts={};
  rows_(SHEETS.BOOKINGS).forEach(b=>{
    const memberId=String(b.Member_ID||''), sessionId=String(b.Session_ID||'');
    const key=memberId+'|'+sessionId;
    if(!memberId||!Object.prototype.hasOwnProperty.call(sessionStarts,sessionId)||seen[key]) return;
    if(String(b.Attendance_Status)!=='PRESENT'||['CANCELLED','CLUB_CANCELLED','NO_SHOW','PAYMENT_EXCEPTION'].includes(String(b.Status))) return;
    if(paid[String(b.Payment_ID)]!==memberId) return;
    seen[key]=true; counts[memberId]=(counts[memberId]||0)+1;
  });
  return counts;
}

function recomputeAttendance30d_(memberId){
  return verifiedPaidAttendance30d_()[String(memberId)]||0;
}

// Keep the displayed tier for an already paid Senior cycle through its end and
// the existing seven-day renewal grace. Debt/HOLD blocks new purchases separately.
function hasPaidSeniorCycle_(member){
  const now=Date.now();
  return rows_(SHEETS.PLANS).some(plan=>{
    if(String(plan.Member_ID)!==String(member.Member_ID)||!/^DRU-SENIOR(?:4|8|12)-/.test(String(plan.Product_Code))) return false;
    if(!['ACTIVE','COMPLETED','EXPIRED'].includes(String(plan.Status))) return false;
    const start=new Date(plan.Start_Date).getTime(), end=new Date(plan.End_Date).getTime();
    if(!Number.isFinite(start)||!Number.isFinite(end)||now<start||now>end+7*86400000) return false;
    const payment=findOne_(SHEETS.PAYMENTS,p=>String(p.Payment_ID)===String(plan.Payment_ID));
    return !!payment&&String(payment.Verification_Status)==='VERIFIED'&&money_(payment.Amount_CZK)>0;
  });
}

function refreshMemberTier_(member, attendanceCount){
  if(!Object.prototype.hasOwnProperty.call(member,'Tier_Eligibility_Source'))
    ensureSeniorTierColumn_();
  // Attendance_30d is a reporting metric, never same-month price eligibility.
  const count=attendanceCount===undefined?recomputeAttendance30d_(member.Member_ID):Number(attendanceCount||0);
  const month=druseSeniorPreviousMonth_(member.Member_ID,new Date().toISOString());
  const earned=month.ok===true&&month.seniorEligible===true;
  const prior=String(member.Tier_Eligibility_Source||'');
  const priorSenior=String(member.Tier)==='Senior';
  const paidCycle=hasPaidSeniorCycle_(member);
  // Prior senior benefits may predate this policy. Never withdraw an existing
  // entitlement without review: retain it as LEGACY_REVIEW if unsupported.
  const legacySenior=prior==='LEGACY_REVIEW'||
    (priorSenior&&!earned&&!paidCycle&&prior!=='AUTO_PREV_MONTH');
  const source=legacySenior?'LEGACY_REVIEW':'AUTO_PREV_MONTH';
  const tier=earned||paidCycle||legacySenior?'Senior':'Junior';
  if(Number(member.Attendance_30d||0)!==count||String(member.Tier||'Junior')!==tier||prior!==source){
    patchRow_(SHEETS.MEMBERS,member._row,{
      Attendance_30d:count,Tier:tier,Tier_Eligibility_Source:source
    });
    member.Attendance_30d=count;member.Tier=tier;member.Tier_Eligibility_Source=source;
  }
  return member;
}

function refreshAllMemberTiers_(){
  const counts=verifiedPaidAttendance30d_();
  rows_(SHEETS.MEMBERS).forEach(member=>{
    refreshMemberAccount_(member,counts[String(member.Member_ID)]||0);
  });
}

function assertMemberCanBook_(member) {
  refreshMemberAccount_(member);
  if(memberBlocked_(member)) throw new Error(money_(member.Outstanding_CZK)>0?'Outstanding balance must be cleared first':'Account is on HOLD; contact the organizer');
}

function publicMemberState_(member, includeToken) {
  member=refreshMemberAccount_(member);
  const out={id:String(member.Member_ID),name:String(member.Full_Name||''),tier:String(member.Tier||'Junior'),rank:String(member.Rank||''),status:String(member.Account_Status||'ACTIVE'),outstanding:money_(member.Outstanding_CZK)};
  if(includeToken) out.manageToken=String(member.Manage_Token||'');
  return out;
}
