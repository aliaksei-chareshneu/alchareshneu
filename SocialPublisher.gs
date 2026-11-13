/* IMPERION Social Publisher — staging only. Existing Community Hub is the source.
 * No posting without explicit owner APPROVAL in SocialPublishing tab.
 * Requires existing Code.gs globals; install trigger only after owner review. */
var SP_TAB='SocialPublishing';
var SP_COLS=['Duplicate_Checked','Job_ID','Event_ID','Channel','Scheduled_At','Status','Caption','Media_URL',
 'Video_Drive_ID','Post_ID','Post_URL','Attempted_At','Error','Entity',
 'Grant_Funded','Grant_Text','Rights_OK','Approved_At','Visibility','Made_For_Kids'];
var SP_AUTO=['telegram','facebook_page','instagram','youtube'];
var SP_MANUAL=['facebook_profile','whatsapp','tiktok'];
var SP_GRANT='Podpořeno z programu Mládež kraji – Jihomoravský kraj, který realizuje Rada dětí a mládeže Jihomoravského kraje za finanční podpory Jihomoravského kraje, města Brna a Ministerstva školství, mládeže a tělovýchovy.';

function spJobs_(){
 var ss=SpreadsheetApp.openById(SPREADSHEET_ID),s=ss.getSheetByName(SP_TAB);
 if(!s){s=ss.insertSheet(SP_TAB);s.getRange(1,1,1,SP_COLS.length).setValues([SP_COLS]);s.setFrozenRows(1);}
 return s;
}
function spMap_(s){
 var map={},a=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
 a.forEach(function(v,i){map[v]=i+1;});
 SP_COLS.forEach(function(v){if(!map[v])throw Error('Missing SocialPublishing column '+v);});
 return map;
}
function spItems_(s){
 var m=spMap_(s), n=s.getLastRow();if(n<2)return [];
 return s.getRange(2,1,n-1,s.getLastColumn()).getValues().map(function(v,i){
  var o={row:i+2}; SP_COLS.forEach(function(k){o[k]=v[m[k]-1];});return o;
 });
}
function spEvent_(id){
 var s=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
 var m=getHeaderMap(s),a=s.getDataRange().getValues();
 for(var i=1;i<a.length;i++)if(String(a[i][m.Event_ID-1])===String(id)){
  var out={row:i+1};Object.keys(m).forEach(function(k){out[k]=a[i][m[k]-1];});return out;
 }
 throw Error('Not in Events: '+id);
}
function spCaption_(e,j){
 var dt=typeof formatDateForPost==='function'?formatDateForPost(e.Start_DateTime):String(e.Start_DateTime);
 var price=Number(e.Price_CZK),cost=isNaN(price)?'Price to confirm':price===0?'FREE / ZDARMA':price+' Kč';
 var link=/^https:\/\//.test(String(e.Tally_Form_URL||''))?e.Tally_Form_URL:'https://t.me/Chareshneu';
 var text=[String(e.Title||''),'',String(e.Description||''),'📅 '+dt,
  '📍 '+String(e.Location_Address||e.Location_Name||''),'🎟 '+cost,'👉 RSVP: '+link];
 if(String(j.Grant_Funded).toUpperCase()==='YES')text.push('',String(j.Grant_Text||''));
 return text.join('\n').trim();
}
function spManual_(ch){return SP_MANUAL.indexOf(ch)>=0;}
function spValidate_(e,j){
 if(SP_AUTO.indexOf(j.Channel)<0&&!spManual_(j.Channel))throw Error('Invalid channel');
 if(e.Status!=='Active'||e.Category==='Corporate')throw Error('Not an active public event');
 if(!String(j.Entity||'').trim())throw Error('Select responsible legal entity');
 if(['YES','NO'].indexOf(String(j.Grant_Funded).toUpperCase())<0)throw Error('Set Grant_Funded YES/NO');
 if(String(j.Grant_Funded).toUpperCase()==='YES'&&!String(j.Grant_Text||'').trim())throw Error('Missing grant attribution');
 if(e.Category==='Community Info')spCommunityPreflight_(e,j);
 if(e.Category==='ShortFactory Media')spShortFactoryPreflight_(e,j);
 if(!String(j.Caption||'').trim())throw Error('Empty caption');
 if(String(j.Duplicate_Checked).toUpperCase()!=='YES')throw Error('Check live destinations for an existing identical post first; set Duplicate_Checked YES');
 if(j.Channel==='instagram'&& !/^https:\/\/\S+$/i.test(String(j.Media_URL||'')))
  throw Error('Instagram requires public HTTPS image URL');
 if(['instagram','youtube','tiktok'].indexOf(j.Channel)>=0 && String(j.Rights_OK).toUpperCase()!=='YES')
  throw Error('Media/participant rights not confirmed');
 if(['youtube','tiktok'].indexOf(j.Channel)>=0&&!j.Video_Drive_ID)throw Error('Video_Drive_ID missing');
 if(j.Channel==='youtube'&&
  (['private','unlisted','public'].indexOf(j.Visibility)<0 ||
   ['YES','NO'].indexOf(String(j.Made_For_Kids).toUpperCase())<0))
  throw Error('Set YouTube visibility and Made_For_Kids YES/NO');
 return true;
}

/* PRIVATE per-job release: a worksheet APPROVED cell is not publication consent.
 * Key/approval must be installed by the account owner in Script Properties.
 * No per-job scope, quota readback or current media rights => no provider call.
 */
function spReleaseGate_(e,j){
 var props;
 try{props=PropertiesService.getScriptProperties();}
 catch(_){throw Error('OWNER_RELEASE_NOT_CONFIGURED');}
 if(!props||props.getProperty('SOCIAL_PUBLISHER_ENABLED')!=='true'||
   props.getProperty('SOCIAL_PUBLISHER_KILL_SWITCH')!=='false')
   throw Error('OWNER_RELEASE_DISABLED');
 var jobId=String(j.Job_ID||'');
 if(!/^[A-Za-z0-9][A-Za-z0-9_:.~-]{2,130}$/.test(jobId))
   throw Error('INVALID_RELEASE_JOB_ID');
 var raw=props.getProperty('SOCIAL_GO_'+jobId),g;
 try{g=JSON.parse(raw||'null');}catch(_){throw Error('SCOPED_OWNER_GO_INVALID');}
 if(!g||g.state!=='ACTIVE'||g.owner_verified!==true||
    !/^GO-[A-Za-z0-9_-]{8,80}$/.test(String(g.approval_ref||''))||
    g.job_id!==jobId||g.channel!==j.Channel||g.entity!==j.Entity||
    !/^[A-Za-z0-9_:-]{3,100}$/.test(String(g.account_id||'')))
   throw Error('NO_EXACT_SCOPED_OWNER_GO');
 var now=Date.now(),start=Date.parse(g.valid_from),end=Date.parse(g.valid_until);
 if(!isFinite(start)||!isFinite(end)||end<=start||end-start>31*86400000||
    now<start||now>end)throw Error('SCOPED_OWNER_GO_EXPIRED');
 var approved=j.Approved_At instanceof Date?j.Approved_At.getTime():
    Date.parse(String(j.Approved_At||''));
 if(!isFinite(approved)||approved>now||approved<start||approved>now+300000)
   throw Error('APPROVED_AT_OUTSIDE_SCOPED_GO');
 var entity=e.Community==='Družina Moravy'?'Družina Moravy z.s.':
   e.Community==='Brnowalkers'?
     (e.Category==='Community Info'?'BrnoWalkers — informational community (no sale)':'Aliaksei Chareshneu OSVČ'):
   e.Community==='OSVC'?'OSVC':null;
 if(entity===null||String(j.Entity)!==entity)throw Error('LEGAL_ENTITY_SOURCE_MISMATCH');
 if(props.getProperty('SOCIAL_ACCOUNT_ID_'+String(g.entity).replace(/[^A-Za-z0-9_]/g,'_')+
   '_'+j.Channel)!==g.account_id)throw Error('OWNER_ACCOUNT_ID_NOT_VERIFIED');
 if(g.provider_quota_verified!==true||
    !Number.isSafeInteger(g.provider_posts_last_24h)||g.provider_posts_last_24h<0||
    !Number.isSafeInteger(g.max_posts_per_24h)||g.max_posts_per_24h<1||
    g.max_posts_per_24h>10||g.provider_posts_last_24h>=g.max_posts_per_24h||
    !isFinite(Date.parse(g.quota_readback_at))||
    now-Date.parse(g.quota_readback_at)>3*3600000||
    Date.parse(g.quota_readback_at)>now)
   throw Error('PROVIDER_QUOTA_OR_READBACK_UNVERIFIED');
 if(g.recent_posts_reconciled!==true||g.cta_verified!==true||
    g.legal_and_grant_terms_verified!==true||g.opt_out_checked!==true)
   throw Error('PUBLISH_FACTS_OR_DEDUP_UNVERIFIED');
 if(j.Channel==='facebook_page' &&
    (g.facebook_same_destination_posts_72h!==0||g.facebook_rules_verified!==true))
   throw Error('FACEBOOK_72H_OR_RULES_UNKNOWN');
 if(j.Media_URL||j.Video_Drive_ID){
   if(String(j.Rights_OK).toUpperCase()!=='YES'||
      g.media_rights_verified!==true||
      g.media_binding!==String(j.Video_Drive_ID||j.Media_URL))
     throw Error('MEDIA_RIGHTS_OR_SOURCE_NOT_VERIFIED');
 }
 if(e.Community==='Družina Moravy' &&
    e.Category!=='Community Info'&&e.Category!=='ShortFactory Media'){
   var n=['safe_capacity','confirmed_persons','promised_places','pending_requests'];
   if(g.safety_verified!==true||!n.every(function(k){
       return Number.isSafeInteger(g[k])&&g[k]>=0;
     })||g.safe_capacity<1||
     g.confirmed_persons+g.promised_places+g.pending_requests>=g.safe_capacity||
     g.pending_requests!==0)
     throw Error('SAFETY_CAPACITY_UNVERIFIED_OR_FULL');
 }
 return true;
}

/* Select Events row, add DRAFT rows, never publish. */
function spPrepareSelectedEvent(){
 var s=SpreadsheetApp.getActiveSheet(),row=s.getActiveCell().getRow();
 if(s.getName()!==EVENTS_SHEET_NAME||row<2)throw Error('Select an Events row');
 var id=s.getRange(row,getHeaderMap(s).Event_ID).getValue(),e=spEvent_(id);
 if(e.Status!=='Active'||e.Category==='Corporate')throw Error('Only Active public events');
 var dest=['telegram','facebook_page','instagram','facebook_profile','whatsapp'];
 dest.push('youtube','tiktok'); // video jobs remain DRAFT until Video_Drive_ID, rights and metadata are supplied
 var sheet=spJobs_(),seen=spItems_(sheet).map(function(x){return x.Event_ID+':'+x.Channel;}),n=0;
 dest.forEach(function(ch){
  if(seen.indexOf(id+':'+ch)>=0)return;
  if(ch==='telegram'&&e.Telegram_Post_ID)return;
  if(ch==='facebook_page'&&e.Facebook_Post_ID)return;
  var file=String(e.Image_Filename||'');
  var image=/^[A-Za-z0-9_.-]+\.(jpg|jpeg|png)$/i.test(file)?
    'https://aliaksei-chareshneu.github.io/alchareshneu/images/'+encodeURIComponent(file):'';
  var grant=/morava v pohybu|mládež kraji/i.test(String(e.Description||'')+' '+String(e.Title||''))?'YES':'';
  var entity=e.Community==='Družina Moravy'?'Družina Moravy z.s.':'';
  var j={Duplicate_Checked:'',Job_ID:Utilities.getUuid(),Event_ID:id,Channel:ch,Scheduled_At:new Date(),
   Status:'DRAFT',Caption:'',Media_URL:image,Video_Drive_ID:e.Video_Drive_ID||'',
   Post_ID:'',Post_URL:'',Attempted_At:'',Error:'',Entity:entity,
   Grant_Funded:grant,Grant_Text:grant==='YES'?SP_GRANT:'',Rights_OK:'',
   Approved_At:'',Visibility:'private',Made_For_Kids:''};
  j.Caption=spCaption_(e,j);
  sheet.appendRow(SP_COLS.map(function(k){return j[k];}));n++;
 });
 SpreadsheetApp.getUi().alert('Prepared '+n+' drafts. Review and approve individually in SocialPublishing.');
}
/* Owner-only review, selectable row in SocialPublishing. Manual targets stay manual. */
function spApproveSelectedJob(){
 var s=SpreadsheetApp.getActiveSheet(),r=s.getActiveCell().getRow();
 if(s.getName()!==SP_TAB||r<2)throw Error('Select a SocialPublishing draft');
 var m=spMap_(s),j=spItems_(s).filter(function(x){return x.row===r;})[0];
 if(!j||j.Status!=='DRAFT')throw Error('Only DRAFT can be approved');
 var e=spSource_(j);spValidate_(e,j);
 var ui=SpreadsheetApp.getUi();
 if(ui.alert('Approve '+j.Channel+'?',String(e.Title)+'\n'+String(j.Entity),ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 s.getRange(r,m.Status).setValue(spManual_(j.Channel)?'READY_MANUAL':'APPROVED');
 s.getRange(r,m.Approved_At).setValue(new Date());
 if(spManual_(j.Channel)){
  var link=j.Channel==='whatsapp'?'https://api.whatsapp.com/send?text='+encodeURIComponent(j.Caption):
    j.Channel==='facebook_profile'?'https://www.facebook.com/':'https://www.tiktok.com/upload';
  s.getRange(r,m.Post_URL).setValue(link);
 }
}
/* Only APPROVED jobs at/after scheduled time. Before call set CLAIMED (no blind retries). */
function spRunDue(){
 var l=LockService.getDocumentLock()||LockService.getScriptLock();if(!l.tryLock(1000))return;
 try{
  var s=spJobs_(),m=spMap_(s);
  var jobs=spItems_(s).filter(function(j){
   if(j.Status!=='APPROVED'||SP_AUTO.indexOf(j.Channel)<0)return false;
   var v=j.Scheduled_At instanceof Date?j.Scheduled_At.getTime():new Date(String(j.Scheduled_At)).getTime();
   return !isNaN(v)&&v<=Date.now();
  }).slice(0,6);
  jobs.forEach(function(j){
   try{
    var e=spSource_(j);spValidate_(e,j);
    spReleaseGate_(e,j); // always verify owner-private scope BEFORE claiming a send
    s.getRange(j.row,m.Status).setValue('CLAIMED');
    s.getRange(j.row,m.Attempted_At).setValue(new Date());SpreadsheetApp.flush();
    var result=spSend_(e,j);
    // Provider acceptance is NOT independent public-post verification.
    // A historical stored ID also needs independent provider readback.
    var id=result&&result.id!=null?String(result.id).trim():'';
    var url=result&&typeof result.url==='string'&&/^https:\/\//i.test(result.url)?result.url:'';
    var state=result&&result.existing?'HISTORICAL_RECEIPT_NEEDS_READBACK':
      id?'PUBLISHED_PROVIDER_CONFIRMED':'DELIVERY_UNVERIFIED';
    s.getRange(j.row,m.Post_ID).setValue(id);
    s.getRange(j.row,m.Post_URL).setValue(url);
    s.getRange(j.row,m.Status).setValue(state);
    s.getRange(j.row,m.Error).setValue(state==='DELIVERY_UNVERIFIED'?
      'Provider receipt ID missing; reconcile provider before any retry.':'');
   }catch(err){
    s.getRange(j.row,m.Status).setValue('REVIEW_REQUIRED');
    s.getRange(j.row,m.Error).setValue(String(err.message||err).slice(0,990));
   }
  });
 }finally{l.releaseLock();}
}
function spInstallTrigger(){
 var ui=SpreadsheetApp.getUi();
 if(ui.alert('Enable publisher every 15 minutes?','Only APPROVED jobs will be processed.',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 var found=ScriptApp.getProjectTriggers().some(function(x){return x.getHandlerFunction()==='spRunDue';});
 if(!found)ScriptApp.newTrigger('spRunDue').timeBased().everyMinutes(15).create();
 ui.alert(found?'Publisher timer already exists':'Publisher timer installed');
}


/* Independent installable onOpen menu; leaves existing Community Hub onOpen unchanged. */
function spSocialOnOpen() {
 SpreadsheetApp.getUi().createMenu('Social Publisher')
  .addItem('1. Prepare drafts from Events row','spPrepareSelectedEvent')
  .addItem('1a. Prepare BrnoWalkers evergreen community','spPrepareBrnoWalkersCommunity')
  .addItem('1b. Prepare Družina evergreen community','spPrepareDruzinaCommunity')
  .addItem('2. Approve selected SocialPublishing row','spApproveSelectedJob')
  .addItem('3. Open manual share panel','spOpenManualSelected')
  .addItem('4. Confirm manual publication','spConfirmManualSelected')
  .addItem('5. Publish approved and due now','spRunDue')
  .addItem('6. Install 15-minute publisher timer','spInstallTrigger')
  .addToUi();
}
function spInstallMenu() {
 var ui=SpreadsheetApp.getUi();
 var exists=ScriptApp.getProjectTriggers().some(function(t){
  return t.getHandlerFunction()==='spSocialOnOpen';
 });
 if(!exists)ScriptApp.newTrigger('spSocialOnOpen').forSpreadsheet(SPREADSHEET_ID).onOpen().create();
 spSocialOnOpen();
 ui.alert(exists?'Social Publisher menu already installed':'Social Publisher menu installed. Reload the sheet.');
}
