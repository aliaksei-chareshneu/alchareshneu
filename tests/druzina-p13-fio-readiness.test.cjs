'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const props={
 DRU_FIO_READONLY_TOKEN:'Q'.repeat(64),
 DRU_FIO_ACCOUNT_ID:'192000145399',
 DRU_FIO_BANK_ID:'0800',
 DRU_FIO_IBAN:'CZ6508000000192000145399',
 DRU_FIO_AUTOMATION_ENABLED:'YES',
 DRU_FIO_READONLY_CONFIRMED:'YES',
 DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:'YES',
 DRU_PAID_BOOKING_APPROVED:'YES',
 DRU_LEGAL_SELLER_CONFIRMED:'YES',
 DRU_OSVC_ACTIVITY_INSURANCE_VERIFIED:'YES',
 DRU_TRADE_AUTHORIZATION_VERIFIED:'YES',
 DRU_BOOKING_OTP_LIVE_VERIFIED:'YES',
 DRU_BANK_RECONCILIATION_E2E_VERIFIED:'YES',
 DRU_BOOKING_RELEASE_E2E_VERIFIED:'YES'
};
function load(override={}){
 const values={...props,...override};
 const p={getProperty:k=>values[k]||''};
 const ctx=vm.createContext({Date,Math,JSON,console,
  PropertiesService:{getScriptProperties:()=>p},
  configMap_:()=>({SAFETY_FORM_VERSION:'SAFETY-2026',RULES_VERSION:'2026-11-01',
    NOV_POLICY_VERSION:'DRU-2026-11-v2-PENDING-RELEASE',
    REQUIRE_BOOKING_VERIFICATION:true}),
  requireOwner_:()=>{},
  UrlFetchApp:{fetch:()=>{throw Error('UNAUTHORIZED_NETWORK_ACCESS')}},
  MailApp:{sendEmail:()=>{throw Error('UNAUTHORIZED_SEND')}}
 });
 for(const f of ['DruzinaFioReadiness.gs','DruzinaSafetyRelease.gs'])
  vm.runInContext(source(f),ctx,{filename:f});
 return {ctx,p};
}
test('canonical Fio account/IBAN/type keys verify offline, legacy key aliases rejected',()=>{
 const {ctx,p}=load();
 assert.equal(ctx.drusCzIbanValid_('CZ6508000000192000145399'),true);
 assert.equal(ctx.drusCzIbanValid_('CZ6508000000192000145398'),false);
 assert.equal(ctx.drusBankConfigReady_(p),true);
 for(const [key,value] of [
  ['DRU_FIO_READONLY_TOKEN',''],
  ['DRU_FIO_ACCOUNT_ID',''],
  ['DRU_FIO_ACCOUNT_ID','1234567890'],
  ['DRU_FIO_ACCOUNT_ID','2000145399'], // dropping the Czech account prefix is unsafe
  ['DRU_FIO_BANK_ID','2010'],
  ['DRU_FIO_IBAN','CZ6508000000192000145398'],
  ['DRU_FIO_AUTOMATION_ENABLED','NO'],
  ['DRU_FIO_READONLY_CONFIRMED','NO'],
  ['DRU_FIO_SETTLEMENT_SELLER_CONFIRMED','NO']
 ]){
  const u=load({[key]:value});assert.equal(u.ctx.drusBankConfigReady_(u.p),false,key);
 }
 const legacyOnly=load({DRU_FIO_READONLY_TOKEN:'',FIO_OSVC_READ_TOKEN:'Q'.repeat(64)});
 assert.equal(legacyOnly.ctx.drusBankConfigReady_(legacyOnly.p),false);
});
test('even perfect hypothetical flags can never enable a missing payment backend',()=>{
 const {ctx,p}=load();
 assert.equal(ctx.drusBankConfigReady_(p),true);
 assert.equal(vm.runInContext('DRUS_PAID_BANK_ADAPTER_LIVE',ctx),false);
 assert.equal(ctx.drusPaidRelease_().ok,false);
 assert.equal(ctx.drusPaidRelease_().code,'BOOKING_PAUSED');
 assert.throws(()=>ctx.drusRequirePaid_(),/Paid bookings are paused/);
});
test('owner readiness shows non-sensitive readiness only, with zero bank requests',()=>{
 const {ctx}=load();
 const result=ctx.drusFioOwnerReadiness();
 assert.equal(result.mode,'OWNER_ONLY_READ_ONLY_NO_BANK_REQUESTS');
 assert.equal(result.paidCheckoutLive,false);
 assert.equal(result.bankAdapterLive,false);
 assert.equal(result.credentialsAndMerchantGatesComplete,true);
 assert.equal(JSON.stringify(result).includes(props.DRU_FIO_READONLY_TOKEN),false);
 assert.equal(JSON.stringify(result).includes(props.DRU_FIO_ACCOUNT_ID),false);
});
test('p13 owner readiness cannot be invoked by non-owner',()=>{
 const {ctx}=load();
 ctx.requireOwner_=()=>{throw Error('OWNER_ONLY')};
 assert.throws(()=>ctx.drusFioOwnerReadiness(),/OWNER_ONLY/);
});
