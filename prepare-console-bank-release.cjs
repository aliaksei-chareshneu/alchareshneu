// Prepare an isolated, reviewable clasp directory. Does not push or run banking.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function prepare(source,out,expectedId){
 source=path.resolve(source);out=path.resolve(out);
 if(!expectedId)throw Error('Explicit confirmed bound script ID required');
 if(fs.existsSync(out))throw Error('Output already exists; choose a new directory');
 if(out===source||out.startsWith(source+path.sep))throw Error('Output must be outside source');
 const config=JSON.parse(fs.readFileSync(path.join(source,'.clasp.json'),'utf8'));
 if(config.scriptId!==expectedId||!['.',undefined].includes(config.rootDir))throw Error('Wrong script target or unexpected rootDir');
 const replacements={'OperatorConsoleServer.js':'OperatorConsoleServer.gs','OperatorConsole.html':'OperatorConsole.html','FioOSVC.js':'FioOSVC.gs','FioDruzinaConsole.js':'FioDruzinaConsole.gs','PaymentReconciliation.js':'PaymentReconciliation.gs'};
 const files={};
 for(const name of fs.readdirSync(source)){
  if(name==='.clasp.json'||/\.(js|gs|html|json)$/.test(name)){
   if(!fs.statSync(path.join(source,name)).isFile())throw Error('Unexpected directory');
   files[name]=fs.readFileSync(path.join(source,name),'utf8');
  }
 }
 if(!files['appsscript.json'])throw Error('Manifest missing');
 for(const [dest,src] of Object.entries(replacements))files[dest]=fs.readFileSync(path.join(__dirname,src),'utf8');
 const names=new Set(),bases=new Set();
 for(const [name,text] of Object.entries(files)){
  if(!/\.(js|gs|html)$/.test(name))continue;
  const base=name.replace(/\.[^.]+$/,'');if(bases.has(base))throw Error('Duplicate Apps Script filename: '+base);bases.add(base);
  if(/\.(js|gs)$/.test(name)){
   new vm.Script(text,{filename:name});
   for(const m of text.matchAll(/^function\s+(\w+)\s*\(/gm)){if(names.has(m[1]))throw Error('Duplicate function: '+m[1]);names.add(m[1]);}
  }
 }
 new vm.Script(files['OperatorConsole.html'].match(/<script>([\s\S]*?)<\/script>/)[1]);
 fs.mkdirSync(out,{recursive:true});for(const [name,text] of Object.entries(files))fs.writeFileSync(path.join(out,name),text);
 return {files:Object.keys(files).length-1,sourcePreserved:true,uploaded:false};
}
module.exports={prepare};
if(require.main===module){const [source,out,id]=process.argv.slice(2);if(!source||!out||!id)throw Error('Usage: node prepare-console-bank-release.cjs FRESH_PULL_DIR NEW_RELEASE_DIR CONFIRMED_BOUND_SCRIPT_ID');console.log(JSON.stringify(prepare(source,out,id)));}
