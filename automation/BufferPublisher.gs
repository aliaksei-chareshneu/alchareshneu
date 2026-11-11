/*
 * Project80 SocialPublishing -> Buffer Free via owner-managed Apps Script.
 * No additional Google service account, no parallel queue, no Metricool retry.
 * Inert unless P80_BUFFER_ENABLED="true", API key and channel mapping exist,
 * and each canonical row explicitly says BUFFER_APPROVED with all gates.
 * This module must never be invoked from an anonymous web app endpoint.
 */
var P80_BUFFER_HUB_ID=(typeof PROMO_AUDIT_HUB_ID!=='undefined'?PROMO_AUDIT_HUB_ID:'');
var P80_BUFFER_HEADERS=[
  'Duplicate_Checked','Job_ID','Event_ID','Channel','Scheduled_At','Status',
  'Caption','Media_URL','Video_Drive_ID','Post_ID','Post_URL','Attempted_At',
  'Error','Entity','Grant_Funded','Grant_Text','Rights_OK','Approved_At',
  'Visibility','Made_For_Kids'
];
var P80_BUFFER_TERMINAL={
  'SCHEDULED_PENDING':true,'PUBLISHED_VERIFIED':true,'BUFFER_QUEUED':true,
  'BUFFER_SUBMITTING':true,'DELIVERY_IN_PROGRESS':true,'DELIVERY_UNVERIFIED':true,
  'ERROR_LIMIT':true
};
function p80BufferParseTime_(value) {
  var text=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) return NaN;
  try {
    var date=Utilities.parseDate(text,'Europe/Prague','yyyy-MM-dd HH:mm');
    if(Utilities.formatDate(date,'Europe/Prague','yyyy-MM-dd HH:mm')!==text)
      return NaN;
    var month=Number(text.slice(5,7)),day=Number(text.slice(8,10)),hour=Number(text.slice(11,13));
    if(hour===2 && (month===3||month===10)) {
      var year=Number(text.slice(0,4)), last=new Date(Date.UTC(year,month,0));
      var lastSunday=last.getUTCDate()-last.getUTCDay();
      if(day===lastSunday) return NaN;  // ambiguous/nonexistent wall-clock hour
    }
    return date.getTime();
  } catch(error) {return NaN;}
}
function p80BufferTable_(sheet,required,maxRows) {
  if(!sheet)throw Error('MISSING_SOURCE_TAB');
  var total=sheet.getLastRow();
  if(total>maxRows)throw Error('BOUNDED_READ_LIMIT');
  if(total<1)throw Error('NO_HEADERS');
  var width=sheet.getLastColumn();
  var values=sheet.getRange(1,1,total,width).getDisplayValues();
  var header=values.shift(), col={};
  header.forEach(function(s,i){col[s]=i;});
  required.forEach(function(s){if(col[s]===undefined)throw Error('SCHEMA_'+s);});
  var rows=values.map(function(row,i){
    var obj={_row:i+2};
    header.forEach(function(s,j){if(s)obj[s]=row[j]||'';});
    return obj;
  });
  return {sheet:sheet,header:header,col:col,rows:rows};
}
function p80BufferRead_() {
  var ss=SpreadsheetApp.openById(P80_BUFFER_HUB_ID);
  var posts=p80BufferTable_(ss.getSheetByName('SocialPublishing'),P80_BUFFER_HEADERS,250);
  if(JSON.stringify(posts.header.slice(0,20))!==JSON.stringify(P80_BUFFER_HEADERS))
    throw Error('SOCIAL_SCHEMA_CHANGED');
  var events=p80BufferTable_(ss.getSheetByName('Events'),
    ['Event_ID','Status','Start_DateTime','Price_CZK'],1000);
  var byId={};
  events.rows.forEach(function(e){if(e.Event_ID)byId[e.Event_ID]=e;});
  return {ss:ss,posts:posts,events:byId};
}
function p80BufferMap_(properties) {
  var s=properties.getProperty('P80_BUFFER_CHANNELS_JSON')||'{}';
  var map=JSON.parse(s);
  if(!map||typeof map!=='object'||Array.isArray(map))throw Error('CHANNEL_MAP_INVALID');
  return map;
}
function p80BufferGuard_(post,others,events,map,atMs) {
  var failures=[],a=function(code){failures.push(code);};
  if(String(post.Status)!=='BUFFER_APPROVED')a('NOT_APPROVED');
  if(String(post.Duplicate_Checked).toUpperCase()!=='YES')a('DEDUP_NOT_APPROVED');
  if(String(post.Rights_OK).toUpperCase()!=='YES')a('RIGHTS_NOT_APPROVED');
  if(!String(post.Approved_At||'').trim())a('OWNER_APPROVAL_MISSING');
  if(String(post.Visibility).toLowerCase()!=='public')a('NON_PUBLIC');
  if(String(post.Made_For_Kids).toUpperCase()!=='NO')a('KIDS_UNCLASSIFIED');
  if(String(post.Post_ID||'').trim()||String(post.Post_URL||'').trim())a('HAS_PROVIDER_PROOF');
  if(String(post.Attempted_At||'').trim())a('ALREADY_ATTEMPTED');
  if(!String(post.Job_ID||'').trim()||!String(post.Event_ID||'').trim())a('MISSING_ID');
  if(!String(post.Caption||'').trim())a('EMPTY_CAPTION');
  if(String(post.Caption||'').length>2000)a('CAPTION_TOO_LONG');
  if(String(post.Video_Drive_ID||'').trim())a('VIDEO_UNSUPPORTED');
  var key=String(post.Channel||'')+'|'+String(post.Entity||'');
  var target=map[key];
  if(!target||typeof target!=='object'||!target.id||
     !/^[A-Za-z0-9_:=\-]{2,160}$/.test(String(target.id)))a('TARGET_NOT_MAPPED');
  if(['facebook_page','instagram'].indexOf(String(post.Channel))<0)a('UNSUPPORTED_CHANNEL');
  if(target && String(target.service||'')!==(post.Channel==='instagram'?'instagram':'facebook'))
    a('TARGET_PLATFORM_MISMATCH');
  if(target && String(target.entity)!==String(post.Entity))a('ENTITY_MISMATCH');
  var image=String(post.Media_URL||'').trim();
  if(image && (!/^https:\/\/[^\s?#]+(?:\?[^\s#]*)?$/i.test(image) ||
    !/\.(jpe?g|png|webp)(?:\?|$)/i.test(image)))a('IMAGE_URL_INVALID');
  if(String(post.Channel)==='instagram' && !image)a('INSTAGRAM_NEEDS_IMAGE');
  if(String(post.Channel)==='instagram' && image && !/\.jpe?g(?:\?|$)/i.test(image))
    a('INSTAGRAM_REQUIRES_JPEG');
  if(String(post.Grant_Funded||'').toUpperCase()==='YES') {
    var credit=String(post.Grant_Text||'').trim();
    if(!credit||!/^Podpořeno z programu/.test(credit) ||
       String(post.Caption).indexOf(credit)<0)a('GRANT_CREDIT_MISSING');
  }
  var when=p80BufferParseTime_(post.Scheduled_At);
  if(!isFinite(when)||when<=atMs+10*60000||when>=atMs+30*86400000)
    a('TIME_NOT_IN_SAFE_WINDOW');
  var evt=events[String(post.Event_ID||'')];
  if(evt){
    if(String(evt.Status)!=='Active')a('SOURCE_INACTIVE');
    var cost=Number(String(evt.Price_CZK||'0').replace(',','.'));
    if(!isFinite(cost)||cost>0)a('PAID_ACTIVITY_REQUIRES_SEPARATE_REVIEW');
    var start=p80BufferParseTime_(evt.Start_DateTime);
    if(!isFinite(start)||start<=atMs)a('SOURCE_EVENT_PASSED');
  } else if(!/^CAMPAIGN-[A-Z0-9-]{4,80}$/.test(String(post.Event_ID||''))) {
    a('MISSING_SOURCE_EVENT');
  }
  var j=String(post.Job_ID||''),eventId=String(post.Event_ID||'');
  var channel=String(post.Channel||''),entity=String(post.Entity||'');
  if((others||[]).some(function(other){
    if(other===post || String(other.Job_ID)===j)return false;
    if(other.Channel!==channel||other.Entity!==entity)return false;
    if(!P80_BUFFER_TERMINAL[String(other.Status||'')])return false;
    return String(other.Event_ID)===eventId ||
      (String(other.Caption||'').trim()!=='' &&
       String(other.Caption).trim()===String(post.Caption||'').trim());
  }))a('PRIOR_OR_PENDING_PROVIDER_DELIVERY');
  return {allowed:failures.length===0,reasons:failures,
    key:key,channelId:target?String(target.id):'',dueAt:when};
}
function p80BufferGraphql_(post,decision) {
  var date=new Date(decision.dueAt).toISOString(),text=JSON.stringify(String(post.Caption));
  var q='mutation CreatePost { createPost(input: {text: '+text+
    ', channelId: '+JSON.stringify(decision.channelId)+
    ', schedulingType: automatic, mode: customScheduled, dueAt: '+JSON.stringify(date);
  if(post.Media_URL)q+=', assets: [{image: {url: '+JSON.stringify(String(post.Media_URL).trim())+'}}]';
  return q+'}) { ... on PostActionSuccess { post { id text dueAt } } '+
    '... on MutationError { message } } }';
}
function p80BufferPost_(key,query){
  var r=UrlFetchApp.fetch('https://api.buffer.com',{
    method:'post',contentType:'application/json',
    headers:{Authorization:'Bearer '+key},
    payload:JSON.stringify({query:query}),muteHttpExceptions:true
  });
  if(r.getResponseCode()!==200)throw Error('BUFFER_HTTP_UNVERIFIED');
  var o=JSON.parse(r.getContentText()||'{}'),result=o.data&&o.data.createPost;
  var post=result&&result.post;
  if(o.errors||!post||typeof post.id!=='string'||post.id.length<2)
    throw Error('BUFFER_POST_UNVERIFIED');
  return {id:post.id,dueAt:post.dueAt||''};
}
function p80BufferOverview(){
  var p=PropertiesService.getScriptProperties();
  var map={},valid=true;
  try{map=p80BufferMap_(p);}catch(error){valid=false;}
  return {enabled:p.getProperty('P80_BUFFER_ENABLED')==='true',
    tokenConfigured:!!p.getProperty('BUFFER_API_KEY'),
    mapConfigured:valid&&Object.keys(map).length>0,
    mappedRoutes:Object.keys(map),publicPosts:0};
}
function p80BufferPreview(){
  var p=PropertiesService.getScriptProperties(), map=p80BufferMap_(p);
  var s=p80BufferRead_(),time=Date.now();
  var pending=s.posts.rows.filter(function(r){return r.Status==='BUFFER_APPROVED';});
  var checks=pending.slice(0,25).map(function(r){
    var d=p80BufferGuard_(r,s.posts.rows,s.events,map,time);
    return {job:r.Job_ID,allowed:d.allowed,reasons:d.reasons,
      route:d.key,schedule:r.Scheduled_At};
  });
  return {enabled:p.getProperty('P80_BUFFER_ENABLED')==='true',
    candidates:pending.length,allowed:checks.filter(function(r){return r.allowed}).length,
    checks:checks,writes:0};
}
function p80BufferTick(){
  var p=PropertiesService.getScriptProperties();
  if(p.getProperty('P80_BUFFER_ENABLED')!=='true')
    return {enabled:false,queued:0,reason:'DISABLED'};
  var key=p.getProperty('BUFFER_API_KEY')||'';
  if(!key)return {enabled:true,queued:0,reason:'API_KEY_NOT_CONFIGURED'};
  var map=p80BufferMap_(p);
  if(!Object.keys(map).length)return {enabled:true,queued:0,reason:'CHANNELS_NOT_CONFIGURED'};
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return {enabled:true,queued:0,reason:'LOCK_BUSY'};
  try{
    var ss=p80BufferRead_(),now=Date.now();
    var candidates=ss.posts.rows.map(function(row){
      return {row:row,check:p80BufferGuard_(row,ss.posts.rows,ss.events,map,now)};
    }).filter(function(c){return c.check.allowed;});
    candidates.sort(function(a,b){return a.check.dueAt-b.check.dueAt;});
    if(!candidates.length)return {enabled:true,queued:0,reason:'NO_APPROVED_ELIGIBLE_JOBS'};
    var c=candidates[0],row=c.row,sheet=ss.posts.sheet,n=row._row;
    // Re-read and verify exact Job_ID/status while holding the script lock.
    var live=sheet.getRange(n,1,1,20).getDisplayValues()[0];
    if(live[1]!==row.Job_ID||live[5]!=='BUFFER_APPROVED'||
       live[9]||live[10]||live[11])throw Error('SOURCE_CHANGED');
    sheet.getRange(n,6).setValue('BUFFER_SUBMITTING');
    sheet.getRange(n,12).setValue(new Date());
    sheet.getRange(n,13).setValue('AT_MOST_ONCE_FENCE; inspect Buffer before retry');
    SpreadsheetApp.flush();
    try{
      var result=p80BufferPost_(key,p80BufferGraphql_(row,c.check));
      // A Buffer queue confirmation is NOT a public post.
      sheet.getRange(n,10).setValue(String(result.id));
      sheet.getRange(n,6).setValue('BUFFER_QUEUED');
      sheet.getRange(n,13).setValue('QUEUED_ONLY; verify public permalink after send');
      SpreadsheetApp.flush();
      return {enabled:true,queued:1,job:row.Job_ID,bufferPostId:result.id,
        published:false};
    }catch(error){
      // Response may have been lost AFTER provider accepted it; never resend.
      sheet.getRange(n,6).setValue('DELIVERY_UNVERIFIED');
      sheet.getRange(n,13).setValue('BUFFER_RESPONSE_UNVERIFIED; reconcile provider; no retry');
      SpreadsheetApp.flush();
      return {enabled:true,queued:0,job:row.Job_ID,reason:'PROVIDER_UNVERIFIED'};
    }
  }finally{lock.releaseLock();}
}
function p80BufferInstallTrigger(){
  var st=p80BufferOverview();
  if(!st.tokenConfigured||!st.mapConfigured||!st.enabled)
    return {ok:false,reason:'CONFIGURATION_OR_SWITCH_MISSING'};
  var own=ScriptApp.getProjectTriggers().filter(function(x){
    return x.getHandlerFunction()==='p80BufferTick';
  });
  if(own.length)return {ok:true,existing:own.length};
  if(ScriptApp.getProjectTriggers().length>=18)return {ok:false,reason:'TRIGGER_LIMIT'};
  ScriptApp.newTrigger('p80BufferTick').timeBased().everyMinutes(15).create();
  return {ok:true,installed:1};
}
function p80BufferDisable(){
  PropertiesService.getScriptProperties().setProperty('P80_BUFFER_ENABLED','false');
  return {enabled:false};
}
// Read-only channel discovery, requires owner-entered API key.
// Do NOT log or return the token, raw HTTP headers, or provider response body.
function p80BufferListConnectedChannels(){
  var key=PropertiesService.getScriptProperties().getProperty('BUFFER_API_KEY')||'';
  if(!key)return {configured:false,channels:[]};
  function query(q){
    var r=UrlFetchApp.fetch('https://api.buffer.com',{
      method:'post',contentType:'application/json',
      headers:{Authorization:'Bearer '+key},
      payload:JSON.stringify({query:q}),muteHttpExceptions:true
    });
    if(r.getResponseCode()!==200)throw Error('CHANNEL_QUERY_FAILED');
    var data=JSON.parse(r.getContentText()||'{}');
    if(data.errors)throw Error('CHANNEL_QUERY_UNVERIFIED');
    return data.data||{};
  }
  var orgs=(query('query {account {organizations {id name}}}').account||{}).organizations||[];
  var out=[];
  orgs.forEach(function(o){
    var channels=query('query {channels(input: {organizationId: '+JSON.stringify(o.id)+'}) {id name service}}').channels||[];
    channels.forEach(function(c){out.push({id:c.id,name:c.name,service:c.service,organization:o.name});});
  });
  return {configured:true,channels:out};
}
if(typeof module!=='undefined'&&module.exports)module.exports={
  p80BufferParseTime_:p80BufferParseTime_,p80BufferGuard_:p80BufferGuard_,
  p80BufferGraphql_:p80BufferGraphql_,p80BufferTick:p80BufferTick
};
