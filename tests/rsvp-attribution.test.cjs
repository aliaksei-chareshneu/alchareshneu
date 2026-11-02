'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pages=['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html'];
const backend=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
const bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const crm=fs.readFileSync('imperion-intake-sync.gs','utf8');
const privacy=fs.readFileSync('register/privacy/index.html','utf8');

test('all four forms display an optional source choice and forward only short campaign codes',()=>{
 for(const file of pages){
  const html=fs.readFileSync(file,'utf8');
  for(const phrase of ['id="discoverySource"','value="IS_MUNI"','value="SPOLEK_MUNI"',
    "body.discoverySource=$('discoverySource').value","body.utmSource=query.get('utm_source')||query.get('src')||''",
    "body.utmCampaign=query.get('utm_campaign')||''","body.utmMedium=query.get('utm_medium')||''"])
   assert.ok(html.includes(phrase),file+': missing '+phrase);
  for(const locale of ['cs','en','ru','uk'])assert.ok(html.includes('attributionQuestion:'),file+'/'+locale);
  assert.ok(html.includes('attributionNote:'));
  assert.ok(html.includes("futureUpdates:$('future').checked"));
 }
});
test('privacy notice retains opt-in isolation and documents attribution in four languages',()=>{
 for(const key of ['id="cs"','id="en"','id="ru"','id="uk"','utm_source','utm_campaign','90 dní','90 days','90 дней','90 днів'])
  assert.ok(privacy.includes(key),key);
 assert.ok(privacy.includes('marketing')&&privacy.includes('souhlas'));
});
test('server inserts only safe attribution and never changes duplicate consent semantics',()=>{
 for(const key of ['function discoveryCode','function campaignCode','discovery_source:v.discovery',
  'utm_source:v.utmSource','utm_medium:v.utmMedium','utm_campaign:v.utmCampaign',
  "writeError.code!=='23505'",'marketing_requested:v.future'])
  assert.ok(backend.includes(key),key);
 const start=backend.indexOf('const DISCOVERY_CHOICES=');
 const end=backend.indexOf('async function hashedBucket',start);
 assert.ok(start>0&&end>start);
 let snippet=backend.slice(start,end).replace(' as const;',';')
  .replace('function discoveryCode(v:unknown):string|null','function discoveryCode(v)')
  .replace('function campaignCode(v:unknown,max:number):string|null','function campaignCode(v,max)')
  .replace('s as typeof DISCOVERY_CHOICES[number]','s');
 const fn=new Function('text',snippet+';return {discoveryCode,campaignCode};')((v,max)=>String(v??'').trim().slice(0,max));
 assert.equal(fn.discoveryCode('IS_MUNI'),'IS_MUNI');
 assert.equal(fn.discoveryCode('not_a_channel'),null);
 assert.equal(fn.campaignCode('GOTOBRNO',48),'GOTOBRNO');
 assert.equal(fn.campaignCode('MUNI_HEMA_NOV14',64),'MUNI_HEMA_NOV14');
 assert.equal(fn.campaignCode('alice@example.com',48),null);
 assert.equal(fn.campaignCode('https://example.com/x',48),null);
 assert.equal(fn.campaignCode('a'.repeat(50),48),null);
});
test('attribution reaches the existing script-owned CRM through the authenticated intake bridge',()=>{
 for(const key of ['discovery_source,utm_source,utm_medium,utm_campaign'])assert.ok(bridge.includes(key));
 for(const key of ['function impEnsureRsvpAttribution_','Discovery_Source','UTM_Source','UTM_Medium','UTM_Campaign',
   'impEnsureRsvpAttribution_(sh)','Discovery_Source:r.discovery_source||'])
   assert.ok(crm.includes(key),key);
 assert.ok(crm.includes("Source_Channel:'WEBSITE_RSVP_SUPABASE_UNCONFIRMED'"));
 assert.ok(crm.includes("Receipt_Status:'PENDING'"));
});

test('new Orel source entries are idempotent, never mark a seat approved, never contact applicants',()=>{
 const api=new Function(crm+';return {impAppendOrelSource_};')();
 const rows=[];
 const sheet={
  getLastRow:()=>rows.length+1,
  getRange:(row,col,n=1,w=1)=>({
   getDisplayValues:()=>rows.slice(row-2,row-2+n).map(x=>[x[1]]),
   setValues:values=>{if(col!==1||w!==14)throw Error('wrong source destination');rows.push(...values);}
  })
 };
 const ss={getSheetByName:name=>name==='OREL_20261114_Sources'?sheet:null};
 const item={event_id:'PUB-OREL-20261114',email:'source-test@example.invalid',
  first_name:'Source',last_name:'Test',rsvp_status:'YES',language:'en',
  discovery_source:'SPOLEK_MUNI',utm_source:'MUNI_EMAIL',utm_campaign:'HEMA_NOV14'};
 api.impAppendOrelSource_(ss,item);
 api.impAppendOrelSource_(ss,item);
 assert.equal(rows.length,1);
 assert.equal(rows[0][4],'Spolek přírodovědců MUNI');
 assert.equal(rows[0][9],'FORM_REPORTED');
 assert.equal(rows[0][10],'NOT_REQUESTED');
 assert.match(rows[0][13],/no seat approval/i);
 api.impAppendOrelSource_(ss,{...item,event_id:'UNRELATED'});
 assert.equal(rows.length,1);
});
