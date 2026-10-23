/* One-click manual handoff for WhatsApp, Facebook PERSONAL profiles and TikTok.
 * Built into the authorised owner-only Google Sheets UI. Does not bypass platform policy.
 */
function spEscapeText_(s) {
 return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function spManualLink_(job) {
 if(job.Channel==='whatsapp')
  return 'https://api.whatsapp.com/send?text='+encodeURIComponent(String(job.Caption));
 if(job.Channel==='facebook_profile')return 'https://www.facebook.com/';
 if(job.Channel==='tiktok')return 'https://www.tiktok.com/upload';
 throw Error('Not an owner-manual destination.');
}
function spManualSelected_() {
 var sh=SpreadsheetApp.getActiveSheet(),row=sh.getActiveCell().getRow();
 if(sh.getName()!==SP_TAB||row<2)throw Error('Select SocialPublishing row');
 var job=spItems_(sh).filter(function(j){return j.row===row;})[0];
 if(!job||!spManual_(job.Channel))throw Error('Select a manual channel row');
 return {sh:sh,job:job};
}
/* Opens a copy/read-only modal; never publishes or marks receipt itself. */
function spOpenManualSelected() {
 var item=spManualSelected_(),job=item.job;
 if(job.Status!=='READY_MANUAL'&&job.Status!=='MANUAL_OWNER_CONFIRMED'&&job.Status!=='MANUAL_VERIFIED')
  throw Error('Approve this DRAFT manually before opening the sharing panel.');
 var link=spManualLink_(job),text=spEscapeText_(job.Caption);
 var html='<!doctype html><html><head><base target="_blank">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<style>body{font:15px Arial,sans-serif;padding:16px;color:#222}'+
 'textarea{width:100%;min-height:260px;box-sizing:border-box;white-space:pre-wrap}'+
 'button,a.go{display:inline-block;background:#126abb;color:white;border:0;border-radius:7px;'+
 'padding:11px 15px;font-size:14px;margin:10px 5px 10px 0;text-decoration:none;cursor:pointer}'+
 'small{color:#555}</style></head><body><h3>Review & share: '+
 spEscapeText_(job.Channel)+'</h3><p>1. Copy prepared text. 2. Open your account. '+
 '3. Publish there yourself. 4. Return and record real post URL (if available).</p>'+
 '<textarea id="post" readonly>'+text+'</textarea>'+
 '<p><button onclick="copyNow()">Copy text</button>'+
 '<a class="go" href="'+spEscapeText_(link)+'" target="_blank" rel="noopener">Open destination</a></p>'+
 '<small id="note">No message is sent by this panel. Only authorised groups/channels.</small>'+
 '<script>function copyNow(){var el=document.getElementById("post");el.select();'+
 'try{document.execCommand("copy");document.getElementById("note").textContent="Copied. Publish in your own account.";}' +
 'catch(e){document.getElementById("note").textContent="Select all and copy manually.";}}</script></body></html>';
 SpreadsheetApp.getUi().showModalDialog(
  HtmlService.createHtmlOutput(html).setWidth(660).setHeight(560),
  'Social Publisher: manual handoff');
}
/* The owner must fill Post_URL for Facebook/TikTok. WhatsApp share has no public post URL. */
function spConfirmManualSelected() {
 var item=spManualSelected_(),sh=item.sh,job=item.job;
 if(job.Status!=='READY_MANUAL')throw Error('Only READY_MANUAL can be confirmed');
 var map=spMap_(sh),ui=SpreadsheetApp.getUi(),url=String(job.Post_URL||'');
 if(job.Channel==='facebook_profile') {
  if(!/^https:\/\/(www\.|m\.)?(facebook\.com|fb\.com)\//i.test(url) ||
    /^https:\/\/(www\.|m\.)?facebook\.com\/?$/i.test(url))
    throw Error('Paste actual published Facebook post permalink into Post_URL first (not homepage)');
 }else if(job.Channel==='tiktok') {
  if(!/^https:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/i.test(url))
    throw Error('Paste actual published TikTok video link into Post_URL first');
 }
 if(ui.alert('Manually published?', 'Confirm that YOU actually published on '+job.Channel+
   '. This is a user declaration, not API verification.',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 var status=job.Channel==='whatsapp'?'MANUAL_OWNER_CONFIRMED':'MANUAL_LINK_RECORDED';
 sh.getRange(job.row,map.Status).setValue(status);
 sh.getRange(job.row,map.Attempted_At).setValue(new Date());
 sh.getRange(job.row,map.Error).setValue('Manual owner confirmation; remote publication not API-verified');
}
