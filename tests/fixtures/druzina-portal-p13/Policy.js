function novEffectiveDate_(){ return new Date('2026-11-01T00:00:00+01:00'); }
function novAdvanceStart_(){
  const cfg=configMap_();
  return new Date(String(cfg.NOV_ADVANCE_BOOKING_START || '2026-10-25T00:00:00+02:00'));
}
function novPackageSalesOpen_(){ return new Date() >= novAdvanceStart_(); }
function isNovEffectiveFor_(dateLike){ return new Date(dateLike) >= novEffectiveDate_(); }

function policyVersionForDate_(dateLike) {
  const cfg = configMap_();
  return isNovEffectiveFor_(dateLike)
    ? String(cfg.NOV_POLICY_VERSION || 'DRU-2026-11-v1')
    : String(cfg.CURRENT_POLICY_VERSION || 'DRU-2026-10-v2');
}

function policyVersion_() { return policyVersionForDate_(new Date()); }

function hoursUntil_(dateLike) {
  return (new Date(dateLike).getTime() - Date.now()) / 3600000;
}

function windowFor_(sessionStart) {
  const h = hoursUntil_(sessionStart);
  if (h > 48) return 'STANDARD';
  if (h >= 3) return 'LATE';
  if (h >= 0.5) return 'EMERGENCY';
  return 'CLOSED';
}

function tariffForDate_(dateLike) {
  const after = isNovEffectiveFor_(dateLike);
  return after ? {
    trial:240, juniorFlex:240, seniorFlex:200, starter4:800, senior4:650, senior8:1100, senior12:1500,
    juniorLate:300, seniorLate:250, juniorEmergency:360, seniorEmergency:300
  } : {
    trial:120, juniorFlex:240, seniorFlex:120, starter4:null, senior4:null, senior8:null, senior12:null,
    juniorLate:300, seniorLate:150, juniorEmergency:360, seniorEmergency:180
  };
}

function currentTariff_() { return tariffForDate_(new Date()); }

function productForWindow_(tier, sessionStart) {
  const w = windowFor_(sessionStart);
  const nov = isNovEffectiveFor_(sessionStart);
  const t = String(tier || 'Junior').toLowerCase();
  const senior = t === 'senior';
  if (w === 'CLOSED') return null;
  if (w === 'STANDARD') return senior ? (nov ? 'DRU-SENIOR-FLEX-202611' : 'DRU-SENIOR-DROPIN') : (nov ? 'DRU-JUNIOR-FLEX-202611' : 'DRU-JUNIOR-DROPIN');
  if (w === 'LATE') return senior ? (nov ? 'DRU-SENIOR-LATE-202611' : 'DRU-SENIOR-LATE-202610') : (nov ? 'DRU-JUNIOR-LATE-202611' : 'DRU-JUNIOR-LATE-202610');
  return senior ? (nov ? 'DRU-SENIOR-EMERGENCY-202611' : 'DRU-SENIOR-EMERGENCY-202610') : (nov ? 'DRU-JUNIOR-EMERGENCY-202611' : 'DRU-JUNIOR-EMERGENCY-202610');
}

function normalFlexPriceFor_(member, sessionStart) {
  const t=tariffForDate_(sessionStart);
  return String(member.Tier || 'Junior').toLowerCase()==='senior' ? t.seniorFlex : t.juniorFlex;
}

function packageInfo_(productCode) {
  const map = {
    'DRU-STARTER4-202611': {sessions:4, price:800, eligible:['Junior'], name:'Starter 4', effectiveFrom:'2026-11-01T00:00:00+01:00'},
    'DRU-SENIOR4-202611': {sessions:4, price:650, eligible:['Senior'], name:'Senior Regular 4', effectiveFrom:'2026-11-01T00:00:00+01:00'},
    'DRU-SENIOR8-202611': {sessions:8, price:1100, eligible:['Senior'], name:'Senior Active 8', effectiveFrom:'2026-11-01T00:00:00+01:00'},
    'DRU-SENIOR12-202611': {sessions:12, price:1500, eligible:['Senior'], name:'Senior Core 12', effectiveFrom:'2026-11-01T00:00:00+01:00'}
  };
  return map[productCode] || null;
}

function effectivePrice_(productCode) {
  const p = productMap_()[productCode];
  if (!p||String(p.Active).toUpperCase()!=='TRUE') throw new Error('Product not approved for paid sale');
  return money_(p.Price_CZK);
}

function paymentContainsProduct_(paymentId, productCode){
  const p=findOne_(SHEETS.PAYMENTS,r=>String(r.Payment_ID)===String(paymentId));
  if(p && String(p.Product_Code)===String(productCode)) return true;
  return !!findOne_(SHEETS.PAYMENT_ITEMS,r=>String(r.Payment_ID)===String(paymentId) && String(r.Product_Code)===String(productCode));
}

function isTrialEligible_(member){
  if(Number(member.Attendance_Total||0)>0) return false;
  const existing=findAll_(SHEETS.BOOKINGS,r=>String(r.Member_ID)===String(member.Member_ID) && !['CANCELLED','CLUB_CANCELLED','PAYMENT_EXCEPTION'].includes(String(r.Status)));
  for(let i=0;i<existing.length;i++) if(paymentContainsProduct_(existing[i].Payment_ID,'DRU-TRIAL')||paymentContainsProduct_(existing[i].Payment_ID,'DRU-FIRSTVISIT-202611')) return false;
  return true;
}

function starterUpgradeEligibility_(member){
  if(String(member.Tier||'Junior')!=='Junior') return null;
  const already=findOne_(SHEETS.PLANS,r=>String(r.Member_ID)===String(member.Member_ID) && String(r.Product_Code)==='DRU-STARTER4-202611' && ['ACTIVE','COMPLETED'].includes(String(r.Status)));
  if(already) return null;
  const candidates=findAll_(SHEETS.BOOKINGS,r=>String(r.Member_ID)===String(member.Member_ID) && String(r.Status)==='ATTENDED' && String(r.Attendance_Status)==='PRESENT' && String(r.Attendance_Checked).toUpperCase()==='TRUE' && paymentContainsProduct_(r.Payment_ID,'DRU-FIRSTVISIT-202611'));
  candidates.sort((a,b)=>new Date(sessionById_(b.Session_ID)?.Start_DateTime||0)-new Date(sessionById_(a.Session_ID)?.Start_DateTime||0));
  for(let i=0;i<candidates.length;i++){
    const b=candidates[i], s=sessionById_(b.Session_ID); if(!s) continue;
    if(b.Plan_ID) continue;
    const payment=findOne_(SHEETS.PAYMENTS,p=>String(p.Payment_ID)===String(b.Payment_ID));
    if(!payment||String(payment.Verification_Status)!=='VERIFIED') continue;
    const trialLine=findOne_(SHEETS.PAYMENT_ITEMS,p=>String(p.Payment_ID)===String(b.Payment_ID)&&String(p.Product_Code)==='DRU-FIRSTVISIT-202611');
    const trialPaid=trialLine?money_(trialLine.Line_Total_CZK):String(payment.Product_Code)==='DRU-FIRSTVISIT-202611'?money_(payment.Amount_CZK):0;
    if(trialPaid!==240) continue;
    const start=new Date(s.Start_DateTime), end=new Date(s.End_DateTime||s.Start_DateTime);
    if(start < novEffectiveDate_()) continue;
    const h=(Date.now()-end.getTime())/3600000;
    if(h>=0 && h<=48) return {bookingId:String(b.Booking_ID),sessionId:String(s.Session_ID),start:start.toISOString(),end:end.toISOString(),credit:240,remaining:560};
  }
  return null;
}

function validateSessionProduct_(member, productCode, session) {
  if (!session) throw new Error('Session not found');
  if (String(session.Status || 'OPEN') !== 'OPEN') throw new Error('Session is not open');
  drusRequireSession_(session);
  const w = windowFor_(session.Start_DateTime);
  if (w === 'CLOSED') throw new Error('Booking for this training is closed');
  if(findOne_(SHEETS.BOOKINGS,b=>String(b.Member_ID)===String(member.Member_ID)&&String(b.Session_ID)===String(session.Session_ID)&&['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED','ATTENDED','NO_SHOW'].includes(String(b.Status)))) throw new Error('You already have a booking for this session');
  if(w==='EMERGENCY'&&Number(member.Attendance_Total||0)<=0&&!findOne_(SHEETS.BOOKINGS,b=>String(b.Member_ID)===String(member.Member_ID)&&['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED','ATTENDED','NO_SHOW'].includes(String(b.Status)))) throw new Error('Emergency Flex is available to existing members only');

  if(productCode==='DRU-TRIAL'||productCode==='DRU-FIRSTVISIT-202611'){
    if(isNovEffectiveFor_(session.Start_DateTime)!==(productCode==='DRU-FIRSTVISIT-202611'))
      throw new Error('First visit product does not match session policy date');
    if(w!=='STANDARD') throw new Error('First visit must be booked at least 48 hours in advance');
    if(!isTrialEligible_(member)) throw new Error('Trial is not available for this member');
    return w;
  }

  const pkg = packageInfo_(productCode);
  if (pkg) {
    if (!novPackageSalesOpen_()) throw new Error('November packages are not on sale yet');
    if(productCode!=='DRU-STARTER4-202611') throw new Error('Package validity and rights are not released');
    if (w !== 'STANDARD') throw new Error('Packages can only cover sessions at least 48 hours away');
    if (new Date(session.Start_DateTime) < new Date(pkg.effectiveFrom)) throw new Error('This package can only cover sessions from 1 November 2026');
    if (pkg.eligible.indexOf(String(member.Tier || 'Junior')) < 0) throw new Error('This package is not available for your current tier');
  } else {
    const allowed = productForWindow_(member.Tier, session.Start_DateTime);
    if (allowed !== productCode) throw new Error('Wrong product for current booking window. Expected ' + allowed);
  }
  return w;
}
