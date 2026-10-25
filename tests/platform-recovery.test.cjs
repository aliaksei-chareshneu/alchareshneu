const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(extra={}){let s={Date,Object,String,Error,Math,ScriptApp:{EventType:{ON_FORM_SUBMIT:'FORM'}},...extra};vm.createContext(s);vm.runInContext(fs.readFileSync(__dirname+'/../PlatformRecovery.gs','utf8'),s);return s;}
const response=(id,time=1)=>({getId:()=>id,getTimestamp:()=>new Date(time)});
test('retry and duplicate provider events create one recovery item',()=>{let s=load(),p=s.prPlanRecovery_([response('a'),response('a'),response('b')],{b:true},50);assert.equal(p.batch.length,1);assert.equal(p.batch[0].getId(),'a');});
test('batches never skip older missing responses',()=>{let s=load(),p=s.prPlanRecovery_([response('b',2),response('a',1)],{},1);assert.equal(p.batch[0].getId(),'a');assert.equal(p.remaining,1);});
test('missing immutable response ID fails closed',()=>assert.throws(()=>load().prPlanRecovery_([response('')],{},50),/immutable/));
test('timestamp boundary must be explicit and valid',()=>{let s=load();for(let value of ['', 'garbage','2999-01-01'])assert.throws(()=>s.prSince_({getProperty:()=>value}));});
test('form handler on another source is not healthy',()=>{let s=load(),t=id=>({getHandlerFunction:()=> 'rpOnLeadFormSubmit',getTriggerSourceId:()=>id,getEventType:()=> 'FORM'});assert.equal(s.prMatchingTriggers_([t('wrong'),t('right')],'right').length,1);});
test('unknown schema fails rather than imports duplicates',()=>assert.throws(()=>load().prKnown_({getDataRange:()=>({getValues:()=>[['Name'],['Alice']]})}),/Submission_ID/));
test('anonymous and nonowner cannot run interactive functions',()=>{for(let active of ['', 'other@example.org']) {let s=load({RP:{SPREADSHEET_ID:'test'},Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>active})},DriveApp:{getFileById:()=>({getOwner:()=>({getEmail:()=> 'owner@example.org'})})}});assert.throws(()=>s.prOwner_(),/Owner/);}});
test('paused scheduled job has no data access',()=>{let s=load({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'true'})}});assert.equal(s.platformRecoveryTick_().status,'PAUSED');});
test('forged scheduled invocation is rejected',()=>{let s=load({PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='PLATFORM_RECOVERY_PAUSED'?'false':'real'})}});assert.throws(()=>s.platformRecoveryTick_({triggerUid:'fake'}),/identity/);});
test('repair keeps one matching trigger and preserves unrelated handlers',()=>{let deleted=[],released=0,triggers=[['right','a','rpOnLeadFormSubmit'],['right','b','rpOnLeadFormSubmit'],['wrong','c','rpOnLeadFormSubmit'],['right','d','other']].map(([source,id,fn])=>({getTriggerSourceId:()=>source,getUniqueId:()=>id,getHandlerFunction:()=>fn,getEventType:()=> 'FORM'}));let s=load({LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},ScriptApp:{EventType:{ON_FORM_SUBMIT:'FORM'},getProjectTriggers:()=>triggers.filter(t=>!deleted.includes(t.getUniqueId())),deleteTrigger:t=>deleted.push(t.getUniqueId())}});s.prOwner_=()=>{};s.prConfig_=()=>({form:{getId:()=> 'right'}});assert.equal(s.platformRepairFormTrigger().exactFormTriggers,1);assert.deepEqual(deleted,['b','c']);assert.equal(released,1);});
test('overlapping trigger repairs cannot create competing replacements or delete one another',()=>{
 let held=false,reentered=false,created=0,released=0;const triggers=[],deleted=[];
 const lock={tryLock:()=>{if(held)return false;held=true;return true;},releaseLock:()=>{held=false;released++;}};
 const s=load({LockService:{getUserLock:()=>lock},ScriptApp:{EventType:{ON_FORM_SUBMIT:'FORM'},getProjectTriggers:()=>{
   if(!reentered){reentered=true;assert.throws(()=>s.platformRepairFormTrigger(),/already running/);}
   return triggers.filter(t=>!deleted.includes(t.getUniqueId()));
 },deleteTrigger:t=>deleted.push(t.getUniqueId()),newTrigger:()=>({forForm:()=>({onFormSubmit:()=>({create:()=>{
   const id='synthetic-'+(++created),t={getHandlerFunction:()=> 'rpOnLeadFormSubmit',getTriggerSourceId:()=> 'right',getEventType:()=> 'FORM',getUniqueId:()=>id};triggers.push(t);return t;
 }})})})}});
 s.prOwner_=()=>{};s.prConfig_=()=>({form:{getId:()=> 'right'}});
 assert.equal(s.platformRepairFormTrigger().exactFormTriggers,1);assert.equal(created,1);assert.deepEqual(deleted,[]);assert.equal(released,1);assert.equal(held,false);
 assert.equal(s.platformRepairFormTrigger().exactFormTriggers,1);assert.equal(created,1);assert.equal(released,2);
});
test('trigger repair releases its lock after configuration or readback failure',()=>{
 let released=0;const s=load({LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock:()=>released++})}});
 s.prOwner_=()=>{};s.prConfig_=()=>{throw Error('synthetic configuration failure');};
 assert.throws(()=>s.platformRepairFormTrigger(),/configuration failure/);assert.equal(released,1);
 s.prConfig_=()=>({form:{getId:()=> 'right'}});
 s.ScriptApp.getProjectTriggers=()=>{throw Error('synthetic readback failure');};
 assert.throws(()=>s.platformRepairFormTrigger(),/readback failure/);assert.equal(released,2);
});
test('failed ingestion never writes success checkpoint and releases lock',()=>{let released=false,s=load({LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock:()=>released=true})},rpOnLeadFormSubmit:()=>{throw Error('write failed')}});s.prInspect_=()=>({plan:{batch:[response('a')]}});assert.throws(()=>s.prRecover_(),/write failed/);assert.equal(released,true);});
test('timer blocked until E2E verified',()=>{let s=load();s.prOwner_=()=>{};s.prConfig_=()=>({props:{getProperty:()=>null}});assert.throws(()=>s.platformInstallRecoveryTimer(),/actual Form/);});
test('recovery window rejects ambiguous, normalized and invalid offset timestamps',()=>{
 const s=load();
 for(const value of ['2024-01-01','2024-01-01T00:00:00','2024-02-30T00:00:00Z','2023-02-29T00:00:00Z','2024-01-01T24:00:00Z','2024-01-01T00:60:00Z','2024-01-01T00:00:60Z','2024-01-01T00:00:00+14:01','2024-01-01T00:00:00+15:00','2024-01-01T00:00:00+02:60','2999-01-01T00:00:00Z'])
  assert.throws(()=>s.prSince_({getProperty:()=>value}),/Invalid recovery start timestamp/,value);
});
test('explicit Prague offset and UTC recovery windows identify the same instant',()=>{
 const s=load();
 assert.equal(s.prSince_({getProperty:()=> '2026-09-25T00:00:00+02:00'}).toISOString(),'2026-09-24T22:00:00.000Z');
 assert.equal(s.prSince_({getProperty:()=> '2024-02-29T00:00:00.123Z'}).toISOString(),'2024-02-29T00:00:00.123Z');
});
test('duplicate submission columns stop inspection before reading form responses',()=>{
 let reads=0;const s=load();
 s.prConfig_=()=>({ss:{getSheetByName:()=>({getDataRange:()=>({getValues:()=>[['Submission_ID','Submission_ID'],['','already-saved']]})})},form:{getResponses:()=>{reads++;return [response('already-saved')];}}});
 s.RP={LEADS_SHEET:'Leads'};
 assert.throws(()=>s.prInspect_(),/Duplicate Submission_ID/);assert.equal(reads,0);
});
test('invalid recovery window stops inspection before reading form responses',()=>{
 let reads=0;const s=load();
 s.prConfig_=()=>({props:{getProperty:()=> '2024-02-30T00:00:00Z'},ss:{getSheetByName:()=>({getDataRange:()=>({getValues:()=>[['Submission_ID']]})})},form:{getResponses:()=>{reads++;return [];}}});
 s.RP={LEADS_SHEET:'Leads'};
 assert.throws(()=>s.prInspect_(),/Invalid recovery start timestamp/);assert.equal(reads,0);
});
test('editor preview logs a bounded read-only receipt without private inspection data',()=>{
 const logs=[],s=load({console:{log:value=>logs.push(value)}});
 s.prOwner_=()=>{};
 const summary={mode:'READ_ONLY',responseCount:3,missingLeads:1,batchLimit:50,exactFormTriggers:1,recovered:0,cashVerified:false,publicPostsSent:0};
 s.prInspect_=()=>({summary:{...summary,privateField:'PRIVATE-SUMMARY-FIXTURE'},c:{token:'PRIVATE-TOKEN-FIXTURE'},plan:{batch:[response('PRIVATE-RESPONSE-FIXTURE')]}});
 const returned=s.platformRecoveryPreview();
 assert.equal(returned.missingLeads,1);assert.equal(logs.length,1);
 const receipt=JSON.parse(logs[0]),{event,checkedAt,...counts}=receipt;
 assert.equal(event,'RECOVERY_PREVIEW');assert.ok(isFinite(Date.parse(checkedAt)));
 assert.deepEqual(counts,summary);assert.doesNotMatch(logs[0],/PRIVATE/);
});
test('denied or failed preview never emits a successful receipt',()=>{
 const logs=[],s=load({console:{log:value=>logs.push(value)}});let inspections=0;
 s.prOwner_=()=>{throw Error('Owner access required');};
 s.prInspect_=()=>{inspections++;throw Error('Invalid recovery start timestamp');};
 assert.throws(()=>s.platformRecoveryPreview(),/Owner/);assert.equal(inspections,0);assert.equal(logs.length,0);
 s.prOwner_=()=>{};
 assert.throws(()=>s.platformRecoveryPreview(),/Invalid recovery/);assert.equal(inspections,1);assert.equal(logs.length,0);
});
