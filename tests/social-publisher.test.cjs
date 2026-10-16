'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(extra={}){
 const context={Date,Error,JSON,String,Number,RegExp,Object,Array,encodeURIComponent,
  TELEGRAM_BOT_TOKEN:'',FACEBOOK_ENABLED:false,FACEBOOK_GRAPH_VERSION:'v26.0',
  formatDateForPost:v=>String(v),escapeHtml:s=>String(s),
  ...extra};
 vm.createContext(context);
 for(const file of ['SocialPublisher.gs','SocialPublisherAdapters.gs']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 }
 return context;
}
function event(overrides={}){
 return {Status:'Active',Category:'Free Event',Community:'Brnowalkers',
  Event_ID:'DEMO',Title:'Test Hike',Description:'Bring walking shoes',
  Start_DateTime:'2099-02-01 10:00',Location_Address:'Brno',Price_CZK:0,
  Tally_Form_URL:'https://example.org/registration',...overrides};
}
function job(overrides={}){
 return {Channel:'telegram',Entity:'Družina Moravy z.s.',Grant_Funded:'NO',
  Grant_Text:'',Caption:'Only verified contents',Rights_OK:'',
  Visibility:'private',Made_For_Kids:'NO',...overrides};
}
test('all public channels require reviewed legal entity and grant decision',()=>{
 const s=load();
 assert.equal(s.spValidate_(event(),job()),true);
 assert.throws(()=>s.spValidate_(event(),job({Entity:''})),/legal entity/);
 assert.throws(()=>s.spValidate_(event(),job({Grant_Funded:''})),/Grant_Funded/);
 assert.throws(()=>s.spValidate_(event(),job({Grant_Funded:'YES'})),/grant attribution/);
});
test('refuses Corporate/cancelled, disallows arbitrary destinations',()=>{
 const s=load();
 assert.throws(()=>s.spValidate_(event({Category:'Corporate'}),job()),/active public/);
 assert.throws(()=>s.spValidate_(event({Status:'Archived'}),job()),/active public/);
 assert.throws(()=>s.spValidate_(event(),job({Channel:'facebook_personal_auto'})),/Invalid/);
});
test('instagram needs licensed public HTTPS image; videos need verified rights',()=>{
 const s=load();
 assert.throws(()=>s.spValidate_(event(),job({Channel:'instagram'})),/HTTPS/);
 assert.throws(()=>s.spValidate_(event(),job({Channel:'instagram',Media_URL:'https://example.org/a.jpg'})),/rights/);
 assert.equal(s.spValidate_(event(),job({Channel:'instagram',Media_URL:'https://example.org/a.jpg',Rights_OK:'YES'})),true);
 assert.throws(()=>s.spValidate_(event(),job({Channel:'youtube',Rights_OK:'YES',Video_Drive_ID:'id',Made_For_Kids:''})),/Made_For_Kids/);
});
test('public grant text appears in prepared content',()=>{
 const s=load();
 const text=s.spCaption_(event(),job({Grant_Funded:'YES',Grant_Text:'Mandatory partner acknowledgement'}));
 assert.match(text,/FREE \/ ZDARMA/);
 assert.match(text,/Mandatory partner acknowledgement/);
 assert.match(text,/https:\/\/example.org\/registration/);
});
test('manual targets are never in auto-adapter dispatch',()=>{
 const s=load();
 assert.equal(s.spManual_('facebook_profile'),true);
 assert.equal(s.spManual_('whatsapp'),true);
 assert.equal(s.SP_AUTO.includes('facebook_profile'),false);
 assert.equal(s.SP_AUTO.includes('whatsapp'),false);
 assert.throws(()=>s.spSend_(event(),job({Channel:'facebook_profile'})),/Automatic publishing not supported/);
});
test('Telegram and Page existing receipts prevent duplicate API calls',()=>{
 const s=load({getChannelId:()=> '@example_channel',
  sendTelegramMessage:()=>{throw Error('should not send Telegram');},
  postToFacebookPage:()=>{throw Error('should not send Facebook');}});
 const tg=s.spSend_(event({Telegram_Post_ID:'14'}),job());
 assert.equal(tg.existing,true);assert.match(tg.url,/example_channel\/14/);
 const fb=s.spSend_(event({Facebook_Post_ID:'12_34'}),job({Channel:'facebook_page'}));
 assert.equal(fb.existing,true);
});
test('does not bypass global disabled Facebook Page setting',()=>{
 const s=load();
 assert.throws(()=>s.spSend_(event(),job({Channel:'facebook_page'})),/disabled|FACEBOOK_ENABLED/);
});
