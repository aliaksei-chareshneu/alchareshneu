'use strict';
// Local preparation only. No provider calls, credentials, clasp push or deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..');
const hash=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
function replaceOne(text,from,to,name){if(text.split(from).length!==2)throw Error('Source drift: '+name);return text.replace(from,to);}
function prepare(sourceDir,outDir){
 sourceDir=path.resolve(sourceDir);outDir=path.resolve(outDir);
 if(sourceDir===outDir||sourceDir.startsWith(outDir+path.sep)||outDir.startsWith(sourceDir+path.sep))throw Error('Separate source/output directories required');
 if(fs.existsSync(outDir)&&fs.readdirSync(outDir).length)throw Error('Output must be new or empty');
 const manifest=JSON.parse(fs.readFileSync(path.join(repo,'tests/fixtures/druzina-portal-p13/source-sha256.json'),'utf8'));
 for(const [name,expected] of Object.entries(manifest.git_normalized_lf_sha256)){
  if(hash(fs.readFileSync(path.join(sourceDir,name),'utf8'))!==expected)throw Error('Source drift: '+name);
 }
 const index=fs.readFileSync(path.join(sourceDir,'Index.html'),'utf8');
 const hub=fs.readFileSync(path.join(sourceDir,'Hub.html'),'utf8');
 const patchedIndex=replaceOne(replaceOne(index,'init().catch(err);','// Initialization follows the reviewed payment/account integration.','Index boot'),
  '</body>',"<?!= include_('DruzinaQrEncoder'); ?>\n<?!= include_('DruzinaPortalClient'); ?>\n<script>init().catch(err);</script>\n</body>",'Index body');
 const patchedHub=replaceOne(hub,'</body>',"<?!= include_('DruzinaOperatorClient'); ?>\n</body>",'Hub body');
 fs.mkdirSync(outDir,{recursive:true});
 for(const name of fs.readdirSync(sourceDir))if(!name.startsWith('.')&&/\.(js|gs|html|json)$/.test(name)&&name!=='source-sha256.json')
  fs.copyFileSync(path.join(sourceDir,name),path.join(outDir,name));
 for(const name of ['DruzinaBillingPolicy','DruzinaFioReadiness','DruzinaSafetyRelease','DruzinaSeniorEvidence',
  'DruzinaFioBridge','DruzinaFioCommit','DruzinaFioProofReconcile','DruzinaMemberAccount','DruzinaPortalApi','DruzinaNotifications',
  'DruzinaBankReceipt','DruzinaBankWorker'])
  fs.copyFileSync(path.join(repo,name+'.gs'),path.join(outDir,name+'.js'));
 for(const name of ['DruzinaPortalClient.html','DruzinaOperatorClient.html'])fs.copyFileSync(path.join(repo,name),path.join(outDir,name));
 const qr=fs.readFileSync(require.resolve('qrcode-generator'),'utf8');
 fs.writeFileSync(path.join(outDir,'DruzinaQrEncoder.html'),'<script>\n'+qr.replace(/<\/script/gi,'<\\/script')+'\n</script>');
 fs.writeFileSync(path.join(outDir,'Index.html'),patchedIndex);
 fs.writeFileSync(path.join(outDir,'Hub.html'),patchedHub);
 const adminPath=path.join(outDir,'Admin.js');
 const admin=fs.readFileSync(adminPath,'utf8');
 fs.writeFileSync(adminPath,replaceOne(admin,
  'function hourlyMaintenance_(){ return withLock_(()=>{ cleanupExpiredHolds_(); ensureSessions_(); updateSessionWindows_(); }); }',
  'function hourlyMaintenance_(){ withLock_(()=>{ cleanupExpiredHolds_(); ensureSessions_(); updateSessionWindows_(); }); return {bank:drufReconcileImportedBank_(),notifications:drunQueueBookingNotifications_(),delivery:drunDeliverNotifications_()}; }',
  'existing hourly maintenance'));
 const files=fs.readdirSync(outDir).sort();
 const receipt={mode:'LOCAL_SOURCE_STAGING_ONLY',bankAdapterLive:false,claspConfigCopied:false,
  files:files.map(name=>({name,sha256:hash(fs.readFileSync(path.join(outDir,name),'utf8'))}))};
 fs.writeFileSync(path.join(outDir,'STAGING-READBACK.json'),JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}
function render(stageDir,mode='book'){
 let html=fs.readFileSync(path.join(stageDir,mode==='hub'?'Hub.html':'Index.html'),'utf8');
 html=html.replace(/<\?= mode \?>/g,mode).replace(/<\?= token \?>/g,'');
 return html.replace(/<\?!= include_\('([^']+)'\);? \?>/g,(_,name)=>fs.readFileSync(path.join(stageDir,name+'.html'),'utf8'));
}
if(require.main===module){const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('Usage: node ops/prepare-druzina-portal.cjs SOURCE_DIR NEW_OUTPUT_DIR');const r=prepare(source,out);console.log(JSON.stringify({mode:r.mode,fileCount:r.files.length,bankAdapterLive:r.bankAdapterLive,claspConfigCopied:r.claspConfigCopied}));}
module.exports={prepare,render};
