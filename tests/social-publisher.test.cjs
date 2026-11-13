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
 return {Duplicate_Checked:'YES',Channel:'telegram',Entity:'Družina Moravy z.s.',Grant_Funded:'NO',
  Grant_Text:'',Caption:'Only verified contents',Rights_OK:'',
  Visibility:'private',Made_For_Kids:'NO',...overrides};
}
test('all public channels require reviewed legal entity and grant decision',()=>{
 const s=load();
 assert.equal(s.spValidate_(event(),job()),true);
 assert.throws(()=>s.spValidate_(event(),job({Entity:''})),/legal entity/);
 assert.throws(()=>s.spValidate_(event(),job({Duplicate_Checked:''})),/Duplicate_Checked/);
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
 s.spReleaseGate_=()=>true; // synthetic adapter-only test; separate owner release tests below
 const tg=s.spSend_(event({Telegram_Post_ID:'14'}),job());
 assert.equal(tg.existing,true);assert.match(tg.url,/example_channel\/14/);
 const fb=s.spSend_(event({Facebook_Post_ID:'12_34'}),job({Channel:'facebook_page'}));
 assert.equal(fb.existing,true);
});
test('does not bypass global disabled Facebook Page setting',()=>{
 const s=load();s.spReleaseGate_=()=>true;
 assert.throws(()=>s.spSend_(event(),job({Channel:'facebook_page'})),/disabled|FACEBOOK_ENABLED/);
});

test('YouTube upload cannot cross OAuth legal entity or proceed without owner channel proof',()=>{
 const s=load();
 const personal='UC'+'P'.repeat(22),club='UC'+'C'.repeat(22);
 const props={SOCIAL_YOUTUBE_ENABLED:'true',SOCIAL_YOUTUBE_CHANNEL_ID_DRUZINA:club,
   SOCIAL_YOUTUBE_CHANNEL_ID_BRNOWALKERS:personal};
 s.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||''})};
 s.ScriptApp={getOAuthToken:()=> 'synthetic-oauth-token'};
 let providerId=personal,code=200,fetches=0,driveReads=0;
 s.UrlFetchApp={fetch:(url,opts)=>{
   fetches++;assert.equal(url,'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true');
   assert.equal(opts.method,'get');assert.equal(opts.headers.Authorization,'Bearer synthetic-oauth-token');
   return {getResponseCode:()=>code,getContentText:()=>JSON.stringify({items:[{id:providerId}]})};
 }};
 s.DriveApp={getFileById:()=>{driveReads++;throw Error('TEST_NO_FILE_OR_UPLOAD');}};
 const e=event({Community:'Družina Moravy'});
 const j=job({Channel:'youtube',Video_Drive_ID:'syntheticDriveId_111',Rights_OK:'YES',
   Made_For_Kids:'NO',Visibility:'private'});
 assert.throws(()=>s.spYoutube_(e,j),/YouTube OAuth channel identity mismatch/);
 assert.equal(driveReads,0);
 providerId=club;
 assert.throws(()=>s.spYoutube_(e,j),/TEST_NO_FILE_OR_UPLOAD/);
 assert.equal(driveReads,1);
 delete props.SOCIAL_YOUTUBE_CHANNEL_ID_DRUZINA;
 assert.throws(()=>s.spYoutube_(e,j),/Expected brand-specific YouTube channel ID/);
 assert.equal(driveReads,1);
 props.SOCIAL_YOUTUBE_CHANNEL_ID_DRUZINA=club;
 code=403;
 assert.throws(()=>s.spYoutube_(e,j),/OAuth readback unavailable/);
 assert.equal(driveReads,1);
 assert.equal(fetches,3);
});

test('owner-private release is mandatory, not a SocialPublishing APPROVED flag',()=>{
 const s=load(),e=event(),j=job({Job_ID:'J-PRIVATE-001',Status:'APPROVED',Approved_At:new Date()});
 assert.throws(()=>s.spReleaseGate_(e,j),/OWNER_RELEASE_NOT_CONFIGURED/);
 let sends=0;s.spSend_=()=>{sends++;return{id:'unsafe'};};
 j.row=2;j.Scheduled_At=new Date(0);
 const cols={Status:1,Attempted_At:2,Post_ID:3,Post_URL:4,Error:5};
 const rev=Object.fromEntries(Object.entries(cols).map(([k,v])=>[v,k]));
 s.spJobs_=()=>({getRange(row,col){return{setValue(v){j[rev[col]]=v}}}});
 s.spMap_=()=>cols;s.spItems_=()=>[j];
 s.LockService={getDocumentLock:()=>({tryLock:()=>true,releaseLock(){}})};
 s.SpreadsheetApp={flush(){}};
 s.spSource_=()=>e;
 s.spRunDue();
 assert.equal(sends,0);
 assert.equal(j.Status,'REVIEW_REQUIRED');
 assert.match(j.Error,/OWNER_RELEASE_NOT_CONFIGURED/);
});
test('scoped release requires independently configured account, timely quota and no unsafe capacity',()=>{
 const s=load();
 const e=event({Community:'Družina Moravy',Category:'HEMA Training'});
 const t=new Date(),past=new Date(t.getTime()-3600000).toISOString(),future=new Date(t.getTime()+86400000).toISOString();
 const j=job({Job_ID:'J-CLUB-001',Entity:'Družina Moravy z.s.',Status:'APPROVED',Approved_At:t,Channel:'telegram'});
 const approval={state:'ACTIVE',owner_verified:true,approval_ref:'GO-SYNTHETIC-20261113',
  job_id:j.Job_ID,channel:j.Channel,entity:j.Entity,account_id:'club-channel-123',
  valid_from:past,valid_until:future,provider_quota_verified:true,
  provider_posts_last_24h:0,max_posts_per_24h:1,quota_readback_at:t.toISOString(),
  recent_posts_reconciled:true,cta_verified:true,legal_and_grant_terms_verified:true,
  opt_out_checked:true,safety_verified:true,safe_capacity:30,confirmed_persons:20,
  promised_places:10,pending_requests:0};
 const settings={SOCIAL_PUBLISHER_ENABLED:'true',SOCIAL_PUBLISHER_KILL_SWITCH:'false',
  SOCIAL_ACCOUNT_ID_Dru_ina_Moravy_z_s__telegram:'club-channel-123',
  ['SOCIAL_GO_'+j.Job_ID]:JSON.stringify(approval)};
 s.PropertiesService={getScriptProperties:()=>({getProperty:k=>settings[k]||''})};
 assert.throws(()=>s.spReleaseGate_(e,j),/SAFETY_CAPACITY/);
 approval.promised_places=2;
 settings['SOCIAL_GO_'+j.Job_ID]=JSON.stringify(approval);
 assert.equal(s.spReleaseGate_(e,j),true);
 approval.account_id='different-channel';
 settings['SOCIAL_GO_'+j.Job_ID]=JSON.stringify(approval);
 assert.throws(()=>s.spReleaseGate_(e,j),/OWNER_ACCOUNT_ID/);
 approval.account_id='club-channel-123';approval.provider_quota_verified=false;
 settings['SOCIAL_GO_'+j.Job_ID]=JSON.stringify(approval);
 assert.throws(()=>s.spReleaseGate_(e,j),/PROVIDER_QUOTA/);
});

test('owner installer includes SocialPublisher only as dry-run-safe source',()=>{
 const content=fs.readFileSync(path.join(root,'ops','install-imperion-agent-owner.ps1'),'utf8');
 for(const name of ['ImperionAgentSnapshot','ImperionClosedLoopAudit','ImperionAgentRuntime',
    'SocialPublisher','SocialPublisherAdapters','SocialPublisherCommunity','SocialPublisherManual'])
   assert.ok(content.includes("'"+name+"'"),'Installer missing '+name);
 assert.match(content,/\[switch\]\$Apply/);
 assert.match(content,/if\(-not \$Apply\)/);
 assert.match(content,/DRY_RUN_DONE/);
 assert.match(content,/SOURCE_INSTALLED_READBACK_VERIFIED/);
 assert.doesNotMatch(content,/newTrigger\(/);
});
