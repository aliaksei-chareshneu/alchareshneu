'use strict';
// Surgical preparation for the EXISTING Hub Fio modules. Never runs a bank
// sync, modifies properties, creates a token/trigger, pushes or deploys.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..');
function prepareBank(sourceDir,outDir){
 sourceDir=path.resolve(sourceDir);outDir=path.resolve(outDir);
 if(sourceDir===outDir||outDir.startsWith(sourceDir+path.sep)||sourceDir.startsWith(outDir+path.sep))throw Error('Separate directories required');
 if(fs.existsSync(outDir)&&fs.readdirSync(outDir).length)throw Error('Output must be new or empty');
 const manifest=JSON.parse(fs.readFileSync(path.join(repo,'tests/fixtures/community-fio/source-sha256.json'),'utf8'));
 const outputs=[];
 for(const [name,profile] of [['FioBank.js','DRUZINA'],['FioOSVC.js','OSVC']]){
  const source=fs.readFileSync(path.join(sourceDir,name),'utf8').replace(/\r\n/g,'\n');
  if(crypto.createHash('sha256').update(source).digest('hex')!==manifest[name])throw Error('Source drift: '+name);
  const anchor="'', '', importedAt, '', '', ''";
  if(source.split(anchor).length!==2)throw Error('Bank row adapter source changed');
  const guard='  if(!(typeof DRU_BANK_TRIGGER_CONTEXT_!==\'undefined\'&&DRU_BANK_TRIGGER_CONTEXT_===true))ocOwner_();';
  let patched=source.replace(anchor,"'', '', importedAt, '', '', drurSignImport_(tx,'"+profile+"')");
  if(profile==='OSVC'){
   if(source.split('  ocOwner_();').length!==2)throw Error('Owner guard source changed');
   patched=patched.replace('  ocOwner_();',guard);
  }else{
   const entry='function fioSyncDruzinaReadOnly() {\n';
   if(source.split(entry).length!==2)throw Error('NGO bank entry point changed');
   // The recovered NGO module lacked a caller check. A private sheet alone
   // does not authorize an anonymous web-app caller to read the bank.
   patched=patched.replace(entry,entry+guard+'\n');
  }
  outputs.push([name,patched]);
 }
 fs.mkdirSync(outDir,{recursive:true});
 outputs.forEach(([name,source])=>fs.writeFileSync(path.join(outDir,name),source));
 fs.copyFileSync(path.join(repo,'DruzinaBankReceipt.gs'),path.join(outDir,'DruzinaBankReceipt.js'));
 fs.copyFileSync(path.join(repo,'DruzinaBankImportSchedule.gs'),path.join(outDir,'DruzinaBankImportSchedule.js'));
 return {mode:'EXISTING_FIO_IMPORT_SOURCE_STAGED',bankClientsAdded:0,tokenCopies:0,files:4};
}
if(require.main===module){const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('Usage: node ops/prepare-druzina-bank-import.cjs SOURCE_DIR NEW_OUTPUT_DIR');console.log(JSON.stringify(prepareBank(source,out)));}
module.exports={prepareBank};
