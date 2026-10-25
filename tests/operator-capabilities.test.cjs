const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../OperatorConsoleServer.gs','utf8');
function cap(extra={},values={},ss){const s={...extra};vm.createContext(s);vm.runInContext(source,s);return s.ocCapabilities_({getProperty:k=>values[k]||null},ss);}
const recovery=()=>({platformRecoveryPreview:()=>{},RP:{},rpOnLeadFormSubmit:()=>{},platformPauseRecovery:()=>{}});
test('no module means no actions',()=>{const c=cap();assert.equal(c.recoveryState,'MODULE_MISSING');assert.ok(Object.values(c.actions).every(v=>v===false));});
test('distinct recovery states',()=>{assert.equal(cap(recovery()).recoveryState,'NOT_CONFIGURED');assert.equal(cap(recovery(),{PLATFORM_RECOVERY_PAUSED:'true'}).recoveryState,'PAUSED');const c=cap(recovery(),{PLATFORM_RECOVERY_PAUSED:'false'});assert.equal(c.recoveryState,'ENABLED_NOT_VERIFIED');assert.equal(c.actions.pauseRecovery,true);});
test('bank needs both module and confirmed configuration',()=>{const m={fioSyncOSVCReadOnly:()=>{}},p={FIO_OSVC_READ_TOKEN:'a'.repeat(64),FIO_OSVC_EXPECTED_ACCOUNT_ID:'12345678',FIO_OSVC_ENTITY_CONFIRMED:'true'};assert.equal(cap(m).actions.syncOSVC,false);assert.equal(cap({},p).actions.syncOSVC,false);assert.equal(cap(m,p).actions.syncOSVC,true);assert.equal(cap(m,{...p,FIO_OSVC_ENTITY_CONFIRMED:'false'}).actions.syncOSVC,false);});
test('payment preview requires its module and both existing sheets without reading financial rows',()=>{
 const module={paymentReconciliationPreview:()=>{throw Error('Must not run preview');}};
 for(const [names,state] of [[[],'PAYMENTS_SHEET_MISSING'],[['Druzina_Payments'],'BANK_SHEET_MISSING'],[['Druzina_Payments','Druzina_Fio_Transactions'],'READY']]){
  const calls=[],ss={getSheetByName:name=>{calls.push(name);return names.includes(name)?{getDataRange:()=>{throw Error('Must not read rows');}}:null;}};
  const c=cap(module,{},ss);assert.equal(c.paymentPreviewState,state);assert.equal(c.actions.previewPayments,state==='READY');
  assert.ok(calls.every(n=>['Druzina_Payments','Druzina_Fio_Transactions'].includes(n)));
 }
 assert.equal(cap(module).paymentPreviewState,'NOT_CHECKED');assert.equal(cap(module).actions.previewPayments,false);
 const c=cap({}, {}, {getSheetByName:()=>{throw Error('No lookup without module');}});
 assert.equal(c.paymentPreviewState,'MODULE_MISSING');assert.equal(c.actions.previewPayments,false);
});
