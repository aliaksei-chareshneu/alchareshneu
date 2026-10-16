/* Official adapters for IMPERION Social Publisher.
 * Telegram existing channel bot, Facebook PAGES (never personal profiles),
 * Instagram professional IMAGE publishing, small YouTube videos.
 * WhatsApp and personal Facebook stay owner-confirmed share/manual.
 * Do not expose OAuth/Script Properties or enable before live tests.
 */
function spSetEventReceipt_(event,field,value) {
 var sheet=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
 var map=getHeaderMap(sheet);
 if(map[field] && event.row) sheet.getRange(event.row,map[field]).setValue(value);
}
function spSend_(event,job) {
 switch(job.Channel) {
  case 'telegram':
   if(event.Community!=='Brnowalkers'&&event.Community!=='Družina Moravy'){
    throw Error('Unsupported Telegram community: fail closed');
   }
   var chat=getChannelId(event.Community),safe=String(chat).replace(/^@/,'');
   if(event.Telegram_Post_ID)return {
    existing:true,id:String(event.Telegram_Post_ID),
    url:'https://t.me/'+safe+'/'+event.Telegram_Post_ID
   };
   if(!TELEGRAM_BOT_TOKEN)throw Error('Telegram bot not configured');
   if(String(job.Caption).length>3900)throw Error('Telegram caption exceeds safe limit');
   var r=sendTelegramMessage(chat,escapeHtml(job.Caption),null,null);
   if(!r || !r.result || !r.result.message_id)throw Error('Telegram sent, but receipt ID is missing: check channel');
   spSetEventReceipt_(event,'Telegram_Post_ID',r.result.message_id);
   return {id:String(r.result.message_id),url:'https://t.me/'+safe+'/'+r.result.message_id};
  case 'facebook_page':
   if(event.Facebook_Post_ID)return {
    existing:true,id:String(event.Facebook_Post_ID),
    url:'https://www.facebook.com/'+encodeURIComponent(String(event.Facebook_Post_ID))
   };
   if(!FACEBOOK_ENABLED)throw Error('FACEBOOK_ENABLED is false');
   var page=postToFacebookPage(String(job.Caption),event.Community);
   if(!page || !page.id)throw Error('Page API returned no post ID; check actual Page before retry');
   spSetEventReceipt_(event,'Facebook_Post_ID',page.id);
   return {id:String(page.id),url:'https://www.facebook.com/'+encodeURIComponent(String(page.id))};
  case 'instagram':return spInstagram_(job);
  case 'youtube':return spYoutube_(event,job);
  default:throw Error('Automatic publishing not supported for '+job.Channel);
 }
}
function spMeta_(path,body,token) {
 var opt={method:body?'post':'get',muteHttpExceptions:true,
  headers:{Authorization:'Bearer '+token}};
 if(body)opt.payload=body;
 var response=UrlFetchApp.fetch(
  'https://graph.facebook.com/'+FACEBOOK_GRAPH_VERSION+'/'+path,opt);
 var v;
 try{v=JSON.parse(response.getContentText());}
 catch(x){throw Error('Invalid Meta API response HTTP '+response.getResponseCode());}
 if(response.getResponseCode()>=300||v.error){
  throw Error('Meta API '+response.getResponseCode()+': '+
    (v.error&&v.error.message||'unknown error'));
 }
 return v;
}
function spInstagram_(job){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('SOCIAL_INSTAGRAM_ENABLED')!=='true')
   throw Error('SOCIAL_INSTAGRAM_ENABLED not configured');
 var id=p.getProperty('SOCIAL_IG_USER_ID'),tok=p.getProperty('SOCIAL_IG_ACCESS_TOKEN');
 if(!id||!tok)throw Error('Connect authorized professional Instagram and set credentials in Script Properties');
 var container=spMeta_(encodeURIComponent(id)+'/media',
  {image_url:String(job.Media_URL),caption:String(job.Caption)},tok);
 if(!container.id)throw Error('Meta media container missing; verify before retry');
 var out=spMeta_(encodeURIComponent(id)+'/media_publish',
  {creation_id:container.id},tok);
 if(!out.id)throw Error('Instagram publish ID missing; verify remote status');
 var link=spMeta_(encodeURIComponent(out.id)+'?fields=permalink',null,tok);
 return {id:String(out.id),url:link.permalink||''};
}
/* YouTube short uploader using official videos.insert, for small Drive video blobs
 * only (<=20 MiB). The user must explicitly authorize youtube.upload scope.
 * Larger files go to existing local ShortFactory worker, not Apps Script memory.
 */
function spYoutube_(event,job){
 var props=PropertiesService.getScriptProperties();
 if(props.getProperty('SOCIAL_YOUTUBE_ENABLED')!=='true')
   throw Error('YouTube upload disabled. Add OAuth youtube.upload and enable only after test.');
 if(String(job.Visibility)==='public' &&
    props.getProperty('SOCIAL_YOUTUBE_PUBLIC_ENABLED')!=='true')
   throw Error('Public automatic YouTube posts not approved in Script Properties');
 var file=DriveApp.getFileById(String(job.Video_Drive_ID));
 if(!/^video\//.test(file.getMimeType()))throw Error('Drive file is not a video');
 if(file.getSize()>20*1024*1024)throw Error('Video >20MiB: use existing ShortFactory uploader');
 var blob=file.getBlob();
 var boundary='imperion'+Utilities.getUuid().replace(/-/g,'');
 var metadata={
  snippet:{title:String(event.Title).slice(0,100),
   description:String(job.Caption).slice(0,4800),categoryId:'22'},
  status:{privacyStatus:String(job.Visibility),
   selfDeclaredMadeForKids:String(job.Made_For_Kids).toUpperCase()==='YES'}
 };
 var start='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
   +JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+blob.getContentType()+'\r\n\r\n';
 var end='\r\n--'+boundary+'--';
 var bytes=Utilities.newBlob(start).getBytes()
   .concat(blob.getBytes(),Utilities.newBlob(end).getBytes());
 var r=UrlFetchApp.fetch('https://www.googleapis.com/upload/youtube/v3/videos'
   +'?uploadType=multipart&part=snippet,status',{
   method:'post',payload:bytes,muteHttpExceptions:true,
   contentType:'multipart/related; boundary='+boundary,
   headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}
 });
 var v;try{v=JSON.parse(r.getContentText());}
 catch(e){throw Error('YouTube returned unreadable HTTP '+r.getResponseCode());}
 if(r.getResponseCode()>=300||v.error||!v.id)
   throw Error('YouTube API '+r.getResponseCode()+': '+
      (v.error&&v.error.message||'no post ID; check Studio before retry'));
 return {id:String(v.id),url:'https://www.youtube.com/watch?v='+encodeURIComponent(v.id)};
}
