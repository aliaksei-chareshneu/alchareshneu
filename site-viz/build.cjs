"use strict";
const esbuild=require("esbuild"),path=require("node:path"),fs=require("node:fs");
const out=path.resolve(__dirname,"../druzina/viz");fs.mkdirSync(out,{recursive:true});
Promise.all([
 esbuild.build({entryPoints:[path.join(__dirname,"effects.js")],outfile:path.join(out,"effects.js"),bundle:true,minify:true,format:"iife",target:"es2020",legalComments:"eof"}),
 esbuild.build({entryPoints:[path.join(__dirname,"ranks.jsx")],outfile:path.join(out,"ranks.js"),bundle:true,minify:true,format:"iife",target:"es2020",jsx:"automatic",legalComments:"eof",define:{"process.env.NODE_ENV":'"production"'}})
]).then(()=>{
 for(const name of ["effects.js","ranks.js"]){
  const bytes=fs.statSync(path.join(out,name)).size;
  if(bytes<1000||bytes>1500000)throw Error(name+": unsafe size "+bytes);
  console.log("built",name,bytes,"bytes");
 }
}).catch(e=>{console.error(e);process.exitCode=1});
