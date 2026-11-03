#!/usr/bin/env node
/**
 * Owner-only bank-statement staging; never deploy in GitHub Pages.
 * Default dry-run; --apply requires owner GO and private credentials.
 * This does not approve evidence or activate a pass: independent matching
 * and identity review use service-role-only reconciliation RPCs.
 * Required normalized CSV from an authentic bank export:
 * provider_transaction_id,booked_on,amount_czk,payment_reference
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
function csvRows(content){
 const rows=[];let cells=[],value='',quoted=false;
 const input=content.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){
  const ch=input[i],next=input[i+1];
  if(ch==='"'){
   if(quoted&&next==='"'){value+='"';i++;}
   else quoted=!quoted;
  }else if(ch===','&&!quoted){cells.push(value);value='';}
  else if((ch==='\r'||ch==='\n')&&!quoted){
   if(ch==='\r'&&next==='\n')i++;
   cells.push(value);value='';
   if(cells.some(v=>v.trim()))rows.push(cells);
   cells=[];
  }else value+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quotes');
 cells.push(value);if(cells.some(v=>v.trim()))rows.push(cells);
 return rows;
}
function parseStatement(raw,controller,actor){
 if(!controller||controller.length>180||!actor||actor.length<3)throw Error('Controller/actor required');
 if(Buffer.byteLength(raw,'utf8')>2*1024*1024)throw Error('File too large');
 const rows=csvRows(raw);
 if(rows.length<2||rows.length>1001)throw Error('Expected 1–1000 records');
 const expected=['provider_transaction_id','booked_on','amount_czk','payment_reference'];
 const head=rows.shift().map(x=>x.trim());
 if(head.length!==expected.length||!head.every((h,i)=>h===expected[i]))
  throw Error('Unexpected columns (must be normalized from authoritative bank export)');
 const seen=new Set();
 return rows.map((row,i)=>{
  if(row.length!==head.length)throw Error('Malformed CSV line '+(i+2));
  const [tx,booked,rawAmount,ref]=row.map(v=>v.trim());
  if(tx.length<5||tx.length>180||seen.has(tx))throw Error('Invalid/duplicate transaction id at row '+(i+2));
  seen.add(tx);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(booked)||Number.isNaN(Date.parse(booked+'T12:00:00Z'))||
      new Date(booked+'T12:00:00Z').toISOString().slice(0,10)!==booked)
   throw Error('Invalid booking date at row '+(i+2));
  if(!/^[1-9]\d*$/.test(rawAmount)||!Number.isSafeInteger(Number(rawAmount))||Number(rawAmount)>1000000)
   throw Error('Invalid positive CZK amount at row '+(i+2));
  if(ref.length>180)throw Error('Payment reference too long');
  return {data_controller:controller,provider_transaction_id:tx,
   source_kind:'OWNER_STATEMENT_EXPORT',imported_by:actor,
   booked_on:booked,amount_czk:Number(rawAmount),payment_reference:ref||null};
 });
}
async function main(){
 const args=process.argv.slice(2),fileAt=args.indexOf('--file'),controllerAt=args.indexOf('--controller');
 const actor=String(process.env.IMPERION_PAYMENT_OPERATOR||'').trim();
 if(fileAt<0||controllerAt<0||!args[fileAt+1]||!args[controllerAt+1])
  throw Error('Usage: --file <trusted-statement.csv> --controller <legal-entity> [--apply]');
 const filepath=path.resolve(args[fileAt+1]);
 const data=parseStatement(fs.readFileSync(filepath,'utf8'),args[controllerAt+1],actor);
 const dryRun=!args.includes('--apply');
 console.log(JSON.stringify({mode:dryRun?'DRY_RUN':'APPLY',count:data.length,
  controller:args[controllerAt+1],totalCzk:data.reduce((a,b)=>a+b.amount_czk,0)}));
 if(dryRun)return;
 if(process.env.IMPERION_BANK_IMPORT_GO!=='YES')throw Error('Explicit owner GO missing');
 const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||key.length<60)
  throw Error('Private Supabase credentials missing/invalid');
 // Individual requests keep database unique constraints as the final dedupe.
 for(let i=0;i<data.length;i+=50){
  const res=await fetch(url+'/rest/v1/imperion_bank_movements?on_conflict=data_controller,provider_transaction_id',{
   method:'POST',headers:{'Content-Type':'application/json',
    'apikey':key,'Authorization':'Bearer '+key,
    'Prefer':'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify(data.slice(i,i+50)),signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('Bank statement batch rejected by server: HTTP '+res.status);
 }
 console.log(JSON.stringify({mode:'UPLOADED_NOT_RECONCILED',
  count:data.length,paidVerified:0,packagesActivated:0}));
}
if(require.main===module){main().catch(e=>{console.error(String(e.message||e));process.exitCode=1;});}
module.exports={csvRows,parseStatement};
