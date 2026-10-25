/*
 * Druzina Moravy — payment/booking quote policy (STAGING ONLY).
 * Portable pure JavaScript for the existing dedicated Google Apps Script portal.
 * NO API calls, token access, ledger writes or payment links. No sale is enabled.
 * Trusted server inputs ONLY. The browser must never supply amount, tier, debt,
 * venue approval, attendance evidence, payment result or merchant identity.
 *
 * One canonical private CRM: existing Druzina_* tabs in Community Hub Sheet.
 * Existing paid rights/October transactions remain unchanged.
 */
var DRUB_POLICY_VERSION = 'DRU-BILL-STAGING-2026-10-25-v1';

function drubFail(code) { return {ok:false, code:code, policyVersion:DRUB_POLICY_VERSION}; }
function drubTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return NaN;
  var t = Date.parse(value);
  return isFinite(t) ? t : NaN;
}
function drubPragueParts(ms) {
  if (!isFinite(ms)) return null;
  var p = new Intl.DateTimeFormat('en-US', {
    timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(ms));
  var o={};
  p.forEach(function(x){ if (x.type==='year'||x.type==='month'||x.type==='day') o[x.type]=x.value; });
  return o;
}
function drubPolicyDate(startMs) {
  var p=drubPragueParts(startMs);
  if (!p) return '';
  return p.year+'-'+p.month+'-'+p.day;
}
function drubWindow(nowMs,startMs) {
  var minutes=(startMs-nowMs)/60000;
  if (!isFinite(minutes)||minutes<=30) return 'CLOSED';
  if (minutes<=180) return 'EMERGENCY';
  if (minutes<=2880) return 'LATE';
  return 'NORMAL';
}
function drubPriceBook(startMs) {
  var newPolicy = drubPolicyDate(startMs)>='2026-11-01';
  return {
    effective: newPolicy ? '2026-11-01' : '2026-10-01',
    version: newPolicy ? 'DRU-2026-11-v2-PENDING-RELEASE' : 'DRU-2026-10-v2',
    firstVisit: newPolicy ? 240 : 120,
    junior:240, senior:newPolicy?200:120,
    starter4:newPolicy?800:null
  };
}
/* Quote one visit or a newly selected four-visit package. Rates reflect event
 * date, not when someone first opened a browser. 20-minute holds do NOT
 * grandfather the old tariff or T-48 eligibility.
 *
 * type: FIRST_VISIT | FLEX | STARTER4 | STARTER4_UPGRADE
 * tier: JUNIOR | SENIOR, already checked by the authoritative member ledger.
 * selectedSessions: ISO timestamps of four future sessions, or three for
 * verified FIRST_VISIT credit (one prior attended counts as session one).
 */
function drubQuoteItem(input) {
  if (!input || typeof input!=='object') return drubFail('INVALID_INPUT');
  var now=drubTime(input.nowISO), start=drubTime(input.sessionStartsAt);
  if (!isFinite(now)||!isFinite(start)) return drubFail('INVALID_DATE');
  var type=String(input.type||''), tier=String(input.tier||'');
  if (!['FIRST_VISIT','FLEX','STARTER4','STARTER4_UPGRADE'].includes(type)
      || !['JUNIOR','SENIOR'].includes(tier)) return drubFail('INVALID_PRODUCT_OR_TIER');
  var window=drubWindow(now,start), priceBook=drubPriceBook(start);
  if (window==='CLOSED') return drubFail('CLOSED_30M');
  if (type==='FIRST_VISIT') {
    if (window!=='NORMAL') return drubFail('FIRST_VISIT_48H_REQUIRED');
    if (input.firstVisitEligible!==true) return drubFail('FIRST_VISIT_NOT_ELIGIBLE');
    return {ok:true,type:type,amountCZK:priceBook.firstVisit,window:window,
      sessionStartsAt:input.sessionStartsAt,tier:'FIRST_VISIT',currency:'CZK',
      policyVersion:priceBook.version,quoteVersion:DRUB_POLICY_VERSION};
  }
  if (type==='FLEX') {
    if (input.firstVisitEligible===true) return drubFail('FIRST_VISIT_REQUIRES_ONBOARDING');
    var base=tier==='SENIOR'?priceBook.senior:priceBook.junior;
    var multiplier=window==='LATE'?1.25:window==='EMERGENCY'?1.5:1;
    if (window==='EMERGENCY' && input.existingMemberVerified!==true)
      return drubFail('EMERGENCY_EXISTING_MEMBERS_ONLY');
    return {ok:true,type:type,amountCZK:Math.round(base*multiplier),baseCZK:base,
      window:window,sessionStartsAt:input.sessionStartsAt,tier:tier,currency:'CZK',
      policyVersion:priceBook.version,quoteVersion:DRUB_POLICY_VERSION};
  }
  if (!priceBook.starter4) return drubFail('STARTER4_NOT_AVAILABLE_FOR_DATE');
  if (window!=='NORMAL') return drubFail('PACKAGE_SESSION_48H_REQUIRED');
  var upgrade=(type==='STARTER4_UPGRADE');
  var selected=input.selectedSessions;
  if (!Array.isArray(selected) || selected.length!==(upgrade?3:4))
    return drubFail('PACKAGE_REQUIRES_ELIGIBLE_SELECTED_DATES');
  var startDates=selected.map(drubTime);
  if (startDates.some(function(t){return !isFinite(t)||drubWindow(now,t)!=='NORMAL';}))
    return drubFail('PACKAGE_SESSION_48H_REQUIRED');
  var uniq={};
  for(var i=0;i<startDates.length;i++){
    if (startDates[i]!==start && i===0) return drubFail('FIRST_PACKAGE_DATE_MISMATCH');
    var key=String(startDates[i]);
    if (uniq[key]) return drubFail('DUPLICATE_SESSION');
    uniq[key]=true;
    if (i>0&&startDates[i]<=startDates[i-1]) return drubFail('SESSIONS_NOT_ORDERED');
    if (drubPolicyDate(startDates[i])<'2026-11-01') return drubFail('PACKAGE_2026_11_ONLY');
  }
  var validityFrom=startDates[0], amount=priceBook.starter4;
  if (upgrade) {
    var first=input.verifiedFirstAttendance;
    if (!first || first.verified!==true || first.creditAlreadyUsed===true
      || first.paymentVerified!==true || first.amountReceivedCZK!==240
      || !first.sessionId || typeof first.sessionId!=='string')
      return drubFail('UPGRADE_FIRST_VISIT_EVIDENCE_REQUIRED');
    var attended=drubTime(first.attendedAt);
    if (!isFinite(attended) || attended>now || now-attended>48*3600000
        || drubPolicyDate(attended)<'2026-11-01')
      return drubFail('UPGRADE_48H_AFTER_ATTENDANCE_REQUIRED');
    if (attended>=startDates[0]) return drubFail('UPGRADE_REQUIRES_FUTURE_SESSIONS');
    validityFrom=attended;amount=560;
  }
  if (startDates[startDates.length-1]-validityFrom>=30*86400000)
    return drubFail('PACKAGE_OUTSIDE_30_DAYS');
  return {ok:true,type:type,amountCZK:amount,currency:'CZK',window:window,
    tier:tier,selectedSessionStarts:selected.slice(),sessionsPurchased:4,
    creditedFirstVisit:upgrade,validityFromISO:new Date(validityFrom).toISOString(),
    validityDays:30,policyVersion:priceBook.version,quoteVersion:DRUB_POLICY_VERSION};
}
/* This evaluates launch gates, *not* payment status. No single success flag is
 * accepted in place of independent service-provider, settlement, consent,
 * per-date capacity/safety and backend identity checks. */
function drubAuthorizeCheckout(context) {
  if (!context || typeof context!=='object') return drubFail('INVALID_INPUT');
  if (context.paymentLaunchApproved!==true) return drubFail('PAID_BOOKING_DISABLED');
  if (context.legalSellerVerified!==true) return drubFail('LEGAL_SELLER_UNVERIFIED');
  if (context.beneficiaryVerified!==true) return drubFail('BENEFICIARY_UNVERIFIED');
  if (context.identityVerified!==true) return drubFail('IDENTITY_UNVERIFIED');
  if (context.outstandingCZK!==0) return drubFail('OUTSTANDING_OR_UNKNOWN_BALANCE');
  if (context.existingContractHonoured!==true) return drubFail('LEGACY_RIGHTS_UNVERIFIED');
  if (context.isMinor && context.guardianConsentVerified!==true)
    return drubFail('GUARDIAN_CONSENT_REQUIRED');
  if (!Array.isArray(context.eventGates)||context.eventGates.length===0)
    return drubFail('EVENT_GATES_REQUIRED');
  for(var i=0;i<context.eventGates.length;i++) {
    var g=context.eventGates[i];
    if (!g || g.status!=='CONFIRMED' || g.venueWrittenPermission!==true
        || g.safetyPlanVerified!==true || g.instructorVerified!==true
        || g.insuranceVerified!==true || g.equipmentVerified!==true
        || g.firstAidVerified!==true || g.capacityWrittenVerified!==true
        || !Number.isInteger(g.remainingSafePlaces) || g.remainingSafePlaces<1)
      return drubFail('SESSION_SAFETY_OR_CAPACITY_UNCONFIRMED');
  }
  return {ok:true,code:'GATES_PASSED_NOT_PAID',policyVersion:DRUB_POLICY_VERSION};
}
/* Reconcile a normalized read-only Fio transaction; passed only by trusted
 * server importer after checking the API token belongs to the actual payee.
 * Never use a browser screenshot, a client's claimed payment, or bank
 * settlement timestamp to determine when their booking request was lodged.
 * Caller must enforce transaction UNIQUE and quote UNIQUE within a DB lock.
 */
function drubMatchBankTransfer(movement,expected,usedTransactionIds) {
  if (!movement||!expected) return drubFail('INVALID_INPUT');
  if (expected.payeeVerified!==true || movement.tokenAccountVerified!==true)
    return drubFail('BANK_ACCOUNT_UNVERIFIED');
  if (!expected.payeeAccountKey || movement.accountKey!==expected.payeeAccountKey)
    return drubFail('WRONG_BENEFICIARY_ACCOUNT');
  if (!expected.paymentRef || !/^\d{1,10}$/.test(expected.paymentRef)
      || movement.variableSymbol!==expected.paymentRef)
    return drubFail('REFERENCE_MISMATCH');
  if (movement.currency!=='CZK') return drubFail('CURRENCY_MISMATCH');
  if (!movement.transactionId || !/^[A-Za-z0-9:-]{3,120}$/.test(movement.transactionId))
    return drubFail('NO_BANK_TRANSACTION_ID');
  if (Array.isArray(usedTransactionIds)&&usedTransactionIds.indexOf(movement.transactionId)>=0)
    return drubFail('ALREADY_RECONCILED');
  if (movement.isReversal===true || movement.direction!=='CREDIT')
    return drubFail('NOT_SETTLED_INCOMING');
  if (!Number.isInteger(expected.amountCZK)||expected.amountCZK<=0
      || !Number.isInteger(movement.amountCZK)||movement.amountCZK<=0)
    return drubFail('INVALID_AMOUNT');
  if (movement.amountCZK!==expected.amountCZK)
    return drubFail('AMOUNT_MISMATCH_REVIEW');
  if (expected.status!=='PENDING_PAYMENT') return drubFail('QUOTE_NOT_PENDING');
  return {ok:true,code:'MATCHED_BANK_RECEIPT',
    reference:expected.paymentRef,transactionId:movement.transactionId,
    amountCZK:movement.amountCZK,currency:'CZK',
    policyVersion:DRUB_POLICY_VERSION};
}
