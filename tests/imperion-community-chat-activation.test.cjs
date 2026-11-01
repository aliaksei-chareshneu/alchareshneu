'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('imperion-intake-sync.gs','utf8');
const api=new Function(source+';return {impCommunityChatInvitePlan_,impCommunityChatInviteMessage_,imperionCommunityChatInvitesTick,imperionCommunityChatInvitesInstall};')();
function sheet(values){
 return {
  getLastRow:()=>values.length,getLastColumn:()=>values[0].length,
  getRange:(r,c,n,w)=>({getDisplayValues:()=>values.slice(r-1,r-1+n).map(z=>z.slice(c-1,c-1+w))}),
  getDataRange:()=>({getValues:()=>values})
 };
}
const controller='Družina Moravy, z. s.',src='WEBSITE_RSVP_SUPABASE_UNCONFIRMED';
const regNames=['Email','First_Name','Last_Name','Event_ID','Age','Source_Channel',
 'Check_In_At','RSVP_Status','Data_Controller','Registration_Locale',
 'Marketing_Consent','Community_Chat_Invite_Sent_At','Community_Chat_Invite_Status',
 'Community_Chat_Invite_Attempts'];
const reg=(vals={})=>regNames.map(k=>Object.hasOwn(vals,k)?vals[k]:({
 Email:'attendee@example.invalid',First_Name:'Anna',Last_Name:'Example',
 Event_ID:'d1',Age:'adult',Source_Channel:src,Check_In_At:'2026-11-02 18:20',
 RSVP_Status:'CONFIRMED',Data_Controller:controller,Registration_Locale:'ru',
 Marketing_Consent:'CONFIRMED'
}[k]||''));
const events=[
 ['Event_ID','Community','End_DateTime','Status','Data_Controller'],
 ['d1','Družina Moravy',new Date('2026-11-02T19:00:00Z'),'Completed',controller],
 ['d2','Družina Moravy',new Date('2026-11-03T19:00:00Z'),'Completed',controller],
 ['b1','Brnowalkers',new Date('2026-11-04T18:00:00Z'),'Completed',controller],
 ['commercial','Brnowalkers',new Date('2026-11-04T18:00:00Z'),'Completed','OSVČ'],
 ['older','Brnowalkers',new Date('2026-10-12T18:00:00Z'),'Completed',controller]
];
const conf=[
 ['Key','Value','Status','Effective_From','Type'],
 ['COMMUNITY_CHAT_DM_TELEGRAM','https://t.me/druzinamoravy','LINK_VERIFIED_20261101','','community_chat'],
 ['COMMUNITY_CHAT_DM_WHATSAPP','https://chat.whatsapp.com/'+'a'.repeat(22),'LINK_VERIFIED_20261101','','community_chat'],
 ['COMMUNITY_CHAT_BW_TELEGRAM','https://t.me/pochody_brno','LINK_VERIFIED_20261101','','community_chat'],
 ['COMMUNITY_CHAT_BW_WHATSAPP','https://chat.whatsapp.com/'+'b'.repeat(22),'LINK_VERIFIED_20261101','','community_chat']
];
const ss=(registrations,config=conf)=>({getSheetByName:n=>({
 Registrations:sheet([regNames,...registrations]),
 Events:sheet(events),Druzina_Config:sheet(config)
}[n]||null)});
const now=new Date('2026-11-05T22:00:00Z').getTime();
test('private chat planner: two Druzina visits, one BrnoWalkers visit, no duplicate',()=>{
 const p=api.impCommunityChatInvitePlan_(ss([
  reg({Event_ID:'d1'}),reg({Event_ID:'d2'}),reg({Event_ID:'b1',Registration_Locale:'en'})
 ]),now);
 assert.equal(p.queue.length,2);
 assert.deepEqual(p.queue.map(x=>[x.brand,x.platform]).sort(),[['BW','WHATSAPP'],['DM','TELEGRAM']]);
 assert.deepEqual(p.queue.map(x=>x.index).sort(),[1,2]);
});
test('private chat planner excludes missing consent, minors, declined, canceled, OSVC, stale events and repeat invitations',()=>{
 for(const change of [
  {Marketing_Consent:'REQUESTED_UNCONFIRMED'},
  {Marketing_Consent:'NO'}, {Age:'under18'}, {RSVP_Status:'DECLINED'},
  {RSVP_Status:'CANCELLED'}, {Source_Channel:'MANUAL'}, {Check_In_At:''},
  {Event_ID:'commercial'},{Event_ID:'older'},
  {Data_Controller:'Other'}, {Email:'invalid'}
 ]){
  const p=api.impCommunityChatInvitePlan_(ss([reg({...change,Event_ID:change.Event_ID||'b1'})]),now);
  assert.equal(p.queue.length,0,JSON.stringify(change));
 }
 const singleDm=api.impCommunityChatInvitePlan_(ss([reg({Event_ID:'d1'})]),now);
 assert.equal(singleDm.queue.length,0,'one Druzina visit must not qualify');
 const already=api.impCommunityChatInvitePlan_(ss([
  reg({Event_ID:'d1',Community_Chat_Invite_Sent_At:'2026-11-04'}),
  reg({Event_ID:'d2'})
 ]),now);
 assert.equal(already.queue.length,0,'one past invitation excludes duplicates');
 const corrupt=conf.map(x=>x.slice());corrupt[4][2]='NOT_VERIFIED';
 assert.throws(()=>api.impCommunityChatInvitePlan_(ss([],corrupt),now),/Missing one of four/);
});
test('chat messages localize and do not imply confirmed booking',()=>{
 for(const locale of ['cs','en','ru','uk']){
  const msg=api.impCommunityChatInviteMessage_('DM',locale,'WHATSAPP','https://chat.whatsapp.com/'+'a'.repeat(22));
  assert.ok(msg.subject.includes('Družina Moravy'));
  assert.match(msg.body,/https:\/\/chat.whatsapp.com\//);
  assert.ok(msg.body.length>125);
 }
 assert.equal(api.impCommunityChatInviteMessage_('DM','other','TELEGRAM','https://t.me/druzinamoravy'),null);
});
test('invitation sender is disabled by default and installer is explicitly owner gated',()=>{
 const disabled=new Function('PropertiesService',source+';return imperionCommunityChatInvitesTick;')({
  getScriptProperties:()=>({getProperty:()=>null})
 });
 assert.deepEqual(disabled(),{enabled:false,eligible:0,sent:0});
 assert.match(source,/Session\.getEffectiveUser\(\)\.getEmail\(\)/);
 assert.match(source,/\.everyHours\(1\)\.create\(\)/);
 assert.match(source,/IMP_CHAT_INVITE_FLAG,'true'/);
 assert.match(source,/MailApp\.sendEmail/);
 assert.ok(!source.includes('JzeXAQF8I2XE3zQ2OqWsPz'),'private chat link not hardcoded');
});
