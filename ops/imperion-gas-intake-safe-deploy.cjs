#!/usr/bin/env node
'use strict';
// Owner-only GAS deployment for reviewed PR #357. Never replace live GAS
// with the public GitHub copy: private Agent4 cloud modules must be preserved.
// Default dry-run; explicit --apply required for a cloud write.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),
crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const SCRIPT_ID='1a_AHisFPBBLsi7I_T5rXBL0NmikoA4Iux7UaqLVAiX8aYLtPY-G3CRhl';
const TARGET='ImperionIntakeSync.js';
const OLD='    var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId);';
const NEW='    var cfg=impStartupReadWithRetry_(function(){return impPrivateConfig_();}),\n'+
'        ss=impStartupReadWithRetry_(function(){return SpreadsheetApp.openById(cfg.sheetId);});';
const MAIN='function imperionSyncPrivateIntake(){';
const EARLY='impAgent4CrmPull_(cfg,ss)';
const HELPER=[
'/** Only READ-ONLY startup calls may be retried; NEVER retry sends or ACK. */',
'function impStartupReadWithRetry_(operation){',
'  var delays=[0,500,1500];',
'  for(var attempt=0;attempt<delays.length;attempt++){',
'    if(attempt)Utilities.sleep(delays[attempt]);',
'    try{return operation();}',
'    catch(e){',
"      var message=String(e&&e.message||e||'');",
'      var temporary=/Service Spreadsheets (?:failed|timed out) while accessing document|server error occurred|server not available|Error code INTERNAL/i.test(message);',
'      if(!temporary||attempt===delays.length-1)throw e;',
"      console.warn('IMPERION intake startup: transient Google backend failure, retry '+(attempt+1)+'/'+(delays.length-1));",
'    }',
'  }',
'}',
].join('\n')+'\n';
const count=(source,needle)=>source.split(needle).length-1;
function patchStartup(source){
 if(typeof source!=='string'||source.length<150)throw Error('INVALID_SOURCE');
 if(count(source,MAIN)!==1||count(source,EARLY)!==1)throw Error('CLOUD_IMPORTER_OR_AGENT4_HOOK_NOT_UNIQUE');
 const h=count(source,'function impStartupReadWithRetry_(');
 if(h===1&&count(source,NEW)===1&&count(source,OLD)===0){
  new vm.Script(source,{filename:TARGET});return {state:'ALREADY_PATCHED',source};
 }
 if(h!==0||count(source,NEW)!==0||count(source,OLD)!==1)throw Error('SOURCE_DIVERGENCE_ABORT');
 const next=source.replace(MAIN,HELPER+'\n'+MAIN).replace(OLD,NEW);
 if(count(next,EARLY)!==1||count(next,NEW)!==1||
    count(next,'function impStartupReadWithRetry_(')!==1)throw Error('PATCH_INVARIANT_FAILED');
 new vm.Script(next,{filename:TARGET});
 return {state:'PATCH_READY',source:next};
}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function files(dir){
 const out=new Map();
 function scan(root,prefix){
  for(const e of fs.readdirSync(root,{withFileTypes:true})){
   const rel=prefix?prefix+'/'+e.name:e.name,full=path.join(root,e.name);
   if(rel==='.clasp.json')continue;
   if(e.isDirectory())scan(full,rel);
   else if(e.isFile())out.set(rel,hash(fs.readFileSync(full)));
   else throw Error('UNSUPPORTED_SOURCE_FILE_TYPE');
  }
 }
 scan(dir,'');return out;
}
function assertEqual(before,after,except){
 if(before.size!==after.size)throw Error('CLOUD_FILE_COUNT_CHANGED');
 for(const [name,value] of before){
  if(!after.has(name))throw Error('CLOUD_FILE_REMOVED:'+name);
  if(name!==except&&after.get(name)!==value)throw Error('UNRELATED_CLOUD_FILE_DRIFT:'+name);
 }
}
function clasp(args,cwd){
 const r=cp.spawnSync('clasp',args,{cwd,shell:process.platform==='win32',
  encoding:'utf8',timeout:180000,maxBuffer:1024*1024,windowsHide:true});
 if(r.error||r.status!==0)throw Error('CLASP_'+args[0].toUpperCase()+'_FAILED_NO_AUTORETRY');
}
function clone(dir){
 fs.mkdirSync(dir,{recursive:true});
 clasp(['clone',SCRIPT_ID],dir);
 const cfg=path.join(dir,'.clasp.json');
 if(!fs.existsSync(cfg)||JSON.parse(fs.readFileSync(cfg,'utf8')).scriptId!==SCRIPT_ID)
  throw Error('CLOUD_PROJECT_ID_MISMATCH');
 if(!fs.existsSync(path.join(dir,TARGET))||
    !fs.existsSync(path.join(dir,'ImperionAgent4CrmPull.js')))
  throw Error('EXPECTED_PRIVATE_GAS_MODULES_MISSING');
 const map=files(dir);
 if(map.size<26)throw Error('CLOUD_FILE_COUNT_UNEXPECTED');
 return map;
}
function main(){
 const args=process.argv.slice(2);
 if(args.length>1||(args.length===1&&args[0]!=='--apply'))throw Error('USAGE: [--apply]');
 const apply=args.includes('--apply');
 const owner=path.join(process.env.USERPROFILE||os.homedir(),
   'ChatGPT-Workspace','80-Digital-Platform-Automation','.clasp.json');
 if(!fs.existsSync(owner))throw Error('OWNER_CLASP_CONFIG_MISSING');
 if(JSON.parse(fs.readFileSync(owner,'utf8')).scriptId!==SCRIPT_ID)
  throw Error('WRONG_OWNER_PROJECT_ABORT');
 const stage=path.join(process.env.LOCALAPPDATA||os.tmpdir(),
   'ImperionAgents','clasp-private-staging');
 fs.mkdirSync(stage,{recursive:true});
 const root=fs.mkdtempSync(path.join(stage,'intake-retry-'));
 const before=path.join(root,'before');
 const base=clone(before);
 const original=fs.readFileSync(path.join(before,TARGET),'utf8');
 const patch=patchStartup(original);
 if(patch.state==='ALREADY_PATCHED'){
  process.stdout.write('ALREADY_PATCHED_IN_CLOUD; check executions separately\n');return;
 }
 const ready=path.join(root,'ready');
 assertEqual(base,clone(ready));
 fs.writeFileSync(path.join(ready,TARGET),patch.source,'utf8');
 const staged=files(ready);
 assertEqual(base,staged,TARGET);
 if(staged.get(TARGET)!==hash(Buffer.from(patch.source)))throw Error('STAGE_HASH_MISMATCH');
 if(!apply){process.stdout.write('SAFE_DRY_RUN_READY: cloud read verified; no cloud writes\n');return;}
 assertEqual(base,clone(path.join(root,'prepush')));
 // A failed push may have partially succeeded: never automatically retry.
 clasp(['push'],ready);
 const after=path.join(root,'readback');
 assertEqual(base,clone(after),TARGET);
 const live=fs.readFileSync(path.join(after,TARGET),'utf8');
 if(patchStartup(live).state!=='ALREADY_PATCHED'||
    hash(Buffer.from(live))!==staged.get(TARGET))
  throw Error('CLOUD_READBACK_UNVERIFIED_NO_AUTORETRY');
 process.stdout.write('CLOUD_SOURCE_READBACK_PASS; verify next scheduled execution separately\n');
}
if(require.main===module){
 try{main()}catch(e){process.stderr.write('BLOCKED '+String(e.message||e)+'\n');process.exitCode=1;}
}
module.exports={patchStartup,assertEqual};
