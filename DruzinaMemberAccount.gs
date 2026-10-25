/*
 * Private Druzina member-account projection — STAGING, READ-ONLY, no I/O.
 * Input MUST come exclusively from owner-side Apps Script after its actual
 * email-OTP session is verified and bound to a Member_ID. Do not send
 * unfiltered CRM, payment, health, parent details or consent to browser.
 */
var DRUA_VIEW_VERSION='DRUA-PRIVATE-STAGED-2026-10-25-v1';
function druaFail(code) {return {ok:false,code:code,viewVersion:DRUA_VIEW_VERSION};}
function druaSafeInt(x) {
  var n=Number(x);
  return Number.isInteger(n) && n>=0 && n<=100000000 ? n : 0;
}
function druaText(value,max) {
  return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max||120);
}
function druaPrivateView(auth,source) {
  if (!auth||auth.serverOtpVerified!==true||auth.sessionOwnerVerified!==true||
      !auth.memberId||typeof auth.memberId!=='string')
    return druaFail('AUTH_REQUIRED');
  if (!source||!source.member||String(source.member.Member_ID)!==auth.memberId)
    return druaFail('MEMBER_NOT_FOUND');
  var id=auth.memberId;
  var own=function(rows){return (Array.isArray(rows)?rows:[])
      .filter(function(r){return r && String(r.Member_ID)===id;});};
  var names=druaText(source.member.Full_Name,100);
  var ledger=own(source.ledger);
  var debtLines=ledger.filter(function(r){
    return String(r.Status)==='OPEN' &&
      (r.Blocks_Booking===true||String(r.Blocks_Booking).toUpperCase()==='TRUE');
  });
  var debt=debtLines.reduce(function(s,r){return s+druaSafeInt(r.Amount_CZK);},0);
  var payments=own(source.payments).map(function(r){
    var status=String(r.Verification_Status||'');
    var verified=status==='VERIFIED' && !!r.Verified_At &&
      druaSafeInt(r.Received_Amount_CZK)===druaSafeInt(r.Expected_Amount_CZK)
      && druaSafeInt(r.Expected_Amount_CZK)>0;
    return {
      paymentId:druaText(r.Payment_ID,120),
      productCode:druaText(r.Product_Code,80),
      expectedCZK:druaSafeInt(r.Expected_Amount_CZK),
      confirmedReceivedCZK:verified?druaSafeInt(r.Received_Amount_CZK):0,
      status:verified?'PAID_VERIFIED':(/EXCEPTION|FAILED|REVERSED/.test(status)?'EXCEPTION':'PENDING_VERIFICATION')
    };
  }).slice(0,30);
  var plans=own(source.plans).map(function(r){
    var total=druaSafeInt(r.Package_Sessions||r.Sessions_Scheduled);
    var used=druaSafeInt(r.Sessions_Used);
    var noShow=druaSafeInt(r.Sessions_NoShow);
    return {planId:druaText(r.Plan_ID,120),productCode:druaText(r.Product_Code,80),
      status:druaText(r.Status,40),starts:druaText(r.Start_Date,40),ends:druaText(r.End_Date,40),
      scheduled:total,used:used,noShow:noShow,remaining:Math.max(0,total-used-noShow)};
  }).slice(0,20);
  var sessions={};
  (Array.isArray(source.sessions)?source.sessions:[]).forEach(function(r){
    if(r && r.Session_ID) sessions[String(r.Session_ID)]=r;
  });
  var bookings=own(source.bookings).map(function(r){
    var s=sessions[String(r.Session_ID)]||{};
    var time=String(s.Start_DateTime||s.Starts_At||'');
    return {bookingId:druaText(r.Booking_ID,120),sessionId:druaText(r.Session_ID,120),
      starts:time&&/^\d{4}-\d{2}-\d{2}/.test(time)?druaText(time,40):'UNCONFIRMED',
      status:druaText(r.Status,60),attendance:druaText(r.Attendance_Status,40),
      appliedPriceCZK:druaSafeInt(r.Applied_Price_CZK)};
  }).slice(0,30);
  var checkpoints={};
  (Array.isArray(source.checkpoints)?source.checkpoints:[]).forEach(function(r){
    if(r && String(r.Status)==='ACTIVE') checkpoints[String(r.Checkpoint_ID)]=true;
  });
  var skillMap={};
  own(source.skills).forEach(function(r){
    var key=String(r.Checkpoint_ID);
    var passed=String(r.Assessment_Status)==='PASSED' &&
      (r.Safety_Verified===true||String(r.Safety_Verified).toUpperCase()==='TRUE') &&
      (r.Skill_Verified===true||String(r.Skill_Verified).toUpperCase()==='TRUE') &&
      !!r.Instructor_Ref && !!r.Verified_At && !!checkpoints[key];
    if (passed) skillMap[key]={
      checkpointId:druaText(key,120),trackId:druaText(r.Track_ID,60),
      tier:druaText(r.Tier,30),verifiedAt:druaText(r.Verified_At,40)
    };
    // A REVOKED assessment must suppress the old pass.
    if(String(r.Assessment_Status)==='REVOKED') delete skillMap[key];
  });
  var profile={
    displayName:names,accountStatus:druaText(source.member.Account_Status,40),
    recordedTier:druaText(source.member.Tier,40),
    reviewedRank:source.member.Rank_Reviewed===true?
      druaText(source.member.Rank,80):null,
    outstandingCZK:debt,
    debtBlocking:debt>0,
    payments:payments,
    packages:plans,
    bookings:bookings,
    verifiedSkillCheckpoints:Object.keys(skillMap).sort().map(function(k){return skillMap[k];}),
    skillAwardsGrantedAutomatically:false,
    paymentProofIsNotSettlement:true
  };
  return {ok:true,viewVersion:DRUA_VIEW_VERSION,account:profile};
}
