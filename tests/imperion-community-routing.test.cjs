'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const edge=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
const gs=fs.readFileSync('imperion-intake-sync.gs','utf8');
const start=edge.indexOf('// Canonical community announcement links');
const end=edge.indexOf('const EVENT_COLS=',start);
assert.ok(start>=0&&end>start);
const portable=edge.slice(start,end).replace(/ as const;/g,';')
  .replace(/(community|locale|age|rsvp): string/g,'$1');
const backendRoute=new Function(portable+'; return communityChannels;')();
const helpers=new Function(gs+';return {impCommunityRoute_,impReceiptMessage_,impSendApprovedChatInvites_};')();
const expected={
 druzina:{newsWa:'https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu',
  chatWaProperty:'IMPERION_CHAT_DRUZINA_WA',
  newsTg:'https://t.me/druzinamoravy_news',chatTgProperty:'IMPERION_CHAT_DRUZINA_TG',
  access:'AFTER_ATTENDANCE_AND_NEXT_TRAINING_PAYMENT',community:'Družina Moravy'},
 brnowalkers:{newsWa:'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0',
  chatWaProperty:'IMPERION_CHAT_BRNOWALKERS_WA',
  newsTg:'https://t.me/pochody_brno_news',chatTgProperty:'IMPERION_CHAT_BRNOWALKERS_TG',
  access:'AFTER_ATTENDANCE',community:'Brnowalkers'}
};
test('CZ/EN go to WhatsApp News; RU/UA go to Telegram News for both communities',()=>{
 for(const [key,v] of Object.entries(expected)){
  for(const lang of ['cs','en','ru','uk']){
   const platform=['cs','en'].includes(lang)?'whatsapp':'telegram';
   const route=backendRoute(v.community,lang,'adult','YES');
   const mail=helpers.impCommunityRoute_(v.community,lang);
   assert.equal(route.platform,platform,key+'/'+lang);
   assert.equal(route.informationUrl,platform==='whatsapp'?v.newsWa:v.newsTg);
   assert.equal(route.chatAccess,v.access);
   assert.equal(Object.prototype.hasOwnProperty.call(route,'chatUrl'),false);
   assert.equal(mail.platform,platform);
   assert.equal(mail.news,route.informationUrl);
   assert.equal(mail.chatProperty,platform==='whatsapp'?v.chatWaProperty:v.chatTgProperty);
  }
 }
});
test('Backend refuses community links to minors, declined RSVP, unknown event community',()=>{
 for(const k of Object.values(expected)){
  for(const lang of ['cs','en','ru','uk']){
   assert.equal(backendRoute(k.community,lang,'under18','YES'),null);
   assert.equal(backendRoute(k.community,lang,'adult','NO'),null);
   assert.equal(backendRoute('Unrelated operator',lang,'adult','YES'),null);
   assert.ok(backendRoute(k.community,lang,'adult','MAYBE'));
  }
 }
 assert.equal(backendRoute('Družina Moravy','de','adult','YES'),null);
 assert.ok(!edge.split('const EVENT_COLS=')[1].split(';')[0].includes('COMMUNITY_UPDATES'));
});
test('Receipt emails offer correct news channel in all four languages, not gated chat',()=>{
 const m={Submission_ID:0,Source_Channel:1,Event_ID:2,Email:3,Age:4,
  RSVP_Status:5,Receipt_Locale:6,Data_Controller:7};
 const id='12345678-1234-4123-8123-123456789012';
 for(const [key,v] of Object.entries(expected))for(const lang of ['cs','en','ru','uk']){
  const event={community:v.community,title:'Example community event',category:'Hike',
   updates_group_url:'https://chat.whatsapp.com/'+'A'.repeat(22)};
  const events={EXAMPLE:event};
  const makeRow=(age,rsvp)=>[id,'WEBSITE_RSVP_SUPABASE_UNCONFIRMED','EXAMPLE',
   'qa@example.invalid',age,rsvp,lang,key==='druzina'?'Družina Moravy, z. s.':'BrnoWalkers'];
  const res=helpers.impReceiptMessage_('RSVP',makeRow('adult','REGISTERED'),m,events);
  assert.ok(res.body.includes(['cs','en'].includes(lang)?v.newsWa:v.newsTg),key+'/'+lang);
  assert.ok(!res.body.includes('Chat_Invite_'),'No private chat invitation status in receipt');
  if(['ru','uk'].includes(lang)) assert.ok(!res.body.includes(event.updates_group_url),'RU/UA must not receive event WA invite');
  for(const row of [makeRow('under18','REGISTERED'),makeRow('adult','DECLINED')]){
   const body=helpers.impReceiptMessage_('RSVP',row,m,events).body;
   assert.ok(!body.includes(v.newsWa)&&!body.includes(v.newsTg),'Minor/decline must not be invited');
  }
 }
});
test('All four pages consume API routes and contain no unconditional community chat invites',()=>{
 for(const lang of ['cs','en','ru','uk']){
  const file=lang==='cs'?'register/index.html':'register/'+lang+'/index.html';
  const s=fs.readFileSync(file,'utf8');
  assert.ok(s.includes('payload?.communityChannels'),file);
  assert.ok(s.includes("body.ageGroup==='adult' && body.rsvp!=='NO'"),file);
  assert.ok(s.includes('channels?.platform===platform'),file);
  for(const k of Object.values(expected)){
   assert.ok(!/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}/.test(s),'No hardcoded WhatsApp group invite on '+file);
  }
 }
});
test('Separate verified-attendance invite queue is disabled by default and requires manual evidence',()=>{
 assert.match(gs,/IMPERION_CHAT_INVITES_LIVE/);
 assert.match(gs,/ATTENDED_AND_NEXT_TRAINING_PAID_VERIFIED/);
 assert.match(gs,/ATTENDED_VERIFIED/);
 assert.match(gs,/Check_In_At/);
 assert.match(gs,/Chat_Access_Approval/);
 const fakeProperties={getScriptProperties:()=>({getProperty:()=>null})};
 const disabled=new Function('PropertiesService',gs+'; return impSendApprovedChatInvites_;')(fakeProperties);
 assert.deepEqual(disabled(null,null),{sent:0,failed:0,disabled:true});
});
