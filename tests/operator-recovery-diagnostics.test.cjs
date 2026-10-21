const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const server=fs.readFileSync(__dirname+'/../OperatorConsoleServer.gs','utf8');
const client=fs.readFileSync(__dirname+'/../OperatorConsole.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split("\ndocument.querySelectorAll('[data-tab]')")[0];
const recovery=fs.readFileSync(__dirname+'/../PlatformRecovery.gs','utf8');
const NOW=Date.parse('2026-10-21T08:00:00Z');
const plain=value=>JSON.parse(JSON.stringify(value));
function load(extra={}){const s={Date,RP:{SPREADSHEET_ID:'TEST-ONLY-HUB'},...extra};vm.createContext(s);vm.runInContext(server,s);vm.runInContext(client,s);return s;}
const properties=values=>({getProperty:key=>values[key]??null});
const defaults={RP_LEAD_FORM_ID:'TEST-ONLY-FORM',PLATFORM_RECOVERY_SINCE:'2026-10-01T08:00:00Z'};
const report=(extra={})=>({mode:'READ_ONLY',responseCount:60,missingLeads:55,batchLimit:50,exactFormTriggers:1,recovered:0,cashVerified:false,publicPostsSent:0,...extra});
function diagnostics(s,extra={},mode='ENABLED_NOT_VERIFIED'){return s.ocRecoveryDiagnostics_(properties({...defaults,...extra}),NOW,mode);}
function payload(d){return {at:new Date(NOW).toISOString(),capabilities:{recoveryState:d.mode,actions:{}},recoveryDiagnostics:d,
 leads:{count:0,excludedTests:0,needsAction:[]},social:[],events:[],missing:[],banks:{osvc:{balance:null,configured:false,lastSuccess:''},druzina:{balance:0,configured:true,lastSuccess:''}}};}

test('recovery markers normalize explicit offsets and hide invalid or future property values',()=>{
 const s=load();
 assert.deepEqual(plain(s.ocRecoveryMarker_('2026-10-21T10:00:00+02:00',NOW)),{state:'RECORDED',at:'2026-10-21T08:00:00.000Z'});
 for(const value of [null,'','  '])assert.deepEqual(plain(s.ocRecoveryMarker_(value,NOW)),{state:'MISSING',at:null});
 for(const value of ['PRIVATE-FIXTURE','2026-02-30T00:00:00Z','2026-10-21','2026-10-21T08:00','2026-10-21T08:00:00.001Z']){
  const marker=s.ocRecoveryMarker_(value,NOW);assert.deepEqual(plain(marker),{state:'INVALID',at:null});assert.ok(!JSON.stringify(marker).includes(value));
 }
});

test('settings diagnostics distinguish missing module, binding, form and window without exposing IDs',()=>{
 const s=load();
 const cases=[['MODULE_MISSING',{},'MODULE_MISSING'],['ENABLED_NOT_VERIFIED',{RP_LEAD_FORM_ID:''},'FORM_MISSING'],
  ['PAUSED',{PLATFORM_RECOVERY_SINCE:null},'WINDOW_MISSING'],['NOT_CONFIGURED',{},'NO_RUN_RECORD'],
  ['ENABLED_NOT_VERIFIED',{PLATFORM_RECOVERY_LAST_OK:'PRIVATE-FIXTURE'},'INVALID_RECORD']];
 for(const [mode,props,reason] of cases){const d=diagnostics(s,props,mode);assert.equal(d.reason,reason);assert.doesNotThrow(()=>s.validateSnapshot(payload(d)));assert.doesNotMatch(JSON.stringify(d),/TEST-ONLY|PRIVATE-FIXTURE/);}
 s.RP={};assert.equal(diagnostics(s).reason,'BINDING_MISSING');
 s.RP.SPREADSHEET_ID='  ';assert.equal(diagnostics(s).bound,false);
 delete s.RP;assert.equal(diagnostics(s).bound,false);
});

test('latest error remains visible until a strictly later success marker, never a live-health claim',()=>{
 const s=load(),error='2026-10-20T08:00:00Z';
 for(const ok of [null,'2026-10-19T08:00:00Z',error])assert.equal(diagnostics(s,{PLATFORM_RECOVERY_LAST_ERROR_AT:error,PLATFORM_RECOVERY_LAST_OK:ok}).reason,'ERROR_RECORDED');
 const d=diagnostics(s,{PLATFORM_RECOVERY_LAST_ERROR_AT:error,PLATFORM_RECOVERY_LAST_OK:'2026-10-21T07:00:00Z'});
 assert.equal(d.reason,'RECORDS_PRESENT');assert.doesNotThrow(()=>s.validateSnapshot(payload(d)));
});

test('automatic snapshots read only selected properties without inspecting Forms, triggers or running recovery',()=>{
 const reads=[],s=load({platformRecoveryPreview:()=>{throw Error('No automatic preview');},rpOnLeadFormSubmit:()=>{throw Error('No ingestion');},
  FormApp:new Proxy({},{get(){throw Error('No Form reads');}}),ScriptApp:new Proxy({},{get(){throw Error('No trigger reads');}}),
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>{reads.push(k);return {...defaults,PLATFORM_RECOVERY_PAUSED:'false',PLATFORM_RECOVERY_TRIGGER_ID:'PRIVATE-TRIGGER',UNRELATED_SECRET:'PRIVATE-SECRET'}[k]??null;}})},
  Utilities:{formatDate:()=> '2026-10-21'},SpreadsheetApp:{openById:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/TEST-ONLY'})}});
 s.ocOwner_=()=>{};s.ocRows_=()=>({missing:true,rows:[],url:''});
 const d=s.operatorSnapshot();assert.equal(d.recoveryDiagnostics.reason,'NO_RUN_RECORD');
 assert.equal(d.recoveryDiagnostics.mode,d.capabilities.recoveryState);assert.doesNotThrow(()=>s.validateSnapshot(d));
 assert.ok(reads.includes('PLATFORM_RECOVERY_LAST_OK'));assert.ok(!reads.includes('PLATFORM_RECOVERY_TRIGGER_ID'));
 assert.doesNotMatch(JSON.stringify(d),/PRIVATE-TRIGGER|PRIVATE-SECRET|TEST-ONLY-FORM/);
});

test('console preview checks owner and explicit recovery binding before calling the module',()=>{
 let calls=0;const s=load({platformRecoveryPreview:()=>{calls++;return report();}});
 s.ocOwner_=()=>{throw Error('Owner required');};assert.throws(()=>s.operatorAction('previewRecovery'),/Owner/);assert.equal(calls,0);
 s.ocOwner_=()=>{};s.RP={};assert.throws(()=>s.operatorAction('previewRecovery'),/binding/);assert.equal(calls,0);
 s.RP.SPREADSHEET_ID='TEST-ONLY';const d=s.operatorAction('previewRecovery');assert.equal(calls,1);assert.equal(d.missingLeads,55);
 assert.doesNotThrow(()=>s.validateRecoveryPreview(d));
});

test('preview projects approved counters and server time while dropping raw module details',()=>{
 const s=load({platformRecoveryPreview:()=>report({error:'PRIVATE-ERROR',responseIds:['PRIVATE-RESPONSE'],formId:'PRIVATE-FORM',checkedAt:'PRIVATE-TIME'})});
 const before=Date.now(),d=s.ocRecoveryPreview_();assert.ok(Date.parse(d.checkedAt)>=before&&Date.parse(d.checkedAt)<=Date.now());
 assert.deepEqual(Object.keys(d).sort(),[...Object.keys(report()),'checkedAt'].sort());assert.doesNotMatch(JSON.stringify(d),/PRIVATE-/);
 assert.doesNotThrow(()=>s.validateRecoveryPreview(d));
});

test('preview rejects malformed counts and any claimed mutation before returning or rendering',()=>{
 const changes=[d=>d.mode='RECOVERED',d=>d.responseCount=-1,d=>d.responseCount='60',d=>d.responseCount=Infinity,d=>d.responseCount=Number.MAX_SAFE_INTEGER+1,
  d=>d.missingLeads=61,d=>d.missingLeads=0.5,d=>d.batchLimit=0,d=>d.batchLimit=51,d=>d.exactFormTriggers=-1,
  d=>d.recovered=1,d=>d.cashVerified=true,d=>d.publicPostsSent=1,d=>delete d.recovered];
 for(const change of changes){const d=report();change(d);const s=load({platformRecoveryPreview:()=>d});
  assert.throws(()=>s.ocRecoveryPreview_(),/Incomplete recovery preview/);
  assert.throws(()=>s.validateRecoveryPreview({...d,checkedAt:new Date(NOW).toISOString()}),/Incomplete recovery preview/);
 }
 for(const checkedAt of [undefined,'private fixture','2026-02-30T00:00:00.000Z','2026-10-21T08:00:00Z'])assert.throws(()=>load().validateRecoveryPreview({...report(),checkedAt}),/Incomplete/);
});

test('existing recovery module preview feeds the new console without new writes or source changes',()=>{
 const calls=[],s=load({ScriptApp:{EventType:{ON_FORM_SUBMIT:'FORM'},getProjectTriggers:()=>[
  {getHandlerFunction:()=> 'rpOnLeadFormSubmit',getTriggerSourceId:()=> 'TEST-ONLY-FORM',getEventType:()=> 'FORM'},
  {getHandlerFunction:()=> 'rpOnLeadFormSubmit',getTriggerSourceId:()=> 'OTHER-FORM',getEventType:()=> 'FORM'}]}});
 vm.runInContext(recovery,s);s.prOwner_=()=>calls.push('owner');
 s.prConfig_=()=>({props:properties(defaults),ss:{getSheetByName:()=>({getDataRange:()=>({getValues:()=>[['Submission_ID'],['known']]})})},form:{getId:()=> 'TEST-ONLY-FORM',getResponses:since=>{
  assert.equal(since.toISOString(),'2026-10-01T08:00:00.000Z');calls.push('read');return ['known','missing','missing'].map(id=>({getId:()=>id,getTimestamp:()=>new Date(NOW-1000)}));
 }}});
 const d=s.ocRecoveryPreview_();assert.deepEqual(calls,['owner','read']);assert.equal(d.responseCount,3);assert.equal(d.missingLeads,1);assert.equal(d.exactFormTriggers,1);assert.equal(d.recovered,0);
 assert.doesNotThrow(()=>s.validateRecoveryPreview(d));
});

test('inconsistent or future diagnostics reject the complete snapshot before changing any data',()=>{
 const changes=[d=>d.reason='__proto__',d=>d.mode='PAUSED',d=>d.bound='true',d=>d.formConfigured=1,d=>d.since.state='UNKNOWN',
  d=>d.since.at='2026-10-22T08:00:00.000Z',d=>d.since.at='2026-02-30T00:00:00.000Z',d=>delete d.lastOk,d=>d.lastOk.at='PRIVATE-FIXTURE',
  d=>d.lastOk.state='RECORDED',d=>d.reason='RECORDS_PRESENT'];
 for(const change of changes){const elements={},s=load({document:{getElementById:id=>elements[id]||(elements[id]={style:{}})}}),d=payload(diagnostics(s));
  change(d.recoveryDiagnostics);assert.throws(()=>s.render(d),/recovery diagnostics/);assert.deepEqual(elements,{});
 }
});

test('legacy snapshots clear the previous marker display and label diagnostics unavailable',()=>{
 const elements={},s=load({document:{getElementById:id=>elements[id]||(elements[id]={style:{}})}});
 s.renderRecoveryDiagnostics(diagnostics(s));assert.match(elements.recoveryMarkers.textContent,/01.10.2026, 10:00/);
 s.renderRecoveryDiagnostics();assert.equal(elements.recoveryMarkers.textContent,'');assert.match(elements.recoveryDiagnostics.textContent,/недоступна в этой версии/);
});
