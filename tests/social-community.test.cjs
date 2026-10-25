'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function load(extra={}){
 const c={Date,Error,JSON,String,Number,RegExp,Object,Array,Math,encodeURIComponent,
  TELEGRAM_BOT_TOKEN:'',FACEBOOK_ENABLED:false,FACEBOOK_GRAPH_VERSION:'v26.0',
  formatDateForPost:v=>String(v),escapeHtml:s=>String(s),...extra};
 vm.createContext(c);
 const root=path.resolve(__dirname,'..');
 for(const f of ['SocialPublisher.gs','SocialPublisherAdapters.gs','SocialPublisherCommunity.gs']){
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
 }
 return c;
}
function job(s,key='BRNOWALKERS',overrides={}){
 return {row:2,Event_ID:s.SP_COMMUNITY_IDS[key],
  Channel:'telegram',Status:'APPROVED',Scheduled_At:new Date(0),
  Caption:s.spCommunityCaption_(key,'telegram'),
  Duplicate_Checked:'YES',Entity:'Owner: informational community',
  Grant_Funded:'NO',Grant_Text:'',Rights_OK:'',Media_URL:'',
  Video_Drive_ID:'',Visibility:'private',Made_For_Kids:'',
  ...overrides};
}
test('staged community source resolves without pretending to be an Events booking',()=>{
 const s=load();
 for(const k of ['BRNOWALKERS','DRUZINA']){
  const j=job(s,k),e=s.spSource_(j);
  assert.equal(e.Status,'Active');
  assert.equal(e.Category,'Community Info');
  assert.equal(e.row,0);
  assert.equal(e.Price_CZK,'');
  assert.equal(s.spValidate_(e,j),true);
 }
 assert.throws(()=>s.spSource_({Event_ID:'COMMUNITY:UNAPPROVED'}),/Unknown community/);
});
test('evergreen community copy has four languages, exact brand and a single CTA',()=>{
 const s=load();
 for(const brand of ['BRNOWALKERS','DRUZINA']){
  for(const lang of ['cs','en','ru','uk']){
   const caption=s.spCommunityCopy_(brand,lang,'telegram');
   assert.match(caption,/https:\/\//);
   assert.equal((caption.match(/https:\/\//g)||[]).length,1);
   assert.ok(caption.includes(brand==='DRUZINA'?'Družina Moravy':'BrnoWalkers'));
  }
  for(const ch of s.SP_COMMUNITY_TARGETS){
   const caption=s.spCommunityCaption_(brand,ch);
   assert.equal((caption.match(/https:\/\//g)||[]).length,1);
  }
 }
 assert.match(s.spCommunityCaption_('DRUZINA','telegram'),/нет/);
 assert.match(s.spCommunityCaption_('BRNOWALKERS','whatsapp'),/find hiking buddies/);
});
test('community promotion rejects unverified events/prices/venues and unrelated grants',()=>{
 const s=load(),j=job(s),e=s.spSource_(j);
 for(const caption of [j.Caption+'\nDukelská 157/44',
  j.Caption+'\nThursday 18:00',j.Caption+'\n500 Kč',j.Caption+'\n14.11.2026']){
  assert.throws(()=>s.spValidate_(e,{...j,Caption:caption}),/Stale|event date|price/);
 }
 assert.throws(()=>s.spValidate_(e,{...j,Grant_Funded:'YES',Grant_Text:'claim'}),
  /cannot claim a grant/);
 assert.throws(()=>s.spValidate_(e,{...j,Duplicate_Checked:''}),/Check live destinations/);
 assert.throws(()=>s.spValidate_(e,{...j,Channel:'whatsapp_group'}),/Invalid channel/);
});
test('prepare is idempotent per community and creates drafts only, with zero sends',()=>{
 const s=load({Utilities:{getUuid:(()=>{let i=0;return()=>('id-'+(++i));})()}});
 const stored=[],sheet={appendRow(row){stored.push(row);}};
 s.spJobs_=()=>sheet;
 s.spItems_=()=>stored.map((a)=>{
  const o={};s.SP_COLS.forEach((col,i)=>o[col]=a[i]);return o;
 });
 assert.equal(s.spCommunityPrepare_('BRNOWALKERS'),7);
 assert.equal(s.spCommunityPrepare_('BRNOWALKERS'),0);
 assert.equal(s.spCommunityPrepare_('DRUZINA'),7);
 assert.equal(stored.length,14);
 for(const a of stored){
  const item={};s.SP_COLS.forEach((col,i)=>item[col]=a[i]);
  assert.equal(item.Status,'DRAFT');
  assert.equal(item.Duplicate_Checked,'');
  assert.equal(item.Rights_OK,'');
  assert.equal(item.Grant_Funded,'NO');
  assert.equal(item.Post_ID,'');
 }
});
test('approved community job is sent once and retains provider receipt in SAME queue',()=>{
 const s=load();
 const j=job(s);
 const fieldToCol={Status:1,Attempted_At:2,Post_ID:3,Post_URL:4,Error:5};
 const colToField=Object.fromEntries(Object.entries(fieldToCol).map(([k,v])=>[v,k]));
 const sheet={getRange(row,col){assert.equal(row,2);return{setValue(v){j[colToField[col]]=v;}}}};
 s.spJobs_=()=>sheet;s.spMap_=()=>fieldToCol;s.spItems_=()=>[j];
 s.LockService={getDocumentLock:()=>({tryLock:()=>true,releaseLock(){}})};
 s.SpreadsheetApp={flush(){}};
 let sent=0;
 s.spSend_=()=>{sent++;return{id:'44',url:'https://t.me/example/44'};};
 s.spRunDue();
 assert.equal(j.Status,'PUBLISHED');assert.equal(j.Post_ID,'44');assert.equal(sent,1);
 s.spRunDue();assert.equal(sent,1);
});
test('Instagram never sends Družina or BrnoWalkers to legacy personal account',()=>{
 const values={SOCIAL_INSTAGRAM_ENABLED:'true',SOCIAL_IG_USER_ID:'personal',
  SOCIAL_IG_ACCESS_TOKEN:'personal-token'};
 const s=load({PropertiesService:{getScriptProperties:()=>({getProperty:(k)=>values[k]||''})}});
 const j=job(s,'DRUZINA',{Channel:'instagram',Media_URL:'https://example.org/photo.jpg',Rights_OK:'YES'});
 assert.throws(()=>s.spInstagram_(s.spSource_(j),j),/Brand-specific Instagram credentials missing/);
 values.SOCIAL_IG_USER_ID_DRUZINA='123';values.SOCIAL_IG_ACCESS_TOKEN_DRUZINA='club-token';
 const paths=[];s.spMeta_=(p,body,tok)=>{
  paths.push([p,tok]);
  if(p.endsWith('/media'))return{id:'container-1'};
  if(p.endsWith('/media_publish'))return{id:'post-1'};
  return{permalink:'https://www.instagram.com/p/real/'};
 };
 const out=s.spInstagram_(s.spSource_(j),j);
 assert.equal(out.id,'post-1');assert.equal(paths.length,3);
 assert.equal(paths[0][1],'club-token');
 assert.match(paths[0][0],/^123\/media$/);
});
