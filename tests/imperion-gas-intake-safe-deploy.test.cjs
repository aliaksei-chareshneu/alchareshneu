'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {patchStartup,assertEqual}=require('../ops/imperion-gas-intake-safe-deploy.cjs');
const source=[
 'function impPrivateConfig_(){return {};}',
 'function imperionSyncPrivateIntake(){',
 '  var lock={};',
 '    var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId);',
 '    try{impAgent4CrmPull_(cfg,ss);}catch(e){}',
 '}'].join('\n')+'\n';
test('patch is idempotent and leaves the early Agent4 hook intact',()=>{
 const first=patchStartup(source);
 assert.equal(first.state,'PATCH_READY');
 assert.match(first.source,/ss=impStartupReadWithRetry_/);
 assert.match(first.source,/impAgent4CrmPull_\(cfg,ss\)/);
 assert.equal(patchStartup(first.source).state,'ALREADY_PATCHED');
});
test('unexpected module or missing original call fails closed',()=>{
 assert.throws(()=>patchStartup(source.replace('impAgent4CrmPull_(cfg,ss)','wrong()')),/HOOK_NOT_UNIQUE/);
 assert.throws(()=>patchStartup(source.replace('SpreadsheetApp.openById(cfg.sheetId)','unknownOpen()')),/SOURCE_DIVERGENCE_ABORT/);
});
test('cloud module hashes must not change except intake target',()=>{
 const a=new Map([['ImperionIntakeSync.js','aa'],['PrivateAgent4.js','bb']]);
 const b=new Map([['ImperionIntakeSync.js','cc'],['PrivateAgent4.js','bb']]);
 assert.doesNotThrow(()=>assertEqual(a,b,'ImperionIntakeSync.js'));
 b.set('PrivateAgent4.js','bad');
 assert.throws(()=>assertEqual(a,b,'ImperionIntakeSync.js'),/UNRELATED_CLOUD_FILE_DRIFT/);
});
