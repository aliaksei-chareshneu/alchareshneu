'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
function edge(name,env,client){
 client ||= require('@supabase/supabase-js').createClient;
 let handler;
 const source=fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8');
 const clean=source.replace(/^import .*;\s*$/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(clean,{mode:'strip'}),{
  createClient:client,crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,Headers,console,
  Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn;}}
 },{timeout:2000});
 return handler;
}
const HEADERS=['Lead_ID','Created_At','Full_Name','Email','Telegram_Handle','Phone_Number',
 'Source','Service','Subject_Goal','Language','Format','Stage','Product_ID','Expected_Value_CZK',
 'Next_Action_At','Last_Contact_At','Followup_Count','Trial_At','Paid_CZK','Sessions_Remaining',
 'Renewal_At','Owner','Notes','Submission_ID','Retention_Until','Last_Automation_At','Action_Status',
 'Priority','Receipt_Status','Receipt_Attempts','Receipt_Sent_At','Receipt_Locale'];
// Google services are local adapters. These are NOT cloud Google Sheets or delivery proof.
function crm(){
 const grid=[HEADERS.slice()],kv=new Map(),mailbox=[];
 let mailFails=false,propertyFails=false,markerFails=false;
 const sheet={getLastColumn:()=>grid[0].length,getLastRow:()=>grid.length,getSheetId:()=>945016744,
  getRange(r,c,n=1,w=1){return {
   getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>String(grid[r+i-1]?.[c+j-1]??''))),
   getDisplayValue:()=>String(grid[r-1]?.[c-1]??''),
   getValues:()=>grid.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w)),
   setValues(values){for(let i=0;i<n;i++){grid[r+i-1]??=[];for(let j=0;j<w;j++)grid[r+i-1][c+j-1]=values[i][j];}},
   setValue(v){if(markerFails&&c===27)throw Error('synthetic marker outage');grid[r-1]??=[];grid[r-1][c-1]=v;},
   setNumberFormat(){},clearContent(){grid[r-1][c-1]='';}
  };}
 };
 const ss={getSheetByName:n=>n==='Leads'?sheet:null};
 const PropertiesService={getScriptProperties:()=>({getProperty:k=>kv.get(k)||null,
  setProperty(k,v){if(propertyFails)throw Error('synthetic properties outage');kv.set(k,v);},
  deleteProperty:k=>kv.delete(k)})};
 const MailApp={sendEmail(...args){if(mailFails)throw Error('synthetic mail outage');mailbox.push(args);}};
 const source=fs.readFileSync('imperion-intake-sync.gs','utf8');
 const api=new Function('PropertiesService','MailApp',source+
  '; return {impWriteB2B_,impRecoverB2BOwnerDigest_,impQueueOwnerDigest_,impFlushOwnerDigest_,impPendingDigest_};')(PropertiesService,MailApp);
 return {api,ss,grid,kv,mailbox,HEADERS,
  faults(o){mailFails=!!o.mail;propertyFails=!!o.properties;markerFails=!!o.marker;},
  rows:()=>grid.slice(1).map(row=>Object.fromEntries(HEADERS.map((k,i)=>[k,row[i]])))};
}
module.exports={edge,crm};
