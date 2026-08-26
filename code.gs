const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const CHAT_ID = 'YOUR_CHAT_ID';

function doPost(e) {
  const p = JSON.parse(e.postData.contents).data;
  const msg = `🚀 <b>Nová rezervace!</b>\n\n👤 Jméno: ${p.name}\n📅 Akce: ${p.event_name || p.service}\n📧 Email: ${p.email}\n🔗 UTM: ${p.utm || 'direct'}`;
  
  UrlFetchApp.fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'post',
    payload: { chat_id: CHAT_ID, text: msg, parse_mode: 'HTML' }
  });
  
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
}