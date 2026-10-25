'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const env=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../DruzinaMemberAccount.gs'),'utf8'),env);
const auth={serverOtpVerified:true,sessionOwnerVerified:true,memberId:'MEM-1'};
const base={
 member:{Member_ID:'MEM-1',Full_Name:'Example Member',
   Account_Status:'HOLD',Tier:'Junior',Rank:'VII'},
 ledger:[{Member_ID:'MEM-1',Status:'OPEN',Amount_CZK:60,Blocks_Booking:true},
   {Member_ID:'MEM-2',Status:'OPEN',Amount_CZK:90000,Blocks_Booking:true}],
 payments:[{Member_ID:'MEM-1',Payment_ID:'PAY-1',Product_Code:'DRU-FLEX',
   Verification_Status:'PENDING',Expected_Amount_CZK:240,
   Received_Amount_CZK:240,Proof_File_URL:'https://example.com/unverified-proof'},
  {Member_ID:'MEM-2',Payment_ID:'OTHER-USER-SECRET',
   Verification_Status:'VERIFIED',Verified_At:'2026-10-24',Expected_Amount_CZK:200,
   Received_Amount_CZK:200}],
 plans:[{Member_ID:'MEM-1',Plan_ID:'P-1',Product_Code:'STARTER4',
   Package_Sessions:4,Sessions_Used:1,Sessions_NoShow:1,Status:'ACTIVE'}],
 bookings:[{Member_ID:'MEM-1',Booking_ID:'B-1',Session_ID:'S-1',
   Status:'CONFIRMED',Attendance_Status:'UNKNOWN',Applied_Price_CZK:240},
  {Member_ID:'MEM-2',Booking_ID:'OTHER-PRIVATE',Session_ID:'S-2',Status:'CONFIRMED'}],
 sessions:[{Session_ID:'S-1',Start_DateTime:'2026-11-16 18:00'},
  {Session_ID:'S-2',Start_DateTime:'2026-11-16 18:00'}],
 checkpoints:[{Checkpoint_ID:'AR-1',Status:'ACTIVE'},{Checkpoint_ID:'B-1',Status:'DRAFT'}],
 skills:[{Member_ID:'MEM-1',Checkpoint_ID:'AR-1',Track_ID:'ARCHERY',Tier:'I',
   Assessment_Status:'PASSED',Safety_Verified:true,Skill_Verified:true,
   Instructor_Ref:'TRAINER-1',Verified_At:'2026-11-19'},
  {Member_ID:'MEM-1',Checkpoint_ID:'B-1',Track_ID:'INFANTRY',Tier:'I',
   Assessment_Status:'PASSED',Safety_Verified:true,Skill_Verified:true,
   Instructor_Ref:'TRAINER-1',Verified_At:'2026-11-19'},
  {Member_ID:'MEM-2',Checkpoint_ID:'AR-1',Track_ID:'ARCHERY',Tier:'I',
   Assessment_Status:'PASSED',Safety_Verified:true,Skill_Verified:true,
   Instructor_Ref:'TRAINER-1',Verified_At:'2026-11-19'}]
};
test('no OTP or owner-bound identity means zero private dashboard',()=>{
  assert.equal(env.druaPrivateView({...auth,serverOtpVerified:false},base).code,'AUTH_REQUIRED');
  assert.equal(env.druaPrivateView({...auth,sessionOwnerVerified:false},base).code,'AUTH_REQUIRED');
  assert.equal(env.druaPrivateView({...auth,memberId:'MEM-2'},base).code,'MEMBER_NOT_FOUND');
});
test('private view hides other users payment identifiers, bookings and debts',()=>{
  const r=env.druaPrivateView(auth,base);
  assert.equal(r.ok,true);
  assert.equal(r.account.outstandingCZK,60);
  assert.equal(r.account.debtBlocking,true);
  assert.equal(r.account.payments.length,1);
  assert.equal(r.account.bookings.length,1);
  assert.ok(!JSON.stringify(r).includes('OTHER-USER-SECRET'));
  assert.ok(!JSON.stringify(r).includes('OTHER-PRIVATE'));
  assert.ok(!JSON.stringify(r).includes('90000'));
  assert.ok(!JSON.stringify(r).includes('unverified-proof'));
});
test('unverified proof is never paid; full verified receipt is required',()=>{
  const r=env.druaPrivateView(auth,base);
  assert.equal(r.account.payments[0].status,'PENDING_VERIFICATION');
  assert.equal(r.account.payments[0].confirmedReceivedCZK,0);
  const fullyVerified={...base,payments:[{...base.payments[0],
    Verification_Status:'VERIFIED',Verified_At:'2026-11-18T10:00:00Z'}]};
  const paid=env.druaPrivateView(auth,fullyVerified).account.payments[0];
  assert.equal(paid.status,'PAID_VERIFIED');
  assert.equal(paid.confirmedReceivedCZK,240);
  const partial={...base,payments:[{...base.payments[0],
    Verification_Status:'VERIFIED',Verified_At:'2026-11-18T10:00:00Z',
    Received_Amount_CZK:180}]};
  assert.equal(env.druaPrivateView(auth,partial).account.payments[0].status,'PENDING_VERIFICATION');
});
test('package shows consumed no-shows without inventing extra credits',()=>{
  const p=env.druaPrivateView(auth,base).account.packages[0];
  assert.equal(p.scheduled,4);
  assert.equal(p.remaining,2);
});
test('progress is instructor verified and approved checkpoint only',()=>{
  const a=env.druaPrivateView(auth,base).account;
  assert.equal(a.verifiedSkillCheckpoints.length,1);
  assert.equal(a.verifiedSkillCheckpoints[0].checkpointId,'AR-1');
  assert.equal(a.reviewedRank,null); // no reviewer approval; never infer rank from a package
  assert.equal(a.skillAwardsGrantedAutomatically,false);
});
test('unverified dates are never guessed, and missing arrays fail quietly',()=>{
  const a=env.druaPrivateView(auth,{member:base.member,
     bookings:[{Member_ID:'MEM-1',Booking_ID:'B-2',Session_ID:'UNKNOWN'}]}).account;
  assert.equal(a.bookings[0].starts,'UNCONFIRMED');
  assert.equal(a.payments.length,0);
});
