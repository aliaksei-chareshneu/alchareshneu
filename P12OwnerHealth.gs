/** Owner-only synthetic policy readback; no members, sheets or payments changed. */
function druseP12OwnerHealth(){
  requireOwner_();
  if(drusPaidRelease_().ok)throw new Error('PAID_BOOKING_MUST_REMAIN_PAUSED');
  const dates=['2026-10-03T18:00:00+02:00','2026-10-10T18:00:00+02:00',
    '2026-10-17T18:00:00+02:00','2026-10-24T18:00:00+02:00'];
  const evidence=dates.map(function(d,i){
    return {sessionId:'SYNTHETIC-OCT-'+i,status:'ATTENDED',
      verified:true,instructorVerified:true,attendedAt:d};
  });
  const nov=drubSeniorEligibility('2026-11-01T18:00:00+01:00',evidence);
  const oct=drubSeniorEligibility('2026-10-31T18:00:00+01:00',evidence);
  if(!nov.ok||!nov.seniorEligible||nov.verifiedVisitsPreviousMonth!==4||
      oct.seniorEligible)throw new Error('SENIOR_CALENDAR_MONTH_POLICY_FAIL');
  const result={pass:true,mode:'OWNER_SYNTHETIC_NO_WRITES',
    portalVersion:APP.VERSION,seniorEarnedIn:'2026-10',
    seniorActivatesIn:'2026-11',octoberSameMonthNoUnlock:true,
    paidBookingEnabled:false,noMemberWrites:true};
  console.log('P12_OWNER_SENIOR_HEALTH_PASS '+JSON.stringify(result));
  return result;
}
