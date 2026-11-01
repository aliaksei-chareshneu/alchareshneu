'use strict';
/**
 * Offline behavioral tests of the exact version-controlled Supabase Edge Function.
 * No HTTP calls, production data, credentials or real DB writes.
 * Node 22+ is needed for stripTypeScriptTypes.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');

const path='supabase/functions/imperion-b2b-intake/index.ts';
const source=fs.readFileSync(path,'utf8');
const ORIGIN='https://aliaksei-chareshneu.github.io';
const payload={company:'Synthetic Example Ltd',contactName:'Test Contact',
 email:'nobody@example.invalid',phone:'',offer:'DATA_PILOT',
 summary:'A purely synthetic request to validate the data quality process.',
 budgetBand:'15000-30000',timeframe:'November 2026',teamSize:3,
 source:'offline_test',privacyAcknowledged:true,website:''};

function runtime({error=null,allowed=true,configured=true}={}){
 const inserted=[],checks=[],client=()=>({
  rpc:async(name)=>{assert.equal(name,'imperion_rsvp_allow_request');checks.push(name);return {data:allowed,error:null};},
  from:(name)=>{
   assert.equal(name,'imperion_b2b_inquiries');
   return {insert:(row)=>{
    inserted.push(row);
    return {select:(fields)=>{
     assert.equal(fields,'id');
     return {single:async()=>error?{error:{code:error},data:null}:
       {error:null,data:{id:'00000000-0000-4000-8000-000000000123'}}};
    }};
   }};
  }
 });
 const clean=source.replace(/^import\s+\{\s*createClient\s*\}\s+from\s+['"]npm:[^'"\n]+['"];?\s*$/m,'');
 assert.notEqual(clean,source,'Supabase client import not found');
 const js=stripTypeScriptTypes(clean,{mode:'strip'});
 let handler;
 vm.runInNewContext(js,{
  createClient:client,TextEncoder,Request,Response,Headers,crypto:webcrypto,
  console:{error:()=>{}},
  Deno:{env:{get:(key)=>configured?({
   SUPABASE_URL:'https://example.invalid',
   SUPABASE_SERVICE_ROLE_KEY:'offline-synthetic-not-a-secret'})[key]||'':''},
   serve:(f)=>{handler=f;}}
 },{timeout:2000,filename:path});
 assert.equal(typeof handler,'function');
 return {handler,inserted,checks};
}
async function request(handle,{method='POST',origin=ORIGIN,body=payload}={}){
 const headers=new Headers();
 if(origin!==null)headers.set('Origin',origin);
 const options={method,headers};
 if(method==='POST'){
  headers.set('Content-Type','application/json');
  options.body=JSON.stringify(body);
 }
 const res=await handle(new Request('https://offline.test/',options));
 return {status:res.status,headers:res.headers,
  body:res.status===204?null:await res.json()};
}

test('source is deployed contract, no embedded credentials',()=>{
 assert.match(source,/osvc_b2b_intake_v1/);
 assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(source,/sk_(?:live|test)_\w{12,}|sb_secret_\w{12,}/);
});
test('GET reports active but no payment or booking',async()=>{
 const r=runtime(),out=await request(r.handler,{method:'GET'});
 assert.equal(out.status,200);
 assert.equal(out.body.accepting,true);
 assert.equal(out.body.paymentCollected,false);
 assert.equal(out.body.bookingConfirmed,false);
 assert.equal(r.inserted.length,0);
});
test('foreign and absent origins are rejected before DB write',async()=>{
 const r=runtime();
 for(const origin of [null,'https://attacker.invalid']){
  const out=await request(r.handler,{origin});
  assert.equal(out.status,403);
  assert.equal(out.body.error,'forbidden_origin');
  assert.equal(out.headers.get('access-control-allow-origin'),null);
 }
 assert.equal(r.inserted.length,0);
});
test('CORS preflight allows only existing website',async()=>{
 const r=runtime();
 const yes=await request(r.handler,{method:'OPTIONS'});
 assert.equal(yes.status,204);
 assert.equal(yes.headers.get('access-control-allow-origin'),ORIGIN);
 const no=await request(r.handler,{method:'OPTIONS',origin:'https://attacker.invalid'});
 assert.equal(no.status,403);
});
test('valid synthetic B2B request yields unconfirmed receipt, not cash',async()=>{
 const r=runtime(),out=await request(r.handler);
 assert.equal(out.status,200);
 assert.equal(out.body.status,'RECEIVED_UNCONFIRMED');
 assert.equal(out.body.confirmed,false);
 assert.equal(out.body.reference,'00000000-0000-4000-8000-000000000123');
 assert.equal(r.inserted.length,1);
 assert.equal(r.inserted[0].company,payload.company);
 assert.equal(r.inserted[0].privacy_acknowledged,true);
 assert.equal(r.checks.length,2);
 assert.ok(!JSON.stringify(out.body).includes(payload.email));
});
test('required consent, service and valid contact cannot be bypassed',async()=>{
 const r=runtime();
 for(const bad of [{privacyAcknowledged:false},{email:'not-email'},
   {offer:'UNAPPROVED'},{summary:'too short'},{teamSize:-2}]){
  assert.equal((await request(r.handler,{body:{...payload,...bad}})).status,400);
 }
 assert.equal(r.inserted.length,0);
});
test('honeypot does not create lead, even with success-looking response',async()=>{
 const r=runtime(),out=await request(r.handler,{body:{...payload,website:'spam'}});
 assert.equal(out.status,200);
 assert.equal(out.body.confirmed,false);
 assert.equal(r.inserted.length,0);
});
test('duplicate is idempotent; database failure fails closed',async()=>{
 const dup=await request(runtime({error:'23505'}).handler);
 assert.equal(dup.status,200);
 assert.equal(dup.body.duplicate,true);
 assert.equal(dup.body.reference,undefined);
 const failed=await request(runtime({error:'23503'}).handler);
 assert.equal(failed.status,503);
 assert.equal(failed.body.reference,undefined);
});
test('rate limit and missing server credentials stop writes',async()=>{
 const limited=runtime({allowed:false});
 assert.equal((await request(limited.handler)).status,429);
 assert.equal(limited.inserted.length,0);
 const offline=runtime({configured:false});
 assert.equal((await request(offline.handler)).status,503);
 assert.equal(offline.inserted.length,0);
 assert.equal((await request(offline.handler,{method:'GET'})).body.accepting,false);
});
