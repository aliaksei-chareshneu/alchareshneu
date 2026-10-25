/**
 * Optional, fail-closed MCP bridge for the EXISTING Community Hub Apps Script.
 * Requires ONE dispatch line at the very beginning of Code.gs doPost(e):
 *   if (e && e.parameter && e.parameter.mcp === '1') return imperionMcpHandle_(e);
 * Does not modify Tally registration behavior, add a trigger, or create a queue.
 * Secrets: Script Properties MCP_BRIDGE_SECRET, existing TELEGRAM_BOT_TOKEN.
 */
function imperionMcpResponse_(x) {
  return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
}
function imperionMcpTruth_(value) {
  return value === true || /^(true|yes|1)$/i.test(String(value || '').trim());
}
function imperionMcpSigned_(body) {
  var secret = PropertiesService.getScriptProperties().getProperty('MCP_BRIDGE_SECRET');
  if (!secret || secret.length < 32) return false;
  if (!body || body.version !== 'v1') return false;
  if (!/^(preview_telegram|publish_telegram|preview_whatsapp)$/.test(String(body.action || ''))) return false;
  if (!/^[A-Za-z0-9:_-]{4,128}$/.test(String(body.job_id || ''))) return false;
  if (!/^[a-f0-9]{32}$/.test(String(body.nonce || ''))) return false;
  var ts = Number(body.ts);
  if (!Number.isSafeInteger(ts) || Math.abs(Date.now() - ts) > 120000) return false;
  var payload = ['v1', body.action, body.job_id, String(ts), body.nonce].join('\n');
  var bytes = Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8);
  var expected = bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  var supplied = String(body.sig || '');
  if (supplied.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
function imperionMcpRecord_(sheet, jobId) {
  if (!sheet) throw new Error('SocialPublishing sheet missing');
  var width = sheet.getLastColumn();
  if (sheet.getLastRow() < 2) throw new Error('No SocialPublishing jobs');
  var heads = sheet.getRange(1, 1, 1, width).getValues()[0];
  var need = ['Duplicate_Checked','Job_ID','Event_ID','Channel','Scheduled_At','Status','Caption','Media_URL',
    'Video_Drive_ID','Post_ID','Post_URL','Attempted_At','Error','Entity','Grant_Funded','Grant_Text',
    'Rights_OK','Approved_At','Visibility'];
  need.forEach(function (k) { if (heads.filter(function (h) { return h === k; }).length !== 1) throw new Error('Invalid SocialPublishing schema: ' + k); });
  var cells = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var found = [];
  cells.forEach(function (row,i) { if (String(row[heads.indexOf('Job_ID')]) === jobId) found.push({rowNumber:i+2, row:row}); });
  if (found.length !== 1) throw new Error(found.length ? 'DUPLICATE_JOB_ID' : 'JOB_ID_NOT_FOUND');
  var result = {rowNumber:found[0].rowNumber, heads:heads};
  heads.forEach(function (h,i) { result[h] = found[0].row[i]; });
  return result;
}
function imperionMcpEvent_(book, eventId) {
  if (!eventId) throw new Error('EVENT_ID_REQUIRED');
  var sheet = book.getSheetByName('Events');
  if (!sheet || sheet.getLastRow() < 2) throw new Error('Events missing');
  var heads = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  ['Event_ID','Community','Status','Start_DateTime','Telegram_Post_ID'].forEach(function(k) { if (heads.indexOf(k)<0) throw new Error('Events column missing: '+k); });
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
  var hits = [];
  rows.forEach(function(row,i) { if (String(row[heads.indexOf('Event_ID')])===String(eventId)) hits.push({row:row,n:i+2}); });
  if (hits.length !== 1) throw new Error('EVENT_UNIQUE_MATCH_REQUIRED');
  var ev = {sheet:sheet, rowNumber:hits[0].n, heads:heads};
  heads.forEach(function(h,i){ev[h]=hits[0].row[i];});
  return ev;
}
function imperionMcpCheck_(job, event, channel) {
  var errors = [];
  if (String(job.Channel).trim().toLowerCase() !== channel) errors.push('CHANNEL_MISMATCH');
  if (String(job.Status) !== 'APPROVED') errors.push('STATUS_NOT_APPROVED');
  if (!job.Approved_At) errors.push('APPROVED_AT_MISSING');
  if (!imperionMcpTruth_(job.Rights_OK)) errors.push('MEDIA_RIGHTS_NOT_APPROVED');
  if (!imperionMcpTruth_(job.Duplicate_Checked)) errors.push('DUPLICATE_CHECK_NOT_RECORDED');
  if (String(job.Visibility).trim().toUpperCase() !== 'PUBLIC') errors.push('NOT_PUBLIC');
  if (job.Post_ID || job.Post_URL) errors.push('ALREADY_PUBLISHED');
  if (job.Error) errors.push('PENDING_ERROR_RECONCILIATION');
  if (!String(job.Entity || '').trim()) errors.push('LEGAL_ENTITY_MISSING');
  if (String(job.Caption || '').trim().length < 8) errors.push('CAPTION_MISSING');
  if (imperionMcpTruth_(job.Grant_Funded) && (!String(job.Grant_Text||'').trim() || String(job.Caption||'').indexOf(String(job.Grant_Text)) < 0)) errors.push('GRANT_ATTRIBUTION_MISSING');
  if (job.Scheduled_At) {
    var scheduled = new Date(job.Scheduled_At);
    if (isNaN(scheduled.getTime())) errors.push('INVALID_SCHEDULE');
    else if (scheduled.getTime() > Date.now() + 60000) errors.push('NOT_SCHEDULED_YET');
  }
  if (event) {
    if (String(event.Status) !== 'Active') errors.push('EVENT_NOT_ACTIVE');
    if (event.Telegram_Post_ID && channel==='telegram') errors.push('EVENT_ALREADY_ANNOUNCED_IN_TELEGRAM');
    var start = new Date(event.Start_DateTime);
    if (isNaN(start.getTime()) || start.getTime() < Date.now()) errors.push('EVENT_PAST_OR_INVALID');
    var community = String(event.Community).toLowerCase();
    var entity = String(job.Entity).toLowerCase();
    if (community.indexOf('družina') >= 0 && entity.indexOf('družina') < 0) errors.push('ENTITY_COMMUNITY_MISMATCH');
    if (community.indexOf('brnowalk') >= 0 && entity.indexOf('družina') >= 0) errors.push('ENTITY_COMMUNITY_MISMATCH');
  }
  if (channel === 'telegram') {
    var cap = String(job.Caption || '');
    if (job.Video_Drive_ID) errors.push('DRIVE_VIDEO_UPLOAD_UNSUPPORTED');
    if (job.Media_URL) {
      if (!/^https:\/\//i.test(String(job.Media_URL)) || !/\.(png|jpe?g|webp)(\?.*)?$/i.test(String(job.Media_URL))) errors.push('UNSUPPORTED_IMAGE_URL');
      if (cap.length > 1024) errors.push('MEDIA_CAPTION_OVER_1024');
    } else if (cap.length > 4096) errors.push('TEXT_OVER_4096');
  }
  return errors;
}
function imperionMcpSendTelegram_(job, event) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_TOKEN_NOT_SET');
  var community = String(event.Community);
  // No fallback to the wrong club. Reuse existing routes, but validate first.
  var chat = '';
  if (community === 'Družina Moravy') chat = TELEGRAM_CHANNEL_DRUZINA;
  else if (community === 'Brnowalkers') chat = TELEGRAM_CHANNEL_BRNOWALKERS;
  else throw new Error('UNRECOGNISED_COMMUNITY');
  if (!/^@[a-zA-Z0-9_]{5,32}$/.test(String(chat))) throw new Error('INVALID_TARGET_CHANNEL');
  var text = String(job.Caption).trim();
  var payload = {chat_id: chat};
  var method = 'sendMessage';
  if (job.Media_URL) {method = 'sendPhoto';payload.photo = String(job.Media_URL);payload.caption = text;}
  else payload.text = text;
  // No parse_mode: CRM captions are plain text, not trusted HTML.
  var raw = UrlFetchApp.fetch('https://api.telegram.org/bot'+TELEGRAM_BOT_TOKEN+'/'+method,
    {method:'post',payload:payload,muteHttpExceptions:true});
  var data;
  try {data = JSON.parse(raw.getContentText());} catch(e) {throw new Error('TELEGRAM_UNPARSEABLE');}
  if (raw.getResponseCode() < 200 || raw.getResponseCode() >= 300 || !data.ok || !data.result || !data.result.message_id) {
    throw new Error('TELEGRAM_NOT_CONFIRMED');
  }
  return {messageId:String(data.result.message_id),postUrl:'https://t.me/'+chat.substring(1)+'/'+data.result.message_id};
}
function imperionMcpHandle_(e) {
  var action = '';
  var lock;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    action = body.action || '';
    if (!imperionMcpSigned_(body)) return imperionMcpResponse_({ok:false,code:'AUTH_OR_REQUEST_DENIED'});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(9000)) return imperionMcpResponse_({ok:false,code:'LOCK_BUSY_NO_RETRY'});
    // Replay protection across requests, including previews, only after verification.
    var cache = CacheService.getScriptCache();
    var cacheKey = 'impmcp_'+body.nonce;
    if (cache.get(cacheKey)) return imperionMcpResponse_({ok:false,code:'REPLAY_DENIED'});
    cache.put(cacheKey,'1',600);
    var book = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = book.getSheetByName('SocialPublishing');
    var job = imperionMcpRecord_(sheet,body.job_id);
    var channel = action === 'preview_whatsapp' ? 'whatsapp':'telegram';
    var event = imperionMcpEvent_(book,job.Event_ID);
    var blocks = imperionMcpCheck_(job,event,channel);
    if (action === 'preview_telegram' || action === 'preview_whatsapp') {
      var publicApproved = blocks.length === 0;
      return imperionMcpResponse_({ok:true,job_id:body.job_id,channel:channel,status:String(job.Status),
        ready: publicApproved,publicApproved: publicApproved,blockers:blocks,
        caption: publicApproved?String(job.Caption):'', target:channel==='telegram'?String(event.Community):'WhatsApp manual group share'});
    }
    if (action !== 'publish_telegram') return imperionMcpResponse_({ok:false,code:'UNKNOWN_ACTION'});
    if (blocks.length) return imperionMcpResponse_({ok:false,code:'APPROVAL_GATES_BLOCKED',blockers:blocks});
    var h = job.heads;
    function set(k,v) {sheet.getRange(job.rowNumber,h.indexOf(k)+1).setValue(v);}
    // No automatic retry after an ambiguous network outcome.
    set('Status','SENDING_RECONCILE_IF_INTERRUPTED');
    set('Attempted_At',new Date());
    SpreadsheetApp.flush();
    var sent;
    try {sent=imperionMcpSendTelegram_(job,event);}
    catch (err) {set('Status','RECONCILIATION_REQUIRED');set('Error','Telegram delivery outcome uncertain; inspect channel before any retry');return imperionMcpResponse_({ok:false,code:'RECONCILIATION_REQUIRED'});}
    // Record Event before SocialPublishing so an incomplete write still blocks the legacy event dispatcher.
    event.sheet.getRange(event.rowNumber,event.heads.indexOf('Telegram_Post_ID')+1).setValue(sent.messageId);
    set('Post_ID',sent.messageId);
    set('Post_URL',sent.postUrl);
    set('Error','');
    set('Status','PUBLISHED_VERIFIED');
    SpreadsheetApp.flush();
    return imperionMcpResponse_({ok:true,job_id:body.job_id,status:'PUBLISHED_VERIFIED',message_id:sent.messageId,url:sent.postUrl});
  } catch (err) {
    // Do not leak sensitive content, secrets or row values in public Web App errors.
    console.error('Imperion MCP bridge failure: '+(err && err.message));
    return imperionMcpResponse_({ok:false,code:action==='publish_telegram'?'RECONCILIATION_REQUIRED':'BRIDGE_UNAVAILABLE'});
  } finally { if (lock) {try {lock.releaseLock();}catch(ignore){}} }
}