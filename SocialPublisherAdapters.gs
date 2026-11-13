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
 if(SP_AUTO.indexOf(job.Channel)<0)
   throw Error('Automatic publishing not supported for '+job.Channel);
 spReleaseGate_(event,job); // cannot bypass the dispatcher by calling this adapter directly
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
  case 'instagram':return spInstagram_(event,job);
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
function spInstagram_(event,job){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('SOCIAL_INSTAGRAM_ENABLED')!=='true')
   throw Error('SOCIAL_INSTAGRAM_ENABLED not configured');
 // Never cross-post a club image to a different connected personal account.
 var key=event.Community==='Brnowalkers'?'BRNOWALKERS':
   event.Community==='Družina Moravy'?'DRUZINA':'';
 if(!key)throw Error('Instagram community has no authorised brand route');
 var id=p.getProperty('SOCIAL_IG_USER_ID_'+key);
 var tok=p.getProperty('SOCIAL_IG_ACCESS_TOKEN_'+key);
 if(!id||!tok)throw Error('Brand-specific Instagram credentials missing for '+key);
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
/* OAuth upload follows the ACTIVE account. Verify that account against the
 * expected brand-specific YouTube channel before any video blob is loaded.
 * channels.list?mine=true needs owner OAuth authorization; no API keys, no
 * assumption that the Apps Script owner uploads to the intended NGO channel.
 */
function spYoutubeOwnerChannel_(event,token,props){
 var key=event.Community==='Družina Moravy'?'DRUZINA':
  event.Community==='Brnowalkers'?'BRNOWALKERS':
  event.Community==='OSVC'?'OSVC':'';
 if(!key)throw Error('YouTube publishing has no approved legal entity route');
 var expected=String(props.getProperty('SOCIAL_YOUTUBE_CHANNEL_ID_'+key)||'');
 if(!/^UC[a-zA-Z0-9_-]{22}$/.test(expected))
  throw Error('Expected brand-specific YouTube channel ID not configured');
 var r=UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',{
   method:'get',muteHttpExceptions:true,followRedirects:false,
   headers:{Authorization:'Bearer '+token}
 });
 if(r.getResponseCode()!==200)
  throw Error('YouTube owner channel OAuth readback unavailable');
 var response;
 try{response=JSON.parse(r.getContentText());}
 catch(_){throw Error('YouTube owner channel API response invalid');}
 var found=response&&Array.isArray(response.items)?response.items:[];
 if(found.length!==1||!found[0]||String(found[0].id)!==expected)
  throw Error('YouTube OAuth channel identity mismatch: do not upload');
 return expected;
}
function spYoutube_(event,job){
 var props=PropertiesService.getScriptProperties();
 if(props.getProperty('SOCIAL_YOUTUBE_ENABLED')!=='true')
   throw Error('YouTube upload disabled. Add OAuth youtube.upload and enable only after test.');
 if(String(job.Visibility)==='public' &&
    props.getProperty('SOCIAL_YOUTUBE_PUBLIC_ENABLED')!=='true')
   throw Error('Public automatic YouTube posts not approved in Script Properties');
 var youtubeToken=ScriptApp.getOAuthToken();
 spYoutubeOwnerChannel_(event,youtubeToken,props);
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
   headers:{Authorization:'Bearer '+youtubeToken}
 });
 var v;try{v=JSON.parse(r.getContentText());}
 catch(e){throw Error('YouTube returned unreadable HTTP '+r.getResponseCode());}
 if(r.getResponseCode()>=300||v.error||!v.id)
   throw Error('YouTube API '+r.getResponseCode()+': '+
      (v.error&&v.error.message||'no post ID; check Studio before retry'));
 return {id:String(v.id),url:'https://www.youtube.com/watch?v='+encodeURIComponent(v.id)};
}
