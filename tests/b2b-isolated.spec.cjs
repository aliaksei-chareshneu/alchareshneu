'use strict';
const {test,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
const {edge,crm}=require('./helpers/b2b-runtime.cjs');
const ORIGIN='https://aliaksei-chareshneu.github.io';
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-b2b-intake';
const env=process.env;
test.skip(!env.B2B_QA_REST,'Run node scripts/test-b2b-isolated.cjs for disposable local services');
function query(sql){return execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',env.B2B_QA_DB,'psql','-U','postgres','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'}).trim();}
function setup(){
 const localClient=(url,key,options)=>createClient(url,key,{...options,global:{fetch:(url,opts)=>{
  const target=new URL(url);assert.equal(target.origin,env.B2B_QA_REST,'No cloud destinations allowed');
  target.pathname=target.pathname.replace(/^\/rest\/v1/,'');return fetch(target,opts);
 }}});
 const config={SUPABASE_URL:env.B2B_QA_REST,SUPABASE_SERVICE_ROLE_KEY:env.B2B_QA_SERVICE};
 return {intake:edge('imperion-b2b-intake',config,localClient),bridge:edge('imperion-intake-bridge',config,localClient)};
}
const payload={company:'Synthetic Example Ltd',contactName:'Synthetic Contact',email:'synthetic@example.invalid',
 offer:'DATA_PILOT',summary:'Automate one synthetic report with repeatable acceptance checks.',budgetBand:'15000-30000',
 timeframe:'November 2026',teamSize:3,source:'isolated_test',privacyAcknowledged:true,website:''};
async function post(handler,body=payload){return handler(new Request(ENDPOINT,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(body)}));}
async function bridgeCall(handler,body,token='a'.repeat(64)){
 const r=await handler(new Request('http://isolated.invalid/bridge',{method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
 return {status:r.status,body:await r.json()};
}

test('browser → real DB → private bridge → canonical lead → owner local mailbox, independent readbacks',async({page},info)=>{
 const {intake,bridge}=setup();const cloud=crm();let submitted,receipt;
 await page.route('https://**/*',async route=>{
  if(route.request().url()!==ENDPOINT)throw Error('Unexpected external request');
  submitted=route.request().postDataJSON();
  const r=await post(intake,submitted);receipt=await r.json();
  await route.fulfill({status:r.status,contentType:'application/json',body:JSON.stringify(receipt)});
 });
 await page.goto('/corporate/?lang=en&utm_source=instagram&utm_medium=bio&utm_campaign=nov.2026');
 const cta=page.locator('a[href*="request/?lang=en"]').first();await cta.click();
 await expect(page).toHaveURL(/utm_campaign=nov.2026/);
 await page.locator('#offer').selectOption('DATA_PILOT');
 await page.locator('#company').fill(payload.company);await page.locator('#contactName').fill(payload.contactName);
 await page.locator('#email').fill(payload.email);await page.locator('#summary').fill(payload.summary);
 await page.locator('#budgetBand').selectOption(payload.budgetBand);await page.locator('#timeframe').fill(payload.timeframe);
 await page.locator('#privacyAck').check();await page.locator('#submit').click();
 await expect(page.locator('#result')).toHaveClass('ok');
 const id=receipt.reference;assert.match(id,/^[0-9a-f-]{36}$/);await expect(page.locator('#receiptDetails')).toContainText(id);
 // Direct PostgreSQL session, independent of the Edge SDK result.
 const saved=JSON.parse(query('select row_to_json(t) from public.imperion_b2b_inquiries t;'));
 assert.equal(saved.id,id);assert.equal(saved.status,'NEW_UNCONFIRMED');assert.equal(saved.crm_synced_at,null);
 assert.equal(saved.utm_source,'instagram');assert.equal(saved.utm_medium,'bio');assert.equal(saved.utm_campaign,'nov.2026');
 assert.equal(saved.source,'corporate_hero');
 // Duplicate readback returns the same persisted ID, not a fabricated receipt.
 const duplicate=await (await post(intake,submitted)).json();assert.equal(duplicate.reference,id);assert.equal(duplicate.duplicate,true);
 assert.equal(query('select count(*) from public.imperion_b2b_inquiries;'),'1');
 assert.equal((await bridgeCall(bridge,null,'b'.repeat(64))).status,403);
 assert.equal((await bridgeCall(bridge,{action:'ack',rsvps:[],enquiries:[],b2b:['bad-id']})).status,400);
 const batch=await bridgeCall(bridge);assert.equal(batch.status,200);assert.equal(batch.body.b2b.length,1);
 // Execute existing Apps Script mapping; simulate crash after durable CRM append.
 assert.equal(cloud.api.impWriteB2B_(cloud.ss,batch.body.b2b).added,1);
 cloud.faults({properties:true});assert.throws(()=>cloud.api.impRecoverB2BOwnerDigest_(cloud.ss),/properties outage/);
 assert.equal(query('select count(*) from public.imperion_b2b_inquiries where crm_synced_at is null;'),'1');
 cloud.faults({});assert.equal(cloud.api.impWriteB2B_(cloud.ss,batch.body.b2b).added,0);
 cloud.api.impRecoverB2BOwnerDigest_(cloud.ss);cloud.api.impRecoverB2BOwnerDigest_(cloud.ss);
 assert.equal(cloud.api.impPendingDigest_().b2b,1);
 const lead=cloud.rows()[0];assert.equal(cloud.rows().length,1);assert.equal(lead.Submission_ID,'OSVC-B2B-'+id);
 assert.equal(lead.Stage,'New');assert.equal(lead.Paid_CZK,'0');assert.equal(lead.Owner,'Aliaksei');
 assert.ok(lead.Created_At instanceof Date);assert.ok(lead.Next_Action_At instanceof Date);
 assert.match(lead.Notes,/UTM campaign: nov.2026/);assert.match(lead.Notes,/Next action: owner to review/);
 const ack={action:'ack',rsvps:[],enquiries:[],b2b:[id]};
 assert.equal((await bridgeCall(bridge,ack)).body.acked.b2b,1);
 assert.equal((await bridgeCall(bridge,ack)).body.acked.b2b,0);
 assert.equal(query('select count(*) from public.imperion_b2b_inquiries where crm_synced_at is not null;'),'1');
 assert.equal((await bridgeCall(bridge)).body.b2b.length,0);
 cloud.faults({mail:true});assert.equal(cloud.api.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'synthetic'},cloud.ss,{}).pending,true);
 assert.equal(cloud.mailbox.length,0);cloud.faults({});
 assert.equal(cloud.api.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'synthetic'},cloud.ss,{}).sent,true);
 cloud.api.impRecoverB2BOwnerDigest_(cloud.ss);cloud.api.impFlushOwnerDigest_({email:'owner@example.invalid',sheetId:'synthetic'},cloud.ss,{});
 assert.equal(cloud.mailbox.length,1);assert.ok(cloud.mailbox[0][2].includes(id));
 assert.ok(!cloud.mailbox[0][2].includes(payload.email));assert.ok(!cloud.mailbox[0][2].includes(payload.contactName));
 await info.attach('isolated-readback.json',{body:JSON.stringify({reference:id,databaseRows:1,crmRows:cloud.rows().length,
  sourceAcked:true,crmStage:lead.Stage,nextAction:true,ownerLocalMailbox:cloud.mailbox.length,ownerMessageContainsId:true,
  googleAdapters:'LOCAL_ONLY',cloudWrites:0,paid:false},null,2),contentType:'application/json'});
});

test('DB access, validation, honeypot, spam budget and error paths fail closed',async({page})=>{
 const {intake}=setup();
 for(const role of ['ANON','AUTHENTICATED']){
  const r=await fetch(env.B2B_QA_REST+'/imperion_b2b_inquiries',{headers:{Authorization:'Bearer '+env['B2B_QA_'+role]}});
  assert.equal(r.status,role==='ANON'?401:403);
 }
 assert.equal(query("select relrowsecurity from pg_class where oid='public.imperion_b2b_inquiries'::regclass;"),'t');
 const before=query('select count(*) from public.imperion_b2b_inquiries;');
 for(const change of [{privacyAcknowledged:false},{email:'broken'},{teamSize:501},{website:'spam'}]){
  const r=await post(intake,{...payload,...change});assert.equal(r.status,400);assert.equal((await r.json()).reference,undefined);
 }
 assert.equal(query('select count(*) from public.imperion_b2b_inquiries;'),before);
 for(let i=0;i<5;i++)await post(intake,{...payload,email:'rate@example.invalid'});
 assert.equal((await post(intake,{...payload,email:'rate@example.invalid'})).status,429);
 // Browser must never display acceptance from an unbacked successful-looking reply.
 await page.route(ENDPOINT,route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"status":"RECEIVED_UNCONFIRMED","confirmed":false}'}));
 await page.goto('/corporate/request/?lang=en&service=DATA_PILOT');
 await page.locator('#company').fill(payload.company);await page.locator('#contactName').fill(payload.contactName);
 await page.locator('#email').fill(payload.email);await page.locator('#summary').fill(payload.summary);
 await page.locator('#budgetBand').selectOption('unknown');await page.locator('#timeframe').fill('next month');await page.locator('#privacyAck').check();
 await page.locator('#submit').click();await expect(page.locator('#result')).toHaveClass('err');await expect(page.locator('#receiptDetails')).toBeHidden();
});
