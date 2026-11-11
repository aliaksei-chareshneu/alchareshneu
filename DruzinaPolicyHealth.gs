/**
 * Private owner-only synthetic Druzina policy smoke.
 * No bank access, spreadsheet mutation, mail, triggers, hosted checkout, or bookings.
 * This does not release the public booking portal, which stays on versioned @7.
 */
function drubPolicyOwnerSmoke() {
  'use strict';
  if (typeof requireOwner_ !== 'function') throw new Error('OWNER_GUARD_MISSING');
  requireOwner_();
  if (typeof drubQuoteItem !== 'function' || typeof drubAuthorizeCheckout !== 'function') {
    throw new Error('PURE_POLICY_SOURCE_MISSING');
  }
  var start='2026-11-16T18:00:00+01:00';
  var before='2026-11-13T17:00:00+01:00';
  var first=drubQuoteItem({nowISO:before,sessionStartsAt:start,type:'FIRST_VISIT',
    tier:'JUNIOR',firstVisitEligible:true});
  var starter=drubQuoteItem({nowISO:before,sessionStartsAt:start,type:'STARTER4',
    tier:'JUNIOR',selectedSessions:[start,'2026-11-19T18:00:00+01:00',
    '2026-11-23T18:00:00+01:00','2026-11-26T18:00:00+01:00']});
  var late=drubQuoteItem({nowISO:'2026-11-15T18:00:00+01:00',
    sessionStartsAt:start,type:'FLEX',tier:'JUNIOR',existingMemberVerified:true});
  var emergency=drubQuoteItem({nowISO:'2026-11-16T16:00:00+01:00',
    sessionStartsAt:start,type:'FLEX',tier:'JUNIOR',existingMemberVerified:true});
  var denied=drubAuthorizeCheckout({paymentLaunchApproved:false});
  if (!first.ok || first.amountCZK!==240 || !starter.ok || starter.amountCZK!==800 ||
      !late.ok || late.amountCZK!==300 || !emergency.ok || emergency.amountCZK!==360 ||
      denied.ok || denied.code!=='PAID_BOOKING_DISABLED') {
    throw new Error('SYNTHETIC_POLICY_MISMATCH');
  }
  var result={pass:true,mode:'OWNER_PRIVATE_SYNTHETIC_NO_WRITES',
    firstVisitCZK:first.amountCZK,starter4CZK:starter.amountCZK,
    lateJuniorCZK:late.amountCZK,emergencyJuniorCZK:emergency.amountCZK,
    paidCheckout:denied.code,policyVersion:first.policyVersion};
  console.log('P10_OWNER_POLICY_SMOKE_OK ' + JSON.stringify(result));
  return result;
}
