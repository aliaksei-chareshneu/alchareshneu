'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../DruzinaSafetyRelease.gs'),'utf8');
function context(extra={}){
 const sandbox=vm.createContext({Date,Math,JSON, ...extra});
 vm.runInContext(source,sandbox,{filename:'DruzinaSafetyRelease.gs'});
 return sandbox;
}
const session={Session_ID:'SES-20261116',Status:'OPEN',Notes:'date-specific checked',Capacity:20};
const gate=(changes={})=>({
 Session_ID:session.Session_ID,Slot_State:'CONFIRMED',Publish_Confirmed_Only:'YES',
 Newcomer_Ready:'YES',Instructor_Verified:'VERIFIED',
 Venue_Permission_Verified:'VERIFIED',Activity_Insurance_Verified:'VERIFIED',
 Participant_Safety_Form_Valid:'VERIFIED',Equipment_Check:'VERIFIED',
 Guardian_Gate_If_Minors:'NOT_APPLICABLE',
 Evidence_Source:'signed date-specific venue and organizer evidence',
 Reviewer_and_proof_of_100_TOTAL_not_ready:'dated owner review',
 Max_Attendance_Checked:'60',Staff_And_Marshals_Count:'3',
 Other_Humans_Count_Parents_Spectators:'2',
 BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:'55',...changes
});
test('incomplete or cancelled date has zero paid capacity',()=>{
 const e=context();
 assert.equal(e.drusCapacityFromRow_(session,null),0);
 for(const key of ['Slot_State','Publish_Confirmed_Only','Newcomer_Ready',
  'Instructor_Verified','Venue_Permission_Verified','Activity_Insurance_Verified',
  'Participant_Safety_Form_Valid','Equipment_Check','Guardian_Gate_If_Minors',
  'Evidence_Source','Reviewer_and_proof_of_100_TOTAL_not_ready',
  'Max_Attendance_Checked','Staff_And_Marshals_Count',
  'BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA']){
   assert.equal(e.drusCapacityFromRow_(session,gate({[key]:''})),0,key);
 }
 assert.equal(e.drusCapacityFromRow_({...session,Status:'CLOSED'},gate()),0);
 assert.equal(e.drusCapacityFromRow_({...session,Notes:'CANCELLED by organizer'},gate()),0);
});
test('total participant/staff/crowd limit counts all heads up to 100',()=>{
 const e=context();
 assert.equal(e.drusCapacityFromRow_(session,gate()),20);
 assert.equal(e.drusCapacityFromRow_({...session,Capacity:100},gate()),55);
 assert.equal(e.drusCapacityFromRow_({...session,Capacity:100},gate({
  Max_Attendance_Checked:'100',Staff_And_Marshals_Count:'8',
  Other_Humans_Count_Parents_Spectators:'7',BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:'85'
 })),85);
 assert.equal(e.drusCapacityFromRow_({...session,Capacity:100},gate({Max_Attendance_Checked:'101'})),0);
 assert.equal(e.drusCapacityFromRow_({...session,Capacity:100},gate({Staff_And_Marshals_Count:'0'})),0);
});
test('release blocks payments until verified account, insurance, legal and signed form',()=>{
 const cfg={RULES_VERSION:'2026-11-01',SAFETY_FORM_VERSION:'',NOV_POLICY_VERSION:'DRU-2026-11-v2-PENDING-RELEASE',REQUIRE_BOOKING_VERIFICATION:true};
 const props={};
 const e=context({configMap_:()=>cfg,PropertiesService:{getScriptProperties:()=>({
  getProperty:k=>props[k]||''
 })}});
 assert.equal(e.drusPaidRelease_().code,'BOOKING_PAUSED');
 assert.throws(()=>e.drusRequirePaid_(),/Paid bookings are paused/);
 for(const name of ['DRU_PAID_BOOKING_APPROVED','DRU_LEGAL_SELLER_CONFIRMED',
 'DRU_FIO_SETTLEMENT_SELLER_CONFIRMED','DRU_FIO_READONLY_CONFIRMED',
 'DRU_OSVC_ACTIVITY_INSURANCE_VERIFIED','DRU_TRADE_AUTHORIZATION_VERIFIED',
 'DRU_BOOKING_OTP_LIVE_VERIFIED','DRU_BANK_RECONCILIATION_E2E_VERIFIED',
 'DRU_BOOKING_RELEASE_E2E_VERIFIED'])props[name]='YES';
 props.FIO_OSVC_READ_TOKEN='Z'.repeat(64);
 props.FIO_OSVC_EXPECTED_ACCOUNT_ID='1234567890';
 props.FIO_OSVC_ENTITY_CONFIRMED='true';
 assert.equal(e.drusPaidRelease_().ok,false,'missing independent form');
 cfg.SAFETY_FORM_VERSION='SAFETY_VERIFIED';
 assert.equal(e.drusPaidRelease_().ok,true,'only simulated fully cleared private configuration');
 cfg.NOV_POLICY_VERSION='DRU-2026-11-v1';
 assert.equal(e.drusPaidRelease_().ok,false,'old policy remains blocked');
 delete props.DRU_TRADE_AUTHORIZATION_VERIFIED;
 cfg.NOV_POLICY_VERSION='DRU-2026-11-v2-PENDING-RELEASE';
 assert.equal(e.drusPaidRelease_().ok,false,'missing trade evidence');
});
test('payment proof never counts as settled and empty or inactive catalogue never sells',()=>{
 const e=context({productMap_:()=>({
  'DRU-FIRSTVISIT-202611':{Active:'FALSE'},
  'DRU-STARTER4-202611':{Active:'FALSE'}
 })});
 assert.throws(()=>e.drusNeverProofAsPayment_(),/not bank settlement/);
 assert.equal(e.drusApprovedProductActive_(),false);
});
test('fail-closed helper has no paid side-effect endpoints or embedded tokens',()=>{
 assert.doesNotMatch(source,/\b(?:MailApp|UrlFetchApp|DriveApp|CalendarApp)\./);
 assert.doesNotMatch(source,/\b(?:appendObj_|patchRow_|setProperty|createBooking_)\s*\(/);
 assert.doesNotMatch(source,/function\s+do(?:Post|Get)\s*\(/);
});
