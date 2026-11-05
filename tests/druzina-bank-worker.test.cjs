'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {stage}=require('./helpers/druzina-staging-fixture.cjs');
const {prepareBank}=require('../ops/prepare-druzina-bank-import.cjs');
const output=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'druzina-import-')),'source');
prepareBank(path.join(__dirname,'fixtures/community-fio'),output);
function iban(account,bank='2010'){
 const bban=bank+account.padStart(16,'0'),digits=bban+'123500';let mod=0;
 for(const digit of digits)mod=(mod*10+Number(digit))%97;
 return 'CZ'+String(98-mod).padStart(2,'0')+bban;
}
function setup(){
 const e=stage(),{h,auth,session}=e;
 Object.assign(h.properties,{DRU_FIO_READONLY_TOKEN:'',DRU_FIO_ACCOUNT_ID:'123456789',DRU_FIO_BANK_ID:'2010',
  DRU_FIO_IBAN:iban('123456789'),DRU_BOOKING_IMPORT_SIGNING_KEY:'a'.repeat(64),
  DRU_BOOKING_BANK_PROFILE:'OSVC',DRU_BOOKING_SELLER_ID:'SYNTHETIC-OSVC',
  DRU_BOOKING_SIGNED_IMPORT_CONFIRMED:'YES',DRU_BOOKING_ATTESTATION_ENABLED:'YES',
  DRU_BOOKING_OSVC_SELLER_ID:'SYNTHETIC-OSVC',DRU_BOOKING_DRUZINA_SELLER_ID:'SYNTHETIC-NGO',
  FIO_OSVC_EXPECTED_ACCOUNT_ID:'123456789',FIO_DRUZINA_EXPECTED_ACCOUNT_ID:'987654321'});
 vm.runInContext(fs.readFileSync(path.join(output,'FioOSVC.js'),'utf8'),h.context);
 vm.runInContext(fs.readFileSync(path.join(output,'FioBank.js'),'utf8'),h.context);
 const headers=vm.runInContext('FIO_OSVC_HEADERS',h.context);
 const Sheet=h.sheets.get('Products').constructor;
 h.sheets.set('OSVC_Fio_Transactions',new Sheet('OSVC_Fio_Transactions',headers));
 const s=session(72),q=h.call('createDruzinaBankQuote',{bookingToken:auth.bookingToken,
  termsAccepted:true,termsVersion:'SYNTHETIC-TERMS-V1',
  language:'ru',requestId:'SYNTHETIC-IMPORT-ORDER',items:[{productCode:'DRU-FIRSTVISIT-202611',sessionId:s.Session_ID}]});
 function append(changes={},profile='OSVC'){
  const raw={column22:{value:'1000000009'},column0:{value:'2026-11-02'},column1:{value:'240.00'},
   column14:{value:'CZK'},column5:{value:q.paymentReference},column8:{value:'Příjem převodem'},...changes};
  // Executes the recovered EXISTING Fio parser; only the bank response is synthetic.
  const tx=h.call('fioOsNormalizeStatement_',{accountStatement:{info:{bankId:'2010',accountId:'123456789',currency:'CZK'},
   transactionList:{transaction:[raw]}}},'123456789').transactions[0];
  const values=h.call(profile==='OSVC'?'fioOsBankRow_':'fioBankRow_',tx,{paymentId:'',status:'UNMATCHED'},h.now().toISOString());
  const row={};headers.forEach((key,i)=>row[key]=values[i]);h.context.appendObj_('OSVC_Fio_Transactions',row);
 }
 return {...e,s,q,append};
}
test('existing signed Fio import → worker → actual order/booking → existing notification queue',()=>{
 const {h,q,append}=setup();append();
 const result=h.call('drufReconcileImportedBank');
 assert.equal(result.settled,1,JSON.stringify(result));assert.equal(result.bankApiRequests,0);
 assert.equal(h.rows('Payments').length,1);assert.equal(h.rows('Bookings').length,1);
 assert.equal(h.rows('Quotes')[0].Status,'COMMITTED');
 const second=h.call('drufReconcileImportedBank');assert.equal(second.settled,0);assert.equal(second.replayed,1);
 h.properties.DRU_NOTIFICATION_QUEUE_ENABLED='YES';
 assert.equal(h.call('drunQueueBookingNotifications').queued,2);
 const operator=h.call('getDruzinaBookingOperations',h.properties.ADMIN_TOKEN);
 assert.equal(operator.bankReadback.replayed,1);assert.equal(operator.counts.bankVerifiedPayments,1);
 assert.equal(h.properties.DRU_FIO_READONLY_TOKEN,'');assert.equal(h.context.UrlFetchApp,undefined);
 assert.equal(h.emails.length,1); // Only the synthetic OTP from the fixture.
 assert.doesNotMatch(JSON.stringify(result),/123456789|aaaaaaa|SYNTHETIC-OSVC/);
});
test('unsigned, altered, wrong-entity and wrong-seller import rows never settle',()=>{
 for(const kind of ['unsigned','amount','vs','entity','seller','signature']){
  const {h,append}=setup();append({},kind==='entity'?'DRUZINA':'OSVC');
  const sheet=h.context.rows_('OSVC_Fio_Transactions')[0];
  if(kind==='unsigned')h.context.patchRow_('OSVC_Fio_Transactions',sheet._row,{Review_Notes:''});
  if(kind==='amount')h.context.patchRow_('OSVC_Fio_Transactions',sheet._row,{Amount_CZK:241});
  if(kind==='vs')h.context.patchRow_('OSVC_Fio_Transactions',sheet._row,{VS:'1111111111'});
  if(kind==='seller')h.properties.DRU_BOOKING_SELLER_ID='DIFFERENT-SELLER';
  if(kind==='signature')h.properties.DRU_BOOKING_IMPORT_SIGNING_KEY='b'.repeat(64);
  const r=h.call('drufReconcileImportedBank');assert.equal(r.settled,0,kind);
  assert.equal(h.rows('Payments').length,0,kind);assert.equal(h.rows('Bookings').length,0,kind);
 }
});
test('partial, excess, duplicate incoming credits and refunds go to manual review',()=>{
 for(const kind of ['partial','over','double','refund']){
  const {h,append}=setup();append(kind==='partial'?{column1:{value:120}}:
   kind==='over'?{column1:{value:241}}:kind==='refund'?{column1:{value:-240}}:{});
  if(kind==='double')append({column22:{value:'1000000010'}});
  const r=h.call('drufReconcileImportedBank');assert.equal(r.settled,0,kind);assert.ok(r.manualReview>0,kind);
  assert.equal(h.rows('Payments').length,0);
 }
});
test('bank import receipt and automatic reconciliation remain separately gated',()=>{
 const {h,append}=setup();h.properties.DRU_BOOKING_ATTESTATION_ENABLED='NO';append();
 assert.equal(h.call('drufReconcileImportedBank').settled,0);assert.equal(h.rows('Payments').length,0);
 h.properties.DRU_FIO_AUTOMATION_ENABLED='NO';assert.equal(h.call('drufReconcileImportedBank').disabled,true);
});
test('old signed statement requires fresh owner readback instead of automatic settlement',()=>{
 const {h,append}=setup();append();h.advance(37*3600000);
 const r=h.call('drufReconcileImportedBank');assert.equal(r.settled,0);assert.equal(h.rows('Payments').length,0);
});
test('native booking polling installation is gated and cannot create duplicate jobs',()=>{
 const {h}=setup();assert.equal(h.call('drufInstallBankPolling').created,0);
 h.properties.DRU_BANK_POLLING_APPROVED='YES';
 assert.equal(h.call('drufInstallBankPolling').created,1);
 assert.equal(h.call('drufInstallBankPolling').created,0);
 assert.equal(h.triggers.filter(t=>t.getHandlerFunction()==='druzinaBankPolling_').length,1);
});
test('actual existing Fio GET importer signs its readback; separate portal worker consumes it',()=>{
 const {h,q}=setup(),properties={
  FIO_OSVC_READ_TOKEN:'Q'.repeat(64),FIO_OSVC_EXPECTED_ACCOUNT_ID:'123456789',FIO_OSVC_ENTITY_CONFIRMED:'true',
  FIO_DRUZINA_READ_TOKEN:'Z'.repeat(64),FIO_DRUZINA_EXPECTED_ACCOUNT_ID:'987654321',
  DRU_BOOKING_IMPORT_SIGNING_KEY:'a'.repeat(64),DRU_BOOKING_OSVC_SELLER_ID:'SYNTHETIC-OSVC',
  DRU_BOOKING_ATTESTATION_ENABLED:'YES',DRU_BOOKING_BANK_PROFILE:'OSVC',DRU_BANK_IMPORT_POLLING_APPROVED:'YES'};
 const store={getProperty:k=>properties[k]||'',setProperty:(k,v)=>properties[k]=v,
  setProperties:values=>Object.assign(properties,values)};
 const ownerFile={getOwner:()=>({getEmail:()=> 'owner@example.test'}),getSharingAccess:()=> 'PRIVATE',getEditors:()=>[],getViewers:()=>[]};
 const FULL={type:'NATIVE_FULL_AUTH'};let requests=0;
 const hub=vm.createContext({Date:h.context.Date,Number,JSON,Math,console,Utilities:h.context.Utilities,
  SPREADSHEET_ID:'SYNTHETIC_SHARED_HUB',ocId_:()=> 'SYNTHETIC_SHARED_HUB',
  Session:{getActiveUser:()=>({getEmail:()=>''}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})},
  ocOwner_:()=>{throw Error('Owner sign-in required')},PropertiesService:{getScriptProperties:()=>store},
  SpreadsheetApp:h.context.SpreadsheetApp,LockService:h.context.LockService,
  DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:()=>ownerFile},
  ScriptApp:{AuthMode:{FULL},getProjectTriggers:()=>[{getHandlerFunction:()=> 'fioBookingImportTick_',getUniqueId:()=> 'SYNTHETIC_NATIVE_TRIGGER'}]},
  UrlFetchApp:{fetch:(url,options)=>{
   requests++;assert.equal(options.method,'get');assert.match(url,/^https:\/\/fioapi\.fio\.cz\/v1\/rest\/periods\//);
   const raw={accountStatement:{info:{bankId:'2010',accountId:'123456789',currency:'CZK'},transactionList:{transaction:[{
    column22:{value:'1000000009'},column0:{value:'2026-11-02'},column1:{value:240},column14:{value:'CZK'},column5:{value:q.paymentReference}
   }]}}};
   return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(raw)};
  }}});
 for(const name of ['DruzinaBankReceipt.js','DruzinaBankImportSchedule.js','FioOSVC.js','FioBank.js'])
  vm.runInContext(fs.readFileSync(path.join(output,name),'utf8'),hub,{filename:name});
 assert.throws(()=>hub.fioBookingImportTick_({triggerUid:'forged',authMode:FULL}),/native trigger/);
 assert.throws(()=>hub.fioSyncOSVCReadOnly(),/Owner sign-in/);assert.equal(requests,0);
 const imported=hub.fioBookingImportTick_({triggerUid:'SYNTHETIC_NATIVE_TRIGGER',authMode:FULL});
 assert.equal(imported.imported,1);assert.equal(requests,1);
 assert.equal(h.properties.FIO_OSVC_READ_TOKEN,undefined);assert.equal(h.properties.DRU_FIO_READONLY_TOKEN,'');
 assert.equal(h.call('drufReconcileImportedBank').settled,1);
 assert.equal(h.call('drufReconcileImportedBank').settled,0);
 assert.equal(h.rows('Payments').length,1);assert.equal(h.rows('Bookings').length,1);
 assert.equal(requests,1);assert.equal(vm.runInContext('DRU_BANK_TRIGGER_CONTEXT_',hub),false);
});
