// Prepare an isolated, reviewable clasp directory. Does not push or run banking.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parse}=require('./console-release-acorn.cjs');
function globalBindings(text,filename){
 let tree;
 try{new vm.Script(text,{filename});tree=parse(text,{ecmaVersion:'latest',sourceType:'script'});}
 catch(_){throw Error('Invalid Apps Script source: '+filename);}
 const bindings=[],strict=tree.body.some(node=>node.directive==='use strict');
 function pattern(node,kind){
  if(!node)return;
  if(node.type==='Identifier')bindings.push({name:node.name,kind});
  else if(node.type==='RestElement')pattern(node.argument,kind);
  else if(node.type==='AssignmentPattern')pattern(node.left,kind);
  else if(node.type==='ArrayPattern')node.elements.forEach(item=>pattern(item,kind));
  else if(node.type==='ObjectPattern')node.properties.forEach(item=>pattern(item.type==='RestElement'?item.argument:item.value,kind));
 }
 function visit(node,parent){
  if(node.type==='FunctionDeclaration'){
   // Sloppy-script block functions can also create global bindings (Annex B).
   if(parent===tree||!strict)pattern(node.id,'function');
   return;
  }
  if(node.type==='FunctionExpression'||node.type==='ArrowFunctionExpression'||node.type==='ClassExpression')return;
  if(node.type==='ClassDeclaration'){if(parent===tree)pattern(node.id,'lexical');return;}
  if(node.type==='VariableDeclaration'){
   if(node.kind==='var'||parent===tree)node.declarations.forEach(item=>pattern(item.id,node.kind==='var'?'var':'lexical'));
   return;
  }
  for(const child of Object.values(node)){
   if(Array.isArray(child))child.forEach(item=>{if(item&&typeof item.type==='string')visit(item,node);});
   else if(child&&typeof child.type==='string')visit(child,node);
  }
 }
 visit(tree,null);return bindings;
}
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
 const names=new Map(),bases=new Set();
 for(const [name,text] of Object.entries(files)){
  if(!/\.(js|gs|html)$/.test(name))continue;
  const base=name.replace(/\.[^.]+$/,'');if(bases.has(base))throw Error('Duplicate Apps Script filename: '+base);bases.add(base);
  if(/\.(js|gs)$/.test(name)){
   for(const binding of globalBindings(text,name)){
    const previous=names.get(binding.name);
    if(previous&&!(previous==='var'&&binding.kind==='var'))throw Error('Duplicate global declaration: '+binding.name);
    names.set(binding.name,binding.kind);
   }
  }
 }
 new vm.Script(files['OperatorConsole.html'].match(/<script>([\s\S]*?)<\/script>/)[1]);
 fs.mkdirSync(out,{recursive:true});for(const [name,text] of Object.entries(files))fs.writeFileSync(path.join(out,name),text);
 return {files:Object.keys(files).length-1,sourcePreserved:true,uploaded:false};
}
module.exports={prepare};
if(require.main===module){const [source,out,id]=process.argv.slice(2);if(!source||!out||!id)throw Error('Usage: node prepare-console-bank-release.cjs FRESH_PULL_DIR NEW_RELEASE_DIR CONFIRMED_BOUND_SCRIPT_ID');console.log(JSON.stringify(prepare(source,out,id)));}
