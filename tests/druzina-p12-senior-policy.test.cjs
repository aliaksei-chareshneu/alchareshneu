'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const policy=fs.readFileSync(path.join(__dirname,'../DruzinaBillingPolicy.gs'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../DruzinaSeniorEvidence.gs'),'utf8');
const date=(n)=>'2026-10-'+String(n).padStart(2,'0')+'T18:00:00+02:00';
function ctx(n=4){
 const sessions=[],payments=[],bookings=[];
 for(let i=0;i<n;i++){
  const id='OCT-'+i;
  sessions.push({Session_ID:id,Start_DateTime:date(3+i*7),End_DateTime:date(3+i*7)});
  payments.push({Payment_ID:'PAY-'+i,Member_ID:'M1',Verification_Status:'VERIFIED',Received_Amount_CZK:240});
  bookings.push({Booking_ID:'BOOK-'+i,Session_ID:id,Member_ID:'M1',Payment_ID:'PAY-'+i,Status:'ATTENDED',Attendance_Checked:true,Attendance_Status:'PRESENT'});
 }
 const rows={Sessions:sessions,Payments:payments,Bookings:bookings};
 const b=vm.createContext({Date,Math,Intl,JSON,
   SHEETS:{SESSIONS:'Sessions',PAYMENTS:'Payments',BOOKINGS:'Bookings'},
   rows_:name=>rows[name]||[],money_:value=>Number(value)||0});
 vm.runInContext(policy,b,{filename:'DruzinaBillingPolicy.gs'});
 vm.runInContext(source,b,{filename:'DruzinaSeniorEvidence.gs'});
 return {b,rows};
}
test('October confirmed four distinct paid training visits unlock November, not October',()=>{
 const {b}=ctx();
 const nov=b.druseSeniorPreviousMonth_('M1','2026-11-01T17:00:00Z');
 const oct=b.druseSeniorPreviousMonth_('M1','2026-10-31T17:00:00Z');
 assert.equal(nov.ok,true);
 assert.equal(nov.previousMonth,'2026-10');
 assert.equal(nov.verifiedVisitsPreviousMonth,4);
 assert.equal(nov.seniorEligible,true);
 assert.equal(oct.seniorEligible,false);
});
test('missing fourth, duplicate date, unsigned attendance, unpaid receipt disqualify',()=>{
 const {b,rows}=ctx();
 rows.Bookings[3].Attendance_Checked=false;
 assert.equal(b.druseSeniorPreviousMonth_('M1','2026-11-01T17:00:00Z').verifiedVisitsPreviousMonth,3);
 rows.Bookings[3].Attendance_Checked=true;
 rows.Payments[3].Verification_Status='PROOF_SUBMITTED';
 assert.equal(b.druseSeniorPreviousMonth_('M1','2026-11-01T17:00:00Z').verifiedVisitsPreviousMonth,3);
 rows.Payments[3].Verification_Status='VERIFIED';
 rows.Payments[3].Reconciliation_Note='Refund after settlement';
 assert.equal(b.druseSeniorPreviousMonth_('M1','2026-11-01T17:00:00Z').verifiedVisitsPreviousMonth,3);
 rows.Payments[3].Reconciliation_Note='';
 rows.Bookings.push({...rows.Bookings[0],Booking_ID:'DUPLICATE'});
 assert.equal(b.druseSeniorPreviousMonth_('M1','2026-11-01T17:00:00Z').verifiedVisitsPreviousMonth,4);
});
test('no same-month upgrade and future-month counting is calendar based',()=>{
 const {b,rows}=ctx();
 for(let i=0;i<4;i++){
  const s='2026-11-'+String(i*6+3).padStart(2,'0')+'T18:00:00+01:00';
  rows.Sessions[i].Start_DateTime=s;rows.Sessions[i].End_DateTime=s;
 }
 assert.equal(b.druseSeniorPreviousMonth_('M1','2026-11-29T18:00:00+01:00').seniorEligible,false);
 assert.equal(b.druseSeniorPreviousMonth_('M1','2026-12-01T18:00:00+01:00').seniorEligible,true);
});
test('new helper cannot auto promote, write Sheets or send messages',()=>{
 assert.doesNotMatch(source,/\b(?:appendObj_|patchRow_|setProperty|sendEmail|createEvent)\s*\(/);
 assert.doesNotMatch(source,/function\s+do(?:Post|Get)\s*\(/);
 assert.match(source,/drubSeniorEligibility\(/);
});
