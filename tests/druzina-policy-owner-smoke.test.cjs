'use strict';
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const pure=fs.readFileSync(path.join(base,'DruzinaBillingPolicy.gs'),'utf8');
const smoke=fs.readFileSync(path.join(base,'DruzinaPolicyHealth.gs'),'utf8');
function context(owner){
  const logged=[];
  const ctx=vm.createContext({
    requireOwner_:()=>{if(!owner)throw Error('Owner authorization required');},
    console:{log:(x)=>logged.push(String(x))}
  });
  vm.runInContext(pure,ctx,{filename:'DruzinaBillingPolicy.gs'});
  vm.runInContext(smoke,ctx,{filename:'DruzinaPolicyHealth.gs'});
  return {ctx,logged};
}
test('owner safe function passes exact synthetic amounts and disabled paid flag',()=>{
  const {ctx,logged}=context(true);
  const out=ctx.drubPolicyOwnerSmoke();
  assert.equal(out.pass,true);
  assert.equal(out.mode,'OWNER_PRIVATE_SYNTHETIC_NO_WRITES');
  assert.equal(out.firstVisitCZK,240);
  assert.equal(out.starter4CZK,800);
  assert.equal(out.lateJuniorCZK,300);
  assert.equal(out.emergencyJuniorCZK,360);
  assert.equal(out.paidCheckout,'PAID_BOOKING_DISABLED');
  assert.ok(logged[0].includes('P10_OWNER_POLICY_SMOKE_OK'));
});
test('non-owner is rejected before quote or logging',()=>{
  const {ctx,logged}=context(false);
  assert.throws(()=>ctx.drubPolicyOwnerSmoke(),/Owner authorization required/);
  assert.equal(logged.length,0);
});
test('source has no provider or data IO, triggers, send or checkout',()=>{
  assert.doesNotMatch(smoke,/\b(?:SpreadsheetApp|UrlFetchApp|MailApp|GmailApp|ScriptApp|LockService|PropertiesService)\b/);
  assert.doesNotMatch(smoke,/function\s+do(?:Get|Post)\s*\(/);
  assert.doesNotMatch(smoke,/\b(?:createCheckout|charge|sendEmail|createBooking|appendRow|setValue)\s*\(/);
});
