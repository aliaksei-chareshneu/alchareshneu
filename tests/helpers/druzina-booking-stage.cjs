'use strict';
const {harness}=require('./druzina-apps-script-harness.cjs');
function stage(){
 const h=harness({enforceEmailAuth:true,futureReleaseSimulation:true,activeEmail:'owner@example.test'});
 Object.assign(h.properties,{
  DRU_FIO_READONLY_TOKEN:'Q'.repeat(64),DRU_FIO_ACCOUNT_ID:'192000145399',DRU_FIO_BANK_ID:'0800',
  DRU_FIO_IBAN:'CZ6508000000192000145399',DRU_FIO_AUTOMATION_ENABLED:'YES',
  DRU_FIO_READONLY_CONFIRMED:'YES',DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'YES',
  DRU_PAID_BOOKING_APPROVED:'YES',DRU_LEGAL_SELLER_CONFIRMED:'YES',
  DRU_OSVC_ACTIVITY_INSURANCE_VERIFIED:'YES',DRU_TRADE_AUTHORIZATION_VERIFIED:'YES',
  DRU_BOOKING_OTP_LIVE_VERIFIED:'YES',DRU_BANK_RECONCILIATION_E2E_VERIFIED:'YES',
  DRU_BOOKING_RELEASE_E2E_VERIFIED:'YES'});
 h.config('SAFETY_FORM_VERSION','SYNTHETIC-SAFETY');h.config('RULES_VERSION','SYNTHETIC-RULES');
 h.add('Products',{Product_ID:'DRU-FIRSTVISIT-202611',Offer:'Synthetic First Visit',Price_CZK:240,Active:true});
 const email='synthetic-member@example.test';
 h.call('requestBookingCode',{email});
 const code=h.emails.at(-1).body.match(/code: ([A-F0-9]{10})/)[1];
 const auth=h.call('verifyBookingCode',{email,code,name:'Synthetic Member'});
 const member=h.rows('Members')[0];
 for(const kind of ['SAFETY_FORM','RULES','AGE_CLASSIFICATION'])h.call('recordDruzinaConsentReview',{
  adminToken:h.properties.ADMIN_TOKEN,memberId:member.Member_ID,kind,
  source:'https://example.test/synthetic-evidence',guardianRequired:false});
 const gateKeys=['Session_ID','Slot_State','Publish_Confirmed_Only','Newcomer_Ready','Instructor_Verified',
  'Venue_Permission_Verified','Activity_Insurance_Verified','Participant_Safety_Form_Valid','Equipment_Check',
  'Guardian_Gate_If_Minors','Evidence_Source','Reviewer_and_proof_of_100_TOTAL_not_ready',
  'Max_Attendance_Checked','Staff_And_Marshals_Count','Other_Humans_Count_Parents_Spectators',
  'BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA'];
 const sheet=new (h.sheets.get('Products').constructor)('Druzina_Training_Capacity_Gate',gateKeys);
 h.sheets.set(sheet.name,sheet);
 function session(hours=72){
  const s=h.session(hours,{Location:'Synthetic permitted site',Capacity:4});
  h.context.appendObj_(sheet.name,{Session_ID:s.Session_ID,Slot_State:'CONFIRMED',Publish_Confirmed_Only:'YES',
   Newcomer_Ready:'YES',Instructor_Verified:'VERIFIED',Venue_Permission_Verified:'VERIFIED',
   Activity_Insurance_Verified:'VERIFIED',Participant_Safety_Form_Valid:'VERIFIED',Equipment_Check:'VERIFIED',
   Guardian_Gate_If_Minors:'NOT_APPLICABLE',Evidence_Source:'synthetic signed evidence',
   Reviewer_and_proof_of_100_TOTAL_not_ready:'synthetic owner',Max_Attendance_Checked:10,
   Staff_And_Marshals_Count:2,Other_Humans_Count_Parents_Spectators:1,
   BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA:4});
  return s;
 }
 return {h,auth,member,session};
}

module.exports={stage};
