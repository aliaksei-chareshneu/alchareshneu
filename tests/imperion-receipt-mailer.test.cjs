const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('imperion-intake-sync.gs','utf8');
const ref='11111111-1111-4111-8111-111111111111';
function harness(){
 const record={
   Submission_ID:ref,Event_ID:'PUB-HIKE-20261101',
   Source_Channel:'WEBSITE_RSVP_SUPABASE_UNCONFIRMED',
   Email:'applicant@example.invalid',Data_Controller:'Družina Moravy, z. s.',
   Receipt_Status:'PENDING',Receipt_Attempts:'0',Receipt_Sent_At:'',Receipt_Locale:'ru'
 };
 const keys=Object.keys(record),rows=[keys,keys.map(k=>record[k])];
 const sheet={
  getLastRow:()=>rows.length,getLastColumn:()=>keys.length,
  getRange:(r,c,n=1,width=1)=>({
    getDisplayValues:()=>rows.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+width).map(String)),
    setValue:v=>{rows[r-1][c-1]=v;},
    clearContent:()=>{rows[r-1][c-1]='';}
  })
 };
 const db={getSheetByName:n=>n==='Registrations'?sheet:null};
 let failFirst=true;const dispatched=[];
 const MailApp={
  getRemainingDailyQuota:()=>50,
  sendEmail:msg=>{if(failFirst){failFirst=false;throw Error('temporary delivery outage');}dispatched.push(msg);}
 };
 const UrlFetchApp={fetch:()=>({
  getResponseCode:()=>200,
  getContentText:()=>JSON.stringify({events:[{
   event_id:'PUB-HIKE-20261101',title:'A verified walk',
   begins_at:'2026-11-01T11:45:00Z',
   venue:'Velká Klajdovka, Brno',price_czk:0,price_verified:true
  }]})
 })};
 const Utilities={formatDate:()=> '01.11.2026 12:45'};
 const api=new Function('MailApp','UrlFetchApp','Utilities',source+
  ';return {impSendReceiptQueue_,impReceiptMessage_,impReceiptWords_};')(MailApp,UrlFetchApp,Utilities);
 return {api,rows,keys,db,dispatched};
}
test('transactional receipt optionally includes one correct channel, without consent or attendance claims',()=>{
 const choose=new Function(source+';return impCommunityInvite_;')();
 const communities=[
  ['Družina Moravy','https://t.me/druzinamoravy_news','https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu'],
  ['Brnowalkers','https://t.me/pochody_brno_news','https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0']
 ];
 for(const [community,tg,wa] of communities){
  for(const locale of ['cs','en','ru','uk']){
   const invite=choose(community,locale,'adult','REGISTERED');
   assert.ok(invite);
   assert.equal(invite.url,locale==='ru'||locale==='uk'?tg:wa);
   assert.equal(choose(community,locale,'adult','MAYBE').url,invite.url);
   assert.equal(choose(community,locale,'under18','REGISTERED'),null);
   assert.equal(choose(community,locale,'adult','DECLINED'),null);
  }
 }
 assert.equal(choose('Unknown','ru','adult','REGISTERED'),null);
 assert.equal(choose('Brnowalkers Družina Moravy','ru','adult','REGISTERED'),null);
 const h=harness(),m=Object.fromEntries(h.keys.map((k,i)=>[k,i]));
 const columns=[...h.keys,'Age','RSVP_Status'];
 const values=[...h.rows[1],'adult','REGISTERED'];
 const map=Object.fromEntries(columns.map((name,i)=>[name,i]));
 const event={'PUB-HIKE-20261101':{
  event_id:'PUB-HIKE-20261101',title:'BrnoWalkers community hike',
  community:'Brnowalkers',category:'Hike',
  begins_at:'2026-11-01T11:45:00Z',venue:'Velká Klajdovka',
  price_verified:true,price_czk:0
 }};
 const receipt=h.api.impReceiptMessage_('RSVP',values,map,event);
 assert.ok(receipt);
 assert.ok(receipt.body.includes('https://t.me/pochody_brno_news'));
 assert.ok(!receipt.body.includes('https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0'));
 values[map.Age]='under18';
 const minor=h.api.impReceiptMessage_('RSVP',values,map,event);
 assert.ok(!minor.body.includes('https://t.me/pochody_brno_news'));
 values[map.Age]='adult';values[map.RSVP_Status]='DECLINED';
 const declined=h.api.impReceiptMessage_('RSVP',values,map,event);
 assert.ok(!declined.body.includes('https://t.me/pochody_brno_news'));
});

test('chat access requires verified visits, matching controller and opt-in',()=>{
 const a=new Function(source+';return {impChatBrand_,impVerifiedChatVisits_,impChatAlreadyInvited_,impPickCommunityChat_,impAttendeeThankYou_};')();
 assert.equal(a.impChatBrand_('Družina Moravy'),'DM');
 assert.equal(a.impChatBrand_('Brnowalkers'),'BW');
 const keys=['Email','First_Name','Last_Name','Data_Controller','Age','Source_Channel','Check_In_At','RSVP_Status','Event_ID','Community_Chat_Invite_Sent_At'];
 const m=Object.fromEntries(keys.map((k,i)=>[k,i]));
 const base={Email:'test@example.invalid',First_Name:'Anna',Last_Name:'Example',Data_Controller:'Družina Moravy, z. s.',
  Age:'adult',Source_Channel:'WEBSITE_RSVP_SUPABASE_UNCONFIRMED',Check_In_At:'01.11.2026',RSVP_Status:'REGISTERED',Event_ID:'a',Community_Chat_Invite_Sent_At:''};
 const row=changes=>keys.map(k=>Object.hasOwn(changes,k)?changes[k]:base[k]);
 const e={a:{brand:'DM',controller:'Družina Moravy, z. s.'},b:{brand:'DM',controller:'Družina Moravy, z. s.'},c:{brand:'BW',controller:'Družina Moravy, z. s.'}};
 const r=row({}),r2=row({Event_ID:'b'});
 assert.equal(a.impVerifiedChatVisits_([r],m,e,r,'DM'),1);
 assert.equal(a.impVerifiedChatVisits_([r,r2],m,e,r,'DM'),2);
 assert.equal(a.impVerifiedChatVisits_([row({Check_In_At:''})],m,e,r,'DM'),0);
 assert.equal(a.impVerifiedChatVisits_([row({First_Name:'Other'})],m,e,r,'DM'),0);
 assert.equal(a.impVerifiedChatVisits_([row({Age:'under18'})],m,e,r,'DM'),0);
 assert.equal(a.impVerifiedChatVisits_([row({RSVP_Status:'DECLINED'})],m,e,r,'DM'),0);
 assert.equal(a.impChatAlreadyInvited_([row({Community_Chat_Invite_Sent_At:'02.11.2026'})],m,e,r,'DM'),true);
 assert.equal(a.impPickCommunityChat_({COMMUNITY_CHAT_DM_TELEGRAM:'https://t.me/examplechat'},'DM','ru').platform,'TELEGRAM');
 assert.equal(a.impPickCommunityChat_({COMMUNITY_CHAT_BW_WHATSAPP:'https://chat.whatsapp.com/abcdefghijklmnopqrstuv'},'BW','cs').platform,'WHATSAPP');
 assert.equal(a.impPickCommunityChat_({},'DM','de'),null);
 const msg=a.impAttendeeThankYou_(['ru','CONFIRMED'],{Registration_Locale:0,Marketing_Consent:1},
  {title:'Test',category:'HEMA',community:'Družina Moravy'}, {getProperty:()=>''},{url:'https://t.me/examplechat'});
 assert.ok(msg.body.includes('https://t.me/examplechat'));
 assert.match(source,/String\(row\[m.Marketing_Consent\]/);
});

test('retries mail outage without creating a second CRM or a confirmed booking',()=>{
 const h=harness(),state=()=>h.rows[1][h.keys.indexOf('Receipt_Status')];
 assert.deepEqual(h.api.impSendReceiptQueue_(h.db,{email:'owner@example.invalid'}),{sent:0,failed:1});
 assert.equal(state(),'RETRY');
 assert.deepEqual(h.api.impSendReceiptQueue_(h.db,{email:'owner@example.invalid'}),{sent:1,failed:0});
 assert.equal(state(),'SENT_TO_PROVIDER');
 assert.equal(h.api.impSendReceiptQueue_(h.db,{email:'owner@example.invalid'}).sent,0);
 assert.equal(h.dispatched.length,1);
 const msg=h.dispatched[0];
 assert.equal(msg.to,'applicant@example.invalid');
 assert.match(msg.body,/A verified walk/);
 assert.match(msg.body,/Velká Klajdovka/);
 assert.match(msg.body,/Не приезжайте и не платите до подтверждения/);
 assert.doesNotMatch(msg.body,/confirmed booking|оплата получена/i);
 assert.equal(msg.replyTo,'owner@example.invalid');
 assert.match(msg.body,/https:\/\/t\.me\/Chareshneu/);
 assert.match(msg.body,/https:\/\/wa\.me\/420702914842/);
});
test('rejects stale/wrong-source and non-email rows, including business rows outside New',()=>{
 const h=harness(), m=Object.fromEntries(h.keys.map((k,i)=>[k,i])),row=h.rows[1].slice();
 assert.ok(h.api.impReceiptMessage_('RSVP',row,m,{}));
 row[m.Source_Channel]='IMPORTED_LEGACY';assert.equal(h.api.impReceiptMessage_('RSVP',row,m,{}),null);
 row[m.Source_Channel]='WEBSITE_RSVP_SUPABASE_UNCONFIRMED';
 row[m.Email]='not-a-valid-email';assert.equal(h.api.impReceiptMessage_('RSVP',row,m,{}),null);
});
test('source contains GDPR-safe dispatch, retry and 5-minute trigger not a marketing campaign',()=>{
 assert.doesNotThrow(()=>new Function(source));
 assert.match(source,/everyMinutes\(5\)/);
 assert.match(source,/impEnsureReceiptCols_/);
 assert.match(source,/MailApp.sendEmail\(\{to:msg.to/);
 assert.match(source,/REVIEW_NO_EMAIL/);
 assert.match(source,/SENT_TO_PROVIDER/);
 assert.doesNotMatch(source,/sendBroadcast|sendCampaign|newsletterSubscribe/);
});

test('post-event follow-up is opt-in controlled, verified-attendance only and never assumes review links',()=>{
 const api=new Function(source+';return {impAttendeeThankYou_,impSendAttendedFollowups_};')();
 const map={Registration_Locale:0,Marketing_Consent:1};
 const row=['ru','REQUESTED_UNCONFIRMED'];
 const ev={title:'BrnoWalkers route',category:'Hike',community:'Brnowalkers'};
 const props={getProperty:()=>''};
 const message=api.impAttendeeThankYou_(row,map,ev,props);
 assert.match(message.body,/честному отзыву/);
 assert.ok(!message.body.includes('t.me/pochody_brno_news'),'unverified marketing opt-in must not receive community invitations');
 assert.doesNotMatch(message.body,/\/review/,'no review URL may be fabricated');
 row[1]='CONFIRMED';
 const withConsent=api.impAttendeeThankYou_(row,map,ev,props);
 assert.ok(withConsent.body.includes('t.me/pochody_brno_news'));
 const disabled=new Function('PropertiesService',source+
   ';return impSendAttendedFollowups_;')({getScriptProperties:()=>({getProperty:()=>null})});
 assert.deepEqual(disabled({},{}),{sent:0,failed:0,disabled:true});
 assert.match(source,/Check_In_At/);
 assert.match(source,/source!==['"]WEBSITE_RSVP_SUPABASE_UNCONFIRMED['"]/);
 assert.match(source,/IMP_EVENT_FOLLOWUP_COLS/);
 assert.match(source,/IMPERION_ATTENDEE_FOLLOWUP_LIVE/);
 assert.ok(source.includes('impSendAttendedFollowups_(ss,cfg)'));
});