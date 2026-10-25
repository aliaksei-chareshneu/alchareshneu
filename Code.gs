// ====================== CONFIG ======================
// Заполни эти значения после Шагов 1-4 из гайда
var TELEGRAM_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '';
var TELEGRAM_CHANNEL_DRUZINA      = '@druzinamoravy_news';
var TELEGRAM_CHANNEL_BRNOWALKERS  = '@pochody_brno_news';
var TELEGRAM_ADMIN_CHAT_ID = PropertiesService.getScriptProperties().getProperty('TELEGRAM_ADMIN_CHAT_ID') || '';

var CALENDAR_ID             = '2b87a4e595671b05f82867969757d6c8500733a05a7ebcc77a3c6102b1644757@group.calendar.google.com';
var CALENDAR_PUBLIC_LINK    = 'https://calendar.google.com/calendar/embed?src=2b87a4e595671b05f82867969757d6c8500733a05a7ebcc77a3c6102b1644757%40group.calendar.google.com';

// Legacy Tally webhook compatibility. New public registrations use REGISTRATION_FORM_URL below.
// Keep the secret in Script Properties only; never commit it.
var TALLY_WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty('TALLY_WEBHOOK_SECRET') || '';

// Живая годовая форма регистрации (Google Form) — ОДНА постоянная ссылка на все события.
// Список дат/поездок внутри формы поддерживаешь сам через свой FormApp-скрипт,
// добавляя/убирая чекбоксы по мере того как события появляются/проходят.
var REGISTRATION_FORM_URL   = 'https://docs.google.com/forms/d/e/1FAIpQLScEaxLcoHw9NgWpPi1oV9HkGOtczIN4HgD__plLSBtnTJ-Dcg/viewform'; // .../forms/d/e/.../viewform

// Facebook Pages autoposting. Credentials are kept only in Script Properties.
// Per-community keys:
//   FACEBOOK_PAGE_ID_BRNOWALKERS / FACEBOOK_PAGE_TOKEN_BRNOWALKERS
//   FACEBOOK_PAGE_ID_DRUZINA     / FACEBOOK_PAGE_TOKEN_DRUZINA
//   FACEBOOK_PAGE_ID_SHARED      / FACEBOOK_PAGE_TOKEN_SHARED
// Optional language overrides: FACEBOOK_LANG_BRNOWALKERS / _DRUZINA / _SHARED.
// Legacy FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN are still accepted as a fallback.
var FACEBOOK_ENABLED = String(PropertiesService.getScriptProperties().getProperty('FACEBOOK_ENABLED') || 'false').toLowerCase() === 'true';
var FACEBOOK_GRAPH_VERSION = 'v26.0';

var EVENTS_SHEET_NAME        = 'Events';
var REGISTRATIONS_SHEET_NAME = 'Registrations';
var SPREADSHEET_ID           = '1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY'; // из URL таблицы

var SITE_EVENTS_LIMIT         = 6; // сколько ближайших событий отдавать на сайт
var SITE_EVENTS_CACHE_SECONDS = 300; // кэш ответа doGet, чтобы не дёргать Sheets на каждого посетителя сайта

// ====================== МЕНЮ ======================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Community Hub')
    .addItem('🔄 Повторить синхронизацию для текущей строки', 'retrySyncForActiveRow')
    .addItem('❌ Отменить событие (текущая строка)', 'cancelEventFromMenu')
    .addItem('⏰ Проверить напоминания сейчас', 'sendEventReminders')
    .addItem('📚 Создать пакет репетиторских занятий', 'createTutoringPackageEvents')
    .addToUi();
}

function retrySyncForActiveRow() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (sheet.getName() !== EVENTS_SHEET_NAME || row === 1) {
    SpreadsheetApp.getUi().alert('Выбери строку события на листе ' + EVENTS_SHEET_NAME);
    return;
  }
  processEventRow(sheet, row, getHeaderMap(sheet), true); // forceRetry=true, пропускает guard
}

// ====================== ХЕЛПЕРЫ ======================
function getHeaderMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) { map[h] = i + 1; });
  return map;
}

function colorAndEmoji(category, community) {
  // Цвета Google Calendar: 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana,
  // 6=Tangerine, 7=Peacock(turquoise), 8=Graphite, 9=Blueberry(violet), 10=Basil, 11=Tomato
  var map = {
    'City Walk':         { colorId: 7,  emoji: '🗺️' },  // Peacock — BrnoWalkers основной
    'Hike':              { colorId: 7,  emoji: '🥾' },  // Peacock — BrnoWalkers
    'Cave Tour':         { colorId: 2,  emoji: '🦇' },  // Sage — пещеры/природа
    'HEMA Training':     { colorId: 11, emoji: '⚔️' },  // Tomato — Družina боевая
    'LARP Battle':       { colorId: 6,  emoji: '🛡️' },  // Tangerine — битва
    'Board Games':       { colorId: 9,  emoji: '🎲' },  // Blueberry — настолки
    'Crafting':          { colorId: 3,  emoji: '🔨' },  // Grape — мастерская
    "Children's Quest":  { colorId: 5,  emoji: '🏰' },  // Banana — детское
    'Corporate':         { colorId: 8,  emoji: '🤝' },  // Graphite — бизнес
    'Free Event':        { colorId: 10, emoji: '🌟' },  // Basil — общественное
  };
  if (map[category]) return map[category];
  // Фоллбэк по клубу если категория не совпала
  if (community === 'Brnowalkers') return { colorId: 7, emoji: '🥾' };
  if (community === 'Družina Moravy') return { colorId: 11, emoji: '⚔️' };
  return { colorId: 5, emoji: '🤝' };
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tally возвращает чекбоксы как массив ID выбранных опций (НЕ true/false).
// Пустой массив [] - это truthy в JS, поэтому простое "value ? 'yes' : 'no'" всегда даёт 'yes'.
// Эта функция корректно обрабатывает и массив, и редкий случай булева значения.
function isChecked(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value === true;
}

function toRFC3339(date) {
  return Utilities.formatDate(date, 'Europe/Prague', "yyyy-MM-dd'T'HH:mm:ss");
}

// Sheets возвращает date-ячейки как JavaScript Date объекты, а не строки.
// Прямая конкатенация Date даёт уродливый "Mon Jul 12 2026 10:00:00 GMT+0200..."
// Эта функция обрабатывает оба случая: Date объект и текстовую строку.
function parseDate(val) {
  if (val instanceof Date) return val;
  return new Date(String(val).replace(' ', 'T')); // "2026-07-12 10:00" → ISO
}

function formatDateForPost(val) {
  var d = parseDate(val);
  if (isNaN(d.getTime())) return String(val);
  return Utilities.formatDate(d, 'Europe/Prague', 'dd.MM.yyyy HH:mm');
}

// Настолки — добровольный взнос, а не бинарное "бесплатно/платно": Price_CZK здесь
// ориентир, не обязательный минимум. Отдельная ветка, а не хардкод в 5 местах по коду.
function paymentPhrase(category, isFree, price) {
  if (category === 'Board Games') {
    return isFree
      ? 'Добровольный взнос — на усмотрение участника, через Revolut: revolut.me/aliaksj5pq'
      : 'Добровольный взнос (ориентир ~' + price + ' Kč), через Revolut: revolut.me/aliaksj5pq';
  }
  if (isFree) return 'Вход свободный 🆓';
  return price + ' Kč. Оплата: revolut.me/aliaksj5pq';
}

// Роутинг канала по клубу — без этого все анонсы уходили бы в один канал.
function getChannelId(community) {
  if (community === 'Družina Moravy') return TELEGRAM_CHANNEL_DRUZINA;
  if (community === 'Brnowalkers') return TELEGRAM_CHANNEL_BRNOWALKERS;
  return TELEGRAM_CHANNEL_DRUZINA; // fallback, если community не распознан
}


function getFacebookRoute(community) {
  var props = PropertiesService.getScriptProperties();
  var key = 'SHARED';
  var defaultLang = 'uk';
  if (community === 'Brnowalkers') {
    key = 'BRNOWALKERS';
    defaultLang = 'en';
  } else if (community === 'Družina Moravy') {
    key = 'DRUZINA';
    defaultLang = 'cs';
  }
  var knownPageId = '';
  if (key === 'BRNOWALKERS') knownPageId = '61572333527769';
  if (key === 'DRUZINA') knownPageId = '61566659360012';
  return {
    key: key,
    lang: props.getProperty('FACEBOOK_LANG_' + key) || defaultLang,
    pageId: props.getProperty('FACEBOOK_PAGE_ID_' + key) || knownPageId || props.getProperty('FACEBOOK_PAGE_ID') || '',
    token: props.getProperty('FACEBOOK_PAGE_TOKEN_' + key) || props.getProperty('FACEBOOK_PAGE_TOKEN') || ''
  };
}

function translateForSocial(text, targetLang) {
  text = String(text || '').trim();
  if (!text) return '';
  try {
    return LanguageApp.translate(text, '', targetLang);
  } catch (err) {
    console.error('Translation fallback (' + targetLang + '): ' + err);
    return text;
  }
}

function paymentPhraseLocalized(category, isFree, price, lang) {
  var revolut = 'revolut.me/aliaksj5pq';
  if (lang === 'cs') {
    if (category === 'Board Games') {
      return isFree
        ? 'Dobrovolný příspěvek — podle uvážení účastníka, přes Revolut: ' + revolut
        : 'Dobrovolný příspěvek (orientačně ~' + price + ' Kč), přes Revolut: ' + revolut;
    }
    if (isFree) return 'Vstup zdarma 🆓';
    return price + ' Kč. Platba: ' + revolut;
  }
  if (lang === 'uk') {
    if (category === 'Board Games') {
      return isFree
        ? 'Добровільний внесок — на розсуд учасника, через Revolut: ' + revolut
        : 'Добровільний внесок (орієнтовно ~' + price + ' Kč), через Revolut: ' + revolut;
    }
    if (isFree) return 'Вхід вільний 🆓';
    return price + ' Kč. Оплата: ' + revolut;
  }
  if (category === 'Board Games') {
    return isFree
      ? 'Voluntary contribution — pay what you like via Revolut: ' + revolut
      : 'Voluntary contribution (suggested ~' + price + ' Kč) via Revolut: ' + revolut;
  }
  if (isFree) return 'Free entry 🆓';
  return price + ' Kč. Payment: ' + revolut;
}

function socialLabels(lang) {
  if (lang === 'cs') {
    return { when: 'Kdy', where: 'Kde', registration: 'Registrace', allEvents: 'Všechny akce' };
  }
  if (lang === 'uk') {
    return { when: 'Коли', where: 'Де', registration: 'Реєстрація', allEvents: 'Усі події' };
  }
  return { when: 'When', where: 'Where', registration: 'Registration', allEvents: 'All events' };
}

function buildFacebookPost(community, category, title, description, startFormatted, locationName, isFree, price, registerUrl) {
  var route = getFacebookRoute(community);
  var lang = route.lang;
  var labels = socialLabels(lang);
  var translatedTitle = translateForSocial(title, lang);
  var translatedDescription = translateForSocial(description, lang);
  var lines = [
    translatedTitle + ' — ' + community,
    translatedDescription,
    labels.when + ': ' + startFormatted,
    labels.where + ': ' + locationName,
    paymentPhraseLocalized(category, isFree, price, lang),
    labels.registration + ': ' + registerUrl,
    labels.allEvents + ': ' + CALENDAR_PUBLIC_LINK
  ];
  return lines.filter(function (x) { return String(x || '').trim() !== ''; }).join('\n');
}

function buildWhatsAppCopy(category, title, description, startFormatted, locationName, isFree, price, registerUrl) {
  var titleEn = translateForSocial(title, 'en');
  var descriptionEn = translateForSocial(description, 'en');
  return '=== WhatsApp (copy & paste) ===\n' +
    titleEn + '\n' +
    (descriptionEn ? descriptionEn + '\n' : '') +
    'When: ' + startFormatted + '\n' +
    'Where: ' + locationName + '\n' +
    paymentPhraseLocalized(category, isFree, price, 'en') + '\n' +
    'Registration: ' + registerUrl + '\n' +
    'All events: ' + CALENDAR_PUBLIC_LINK;
}

// ====================== СЦЕНАРИЙ 1: EVENT BROADCASTER ======================
function onStatusChange(e) {
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() !== EVENTS_SHEET_NAME) return;
    var row = e.range.getRow();
    if (row === 1) return;

    var headerMap = getHeaderMap(sheet);
    if (e.range.getColumn() !== headerMap['Status']) return;
    if (e.range.getValue() !== 'Trigger_Sync') return;

    processEventRow(sheet, row, headerMap);
  } catch (err) {
    console.error('onStatusChange: ' + err);
  }
}

function processEventRow(sheet, row, headerMap, forceRetry) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    if (headerMap['Sync_Error']) sheet.getRange(row, headerMap['Sync_Error']).setValue('Sync already running; retry in a moment.');
    return;
  }
  try {
  var get = function (col) { return sheet.getRange(row, headerMap[col]).getValue(); };
  var set = function (col, val) { sheet.getRange(row, headerMap[col]).setValue(val); };

  // Each downstream channel is idempotent below: successful Calendar/Telegram/Facebook
  // outputs are reused on retry, while only failed/missing outputs are attempted again.
  var eventId      = get('Event_ID');
  var community     = get('Community');
  var category      = get('Category');
  var title         = get('Title');
  var startDT       = get('Start_DateTime');
  var endDT         = get('End_DateTime');
  var locationName  = get('Location_Name');
  var locationAddr  = get('Location_Address');
  var price         = get('Price_CZK');
  var description   = get('Description');

  var required = {
    Event_ID: eventId, Community: community, Category: category, Title: title,
    Start_DateTime: startDT, End_DateTime: endDT, Location_Name: locationName
  };
  var missing = Object.keys(required).filter(function (k) { return required[k] === '' || required[k] == null; });
  if (missing.length) {
    set('Last_Synced_At', new Date());
    set('Sync_Error', 'Missing required fields: ' + missing.join(', '));
    return;
  }

  var isFree = (Number(price) === 0);
  // Раньше: индивидуальная ссылка на Tally с параметрами конкретного события в URL.
  // Форма регистрации теперь другая по устройству — один общий годовой список дат,
  // который ты сам правишь чекбоксами, а не форма на одно событие. Поэтому здесь просто
  // одна и та же постоянная ссылка для всех событий, без параметров.
  // Колонку/переменную не переименовывал (Tally_Form_URL, tallyUrl) — не стоит риска.
  var tallyUrl = REGISTRATION_FORM_URL;
  set('Tally_Form_URL', tallyUrl);

  var ce = colorAndEmoji(category, community);
  // Corporate — внутренний учёт (B2B-бронирование, не публичное событие).
  // Раньше единственной задитой было "не ставь Trigger_Sync для Corporate" — ручная
  // дисциплина, которая рано или поздно нарушится. Теперь Corporate идёт через тот же
  // единый вход Trigger_Sync, что и всё остальное, а публичные каналы подавляются
  // самим кодом ниже (Calendar и админ-буфер — всегда, Telegram-канал и Facebook — нет).
  var isPublicEvent = (category !== 'Corporate');
  var errors = [];

  // --- Google Calendar ---
  var startFormatted = formatDateForPost(startDT);
  var hasCalendar = (headerMap['Calendar_Event_ID'] && get('Calendar_Event_ID')) ||
                    (headerMap['Calendar_Link'] && get('Calendar_Link'));
  if (!hasCalendar) {
    try {
      var startDate = parseDate(startDT);
      var endDate   = parseDate(endDT);
      var calEvent = {
        summary: ce.emoji + ' ' + community + ' | ' + title + ' (' + locationName + ')',
        description: description + '\n\n💰 Цена: ' + price + ' Kč\n📝 Регистрация: ' + tallyUrl,
        location: locationAddr || locationName,
        colorId: ce.colorId,
        start: { dateTime: toRFC3339(startDate), timeZone: 'Europe/Prague' },
        end:   { dateTime: toRFC3339(endDate),   timeZone: 'Europe/Prague' }
      };
      var created = Calendar.Events.insert(calEvent, CALENDAR_ID);
      set('Calendar_Link', created.htmlLink);
      if (headerMap['Calendar_Event_ID']) set('Calendar_Event_ID', created.id);
    } catch (err) {
      errors.push('Calendar: ' + err.message);
    }
  }

  // --- Telegram: пост в канал (пропускаем для Corporate — это не публичное событие) ---
  if (isPublicEvent && !(headerMap['Telegram_Post_ID'] && get('Telegram_Post_ID'))) {
    try {
      var channelText = ce.emoji + ' <b>' + escapeHtml(title) + '</b>\n\n' +
        '📍 ' + escapeHtml(locationName) + '\n' +
        '🗓 ' + startFormatted + '\n' +
        '💰 ' + price + ' Kč\n\n' +
        escapeHtml(description);
      var tgResp = sendTelegramMessage(getChannelId(community), channelText, tallyUrl, '📝 Записаться');
      set('Telegram_Post_ID', tgResp.result.message_id);
    } catch (err) {
      errors.push('Telegram channel: ' + err.message);
    }
  }

  // --- Telegram: буфер админу (WhatsApp + Facebook-черновик) ---
  if (!(headerMap['Admin_Buffer_Sent_At'] && get('Admin_Buffer_Sent_At'))) {
    try {
      var fbCopy = isPublicEvent
        ? buildFacebookPost(community, category, title, description, startFormatted, locationName, isFree, price, tallyUrl)
        : '';
      var bufferText = isPublicEvent
        ? buildWhatsAppCopy(category, title, description, startFormatted, locationName, isFree, price, tallyUrl) +
          '\n\n=== Facebook copy (' + getFacebookRoute(community).lang.toUpperCase() + ') ===\n' + fbCopy
        : '=== Corporate (internal, not published) ===\n' +
          translateForSocial(title, 'en') + '\n' + startFormatted + ', ' + locationName + '\n' +
          'The event was added to the calendar only. No public announcement was published.';
      sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, bufferText, null, null);
      if (headerMap['Admin_Buffer_Sent_At']) set('Admin_Buffer_Sent_At', new Date());
    } catch (err) {
      errors.push('Telegram admin buffer: ' + err.message);
    }
  }

  // --- Facebook Page autopost (official Pages API; Facebook Groups API is not available) ---
  var hasFacebookPost = headerMap['Facebook_Post_ID'] && get('Facebook_Post_ID');
  if (isPublicEvent && FACEBOOK_ENABLED && !hasFacebookPost) {
    try {
      var fbText = buildFacebookPost(community, category, title, description, startFormatted, locationName, isFree, price, tallyUrl);
      var fbResp = postToFacebookPage(fbText, community);
      if (headerMap['Facebook_Post_ID']) set('Facebook_Post_ID', fbResp && fbResp.id ? fbResp.id : '');
    } catch (err) {
      errors.push('Facebook: ' + err.message);
    }
  }

  // --- Финал ---
  set('Last_Synced_At', new Date());
  if (errors.length > 0) {
    set('Sync_Error', errors.join(' | '));
    // Status умышленно НЕ трогаем — остаётся Trigger_Sync, видно что циклы не закрылся чисто
  } else {
    set('Status', 'Active');
    set('Sync_Error', '');
    // Инвалидируем кэш doGet — сайт покажет новое событие при следующем открытии,
    // не ждёт истечения SITE_EVENTS_CACHE_SECONDS (5 мин)
    try { CacheService.getScriptCache().remove('site_events_json'); } catch (e) {}
  }
  } finally {
    lock.releaseLock();
  }
}

function sendTelegramMessage(chatId, text, buttonUrl, buttonText) {
  var payload = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (buttonUrl && buttonText) {
    payload.reply_markup = JSON.stringify({
      inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
    });
  }
  var resp = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage',
    { method: 'post', payload: payload, muteHttpExceptions: true }
  );
  var code = resp.getResponseCode();
  var json;
  try { json = JSON.parse(resp.getContentText()); }
  catch (err) { throw new Error('Telegram returned invalid JSON (HTTP ' + code + ')'); }
  if (code < 200 || code >= 300 || !json.ok) {
    throw new Error('Telegram HTTP ' + code + ': ' + ((json && json.description) || 'unknown error'));
  }
  return json;
}

function postToFacebookPage(message, community) {
  var route = getFacebookRoute(community);
  if (!route.pageId || !route.token) {
    throw new Error('Facebook Page credentials are not configured for ' + community + ' (' + route.key + ')');
  }
  var url = 'https://graph.facebook.com/' + FACEBOOK_GRAPH_VERSION + '/' + route.pageId + '/feed';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { message: message, access_token: route.token },
    muteHttpExceptions: true
  });
  var json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(json.error.message);
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    throw new Error('Facebook HTTP ' + resp.getResponseCode());
  }
  return json;
}

function deleteFacebookPost(postId, community) {
  if (!postId) return;
  var route = getFacebookRoute(community);
  if (!route.token) return;
  var resp = UrlFetchApp.fetch(
    'https://graph.facebook.com/' + FACEBOOK_GRAPH_VERSION + '/' + encodeURIComponent(postId),
    { method: 'delete', payload: { access_token: route.token }, muteHttpExceptions: true }
  );
  var json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json;
}

// ====================== СЦЕНАРИЙ 3: ПУБЛИЧНЫЙ API СОБЫТИЙ ДЛЯ САЙТА ======================
// GET-запрос на тот же Web App URL (без секрета — это публичные данные, которые и так
// видны в Telegram-канале и в публичном календаре). Отдаетс ближайшие Active-события,
// сайт сам решает, какой картинкой и как их показать (см. index.html).
//
// Формат ответа — JSONP (?callback=имяфункции), а не обычный цetch()+JSON.
// Причина: Apps Script Web App в реальности отвечает HTTP-редиректом на
// script.googleusercontent.com, и есть задокументированные случаи, когда заголовок
// Access-Control-Allow-Origin не переживает этот внутренний редирект при кросс-доменном
// fetch() из браузера. Загрузка через <script src="..."> (JSONP) в принципе не подчиняется
// политике CORS — это не запасной вариант "на всякий случай", а основной маршрут.
function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : '';
  // JSONP is executable JavaScript: only allow a simple global function identifier.
  if (callback && !/^[A-Za-z_$][0-9A-Za-z_$]{0,63}$/.test(callback)) callback = '';

  function respond(jsonString) {
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + jsonString + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    // Без callback — обычный JSON для ручной проверки в браузере.
    // setHeaders() не существует в ContentService.TextOutput (только в HtmlService),
    // поэтому CORS-заголовок здесь не добавляем — JSONP его не требует в принципе.
    return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var cache = CacheService.getScriptCache();
    var json = cache.get('site_events_json');

    if (!json) {
      var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
      var headerMap = getHeaderMap(sheet);
      var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), sheet.getLastColumn()).getValues();
      var now = new Date();

      var events = [];
      rows.forEach(function (row) {
        var status = row[headerMap['Status'] - 1];
        var startRaw = row[headerMap['Start_DateTime'] - 1];
        var title = row[headerMap['Title'] - 1];
        var registerUrl = row[headerMap['Tally_Form_URL'] - 1];
        if (status !== 'Active') return;
        if (row[headerMap['Category'] - 1] === 'Corporate') return; // внутренний учёт, не публичное событие
        if (!startRaw || !title || !registerUrl) return;
        var startDate = parseDate(startRaw);
        if (isNaN(startDate.getTime())) return; // защита от битых дат
        if (startDate < now) return;

        events.push({
          id: row[headerMap['Event_ID'] - 1],
          community: row[headerMap['Community'] - 1],
          category: row[headerMap['Category'] - 1],
          title: title,
          description: row[headerMap['Description'] - 1] || '',
          startISO: startDate.toISOString(),
          locationName: row[headerMap['Location_Name'] - 1] || '',
          priceCzk: row[headerMap['Price_CZK'] - 1] || 0,
          isFree: Number(row[headerMap['Price_CZK'] - 1] || 0) === 0,
          registerUrl: registerUrl,
          imageOverride: headerMap['Image_Filename'] ? (row[headerMap['Image_Filename'] - 1] || '') : ''
        });
      });

      events.sort(function (a, b) { return new Date(a.startISO) - new Date(b.startISO); });
      var limited = events.slice(0, SITE_EVENTS_LIMIT);
      json = JSON.stringify({ events: limited, generatedAt: new Date().toISOString() });
      cache.put('site_events_json', json, SITE_EVENTS_CACHE_SECONDS);
    }

    return respond(json);
  } catch (err) {
    console.error('doGet: ' + err);
    return respond(JSON.stringify({ events: [], error: 'temporarily_unavailable' }));
  }
}

// ====================== СЦЕНАРИЙ 2: ПРИБМ РЕГИСТРАЦИЙ (Tally → Web App) ======================
function doPost(e) {
  try {
    if (!TALLY_WEBHOOK_SECRET || !e || !e.parameter || e.parameter.secret !== TALLY_WEBHOOK_SECRET) {
      return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'busy_retry' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try {
    if (!e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 1000000) throw new Error('Invalid webhook body');
    var data = JSON.parse(e.postData.contents);
    var submissionId = (data.data && data.data.submissionId) || '';
    if (typeof submissionId !== 'string' || !submissionId || !Array.isArray(data.data.fields)) throw new Error('Missing submission identity or fields');
    var byLabel = {};
    (data.data && data.data.fields || []).forEach(function (f) { byLabel[f.label] = f.value; });

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(REGISTRATIONS_SHEET_NAME);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var submissionCol = headers.indexOf('Submission_ID');
    if (submissionCol === -1) throw new Error('Submission_ID column is required for deduplication');

    // Tally повторяет доставку вебхука (через 5 мин/30мин/1ч/6ч/1день), если не получила
    // ответ 2xx за 10 секунд. Если первая попытка на самом деле уже сохранилась,
    // но ответ не дошёл до Tally — это защита от появления дублирующей строки.
    if (submissionId && submissionCol !== -1) {
      var existing = sheet.getRange(2, submissionCol + 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
      for (var i = 0; i < existing.length; i++) {
        if (String(existing[i][0]) === String(submissionId)) {
          return ContentService.createTextOutput(JSON.stringify({ ok: true, duplicate: true }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    var eventId = byLabel['event_id'] || '';
    var eventDate = lookupEventDate(ss, eventId);
    var retentionUntil = eventDate ? new Date(eventDate.getTime() + 90 * 24 * 60 * 60 * 1000) : '';

    var newRow = headers.map(function (h) {
      switch (h) {
        case 'Reg_ID': return Utilities.getUuid();
        case 'Event_ID': return eventId;
        case 'Timestamp': return new Date();
        case 'Full_Name': return byLabel['Full_Name'] || '';
        case 'Telegram_Handle': return byLabel['Telegram_Handle'] || '';
        case 'Phone_Number': return byLabel['Phone_Number'] || '';
        case 'Age': return byLabel['Age'] || '';
        case 'Guardian_Name': return byLabel['Guardian_Name'] || '';
        case 'Guardian_Phone': return byLabel['Guardian_Phone'] || '';
        case 'Guardian_Relationship': return byLabel['Guardian_Relationship'] || '';
        case 'Photo_Consent': return isChecked(byLabel['Photo_Consent']) ? 'yes' : 'no';
        case 'Waiver_Accepted': return isChecked(byLabel['Waiver_Accepted']) ? 'yes' : 'no';
        // Поля ниже актуальны не для всех событий — только для Children's Quest / LARP Battle.
        // Для остальных категорий просто останутся пустыми, это ожидаемо.
        case 'Child_Name': return byLabel['Child_Name'] || '';
        case 'Child_Age': return byLabel['Child_Age'] || '';
        case 'Emergency_Contact_Name': return byLabel['Emergency_Contact_Name'] || '';
        case 'Emergency_Contact_Phone': return byLabel['Emergency_Contact_Phone'] || '';
        case 'Medical_Conditions': return byLabel['Medical_Conditions'] || '';
        case 'Equipment_Note': return byLabel['Equipment_Note'] || '';
        case 'Payment_Reference': return (byLabel['Full_Name'] || '') + ' – ' + eventId;
        case 'Retention_Until': return retentionUntil;
        case 'Submission_ID': return submissionId;
        default: return '';
      }
    });
    // Untrusted webhook text must never become a spreadsheet formula.
    newRow = newRow.map(function (value) {
      return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value;
    });
    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error('doPost: ' + err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'invalid_request' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function lookupEventDate(ss, eventId) {
  var sheet = ss.getSheetByName(EVENTS_SHEET_NAME);
  var headerMap = getHeaderMap(sheet);
  var data = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][headerMap['Event_ID'] - 1]) === String(eventId)) {
      return new Date(data[i][headerMap['Start_DateTime'] - 1]);
    }
  }
  return null;
}

// ====================== НАПОМИНАНИЕ ЗА 48 ЧАСОВ ======================
// Триггер: Time-driven, ежедневно в 10:00 Prague.
// Ищет Active события с Start_DateTime завтра-послезавтра и шлёт напоминание в канал.
function sendEventReminders() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
  var headerMap = getHeaderMap(sheet);
  var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), sheet.getLastColumn()).getValues();

  // Сравниваем календарные даты (Europe/Prague), а не сментие в часах от текущего момента.
  // Раньше окно было "+44ч...+52ч от now" — при ежедневном триггере в 10:00 это на самом деле
  // ловило события ПОСЛЕЗАВТРА (ч+2), а не завтра, при этом текст сообщения говорил "завтра".
  // Сравнение по календарным суткам не зависит от зависит от того, в какой час дня сработал триггer
  // и в какой час начинается само событие.
  var tz = 'Europe/Prague';
  var tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  var tomorrowStr = Utilities.formatDate(tomorrow, tz, 'yyyy-MM-dd');

  rows.forEach(function (row) {
    var status = row[headerMap['Status'] - 1];
    if (status !== 'Active') return;
    if (row[headerMap['Category'] - 1] === 'Corporate') return; // внутренний учёт, без публичных напоминаний

    var startDate = parseDate(row[headerMap['Start_DateTime'] - 1]);
    if (isNaN(startDate.getTime())) return;
    var eventDateStr = Utilities.formatDate(startDate, tz, 'yyyy-MM-dd');
    if (eventDateStr !== tomorrowStr) return; // событие не "завтра" по календарю Prague — пропускаем

    var title        = row[headerMap['Title'] - 1];
    var locationName = row[headerMap['Location_Name'] - 1];
    var locationAddr = row[headerMap['Location_Address'] - 1];
    var community    = row[headerMap['Community'] - 1];
    var category     = row[headerMap['Category'] - 1];
    var price        = row[headerMap['Price_CZK'] - 1];
    var tallyUrl     = row[headerMap['Tally_Form_URL'] - 1];
    var calLink      = row[headerMap['Calendar_Link'] - 1];
    var isFree       = (Number(price) === 0);
    var ce           = colorAndEmoji(category, community);
    var startStr     = formatDateForPost(startDate);

    var reminderText =
      '⏰ <b>Напоминание — завтра!</b>\n\n' +
      ce.emoji + ' <b>' + escapeHtml(title) + '</b>\n\n' +
      '🐡 ' + escapeHtml(locationName) +
      (locationAddr ? '\n📌 ' + escapeHtml(locationAddr) : '') + '\n' +
      '🕐 ' + startStr + '\n' +
      '💰 ' + paymentPhrase(category, isFree, price) + '\n' +
      '\n🗓,<a href="' + calLink + '">Добавить в календарь</a>';

    try {
      sendTelegramMessage(getChannelId(community), reminderText,
        tallyUrl || null,
        tallyUrl ? '📝 Ещё не записался?' : null);
    } catch (err) {
      console.error('Reminder failed for ' + title + ': ' + err);
    }
  });
}

// ====================== ОТМЕНА СОБЫТИЯ ======================
// Вызывается вручную через меню: выдели строку события → Community Hub → Отменить событие.
// Публикует обявление об отмене в Telegram и переводит Status в Archived.
function cancelEventFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (sheet.getName() !== EVENTS_SHEET_NAME || row === 1) {
    ui.alert('Выбери строку события на листе ' + EVENTS_SHEET_NAME);
    return;
  }
  var result = ui.alert(
    'Отменить событие?',
    'Будет опубликовано объявление об отмене в Telegram-канале. Продолжить?',
    ui.ButtonSet.YES_NO
  );
  if (result !== ui.Button.YES) return;

  var headerMap = getHeaderMap(sheet);
  var get = function (col) { return sheet.getRange(row, headerMap[col]).getValue(); };
  var set = function (col, val) { sheet.getRange(row, headerMap[col]).setValue(val); };

  var title     = get('Title');
  var startDT   = get('Start_DateTime');
  var community = get('Community');
  var category  = get('Category');
  var price     = get('Price_CZK');
  var isPublicEvent = (category !== 'Corporate');

  // Удаляем событие из Google Calendar — иначе оно останется висеть как "призрак"
  // во встроенном на сайте календаре, даже после того как карточка на сайте пропадёт.
  if (headerMap['Calendar_Event_ID']) {
    var calEventId = get('Calendar_Event_ID');
    if (calEventId) {
      try { Calendar.Events.remove(CALENDAR_ID, calEventId); }
      catch (err) { /* обытие могло уже быть удалено руками — не блокируем отмену из-за этого */ }
    }
  }

  // Удаляем Facebook Page post, если он был создан автопостингом.
  if (headerMap['Facebook_Post_ID']) {
    var facebookPostId = get('Facebook_Post_ID');
    if (facebookPostId) {
      try { deleteFacebookPost(facebookPostId, community); }
      catch (err) { console.error('Facebook delete failed: ' + err); }
    }
  }

  var cancelText =
    '❌ <b>Событие отменено</b>\n\n' +
    escapeHtml(title) + ' (' + formatDateForPost(startDT) + ')\n\n' +
    (Number(price) > 0
      ? '💸 Если вы оплатили участие — напишите организатору для возврата средств.'
      : 'Ждём вас на следующих событиях!') + '\n\n' +
    '📅 Следите за расписанием: ' + CALENDAR_PUBLIC_LINK;

  try {
    if (isPublicEvent) {
      sendTelegramMessage(getChannelId(community), cancelText, null, null);
    }
    set('Status', 'Archived');
    set('Sync_Error', 'CANCELLED ' + new Date().toISOString());
    // Инвалидируем кэш сайта чтобы отменённое событие исчезло
    try { CacheService.getScriptCache().remove('site_events_json'); } catch (e) {}
    ui.alert(isPublicEvent
      ? 'Обявление об отмене опубликовано, событие удалено из календаря. Статус изменён на Archived.'
      : 'Событие удалено из календаря (без публичного объявления — Corporate). Статус изменён на Archived.');
  } catch (err) {
    ui.alert('Ошибка при публикации: ' + err.message);
  }
}

// ====================== ПАКЕТ РЕПЕТИТОРСТВА: ВСЕ ЗАНЯТИЯ В КАЛЕНДАРЬ РАЗОМ ======================
// Даты/время занятий согласовываются с учеником (не через Tally) — этот инструмент
// просто разом создаёт все N события в календаре, а не по одному вручную.
function createTutoringPackageEvents() {
  var ui = SpreadsheetApp.getUi();

  var labelResp = ui.prompt('Пакет репетиторства',
    'Имя ученика и предмет (например: "Иван — английский, пакет 10"):',
    ui.ButtonSet.OK_CANCEL);
  if (labelResp.getSelectedButton() !== ui.Button.OK) return;
  var label = labelResp.getResponseText().trim();
  if (!label) { ui.alert('Не указано имя/предмет — отменено.'); return; }

  var datesResp = ui.prompt('Даты занятий',
    'Через запятую, формат GGGG-MM-DD HH:MM:\ЧЧ:ММ\nПример: 2026-07-10 15:00, 2026-07-14 15:00, 2026-07-17 15:00',
    ui.ButtonSet.OK_CANCEL);
  if (datesResp.getSelectedButton() !== ui.Button.OK) return;

  var durationResp = ui.prompt('Длительность занятия', 'В минутах (по умолчанию 60):', ui.ButtonSet.OK_CANCEL);
  if (durationResp.getSelectedButton() !== ui.Button.OK) return;
  var duration = parseInt(durationResp.getResponseText(), 10);
  if (!duration || duration <= 0) duration = 60;

  var dates = datesResp.getResponseText().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (dates.length === 0) { ui.alert('Не указано ни одной даты — отменено.'); return; }

  var created = 0, failed = [];
  dates.forEach(function (d) {
    try {
      var start = new Date(d.replace(' ', 'T'));
      if (isNaN(start.getTime())) throw new Error('неверный формат даты');
      var end = new Date(start.getTime() + duration * 60000);
      Calendar.Events.insert({
        summary: '📚 ' + label,
        start: { dateTime: toRFC3339(start), timeZone: 'Europe/Prague' },
        end:   { dateTime: toRFC3339(end),   timeZone: 'Europe/Prague' }
      }, CALENDAR_ID);
      created++;
    } catch (err) {
      failed.push(d + ' (' + err.message + ')');
    }
  });

  var msg = 'Создано занятий: ' + created + ' из ' + dates.length + '.';
  if (failed.length) msg += '\nНе удалось: ' + failed.join('; ');
  ui.alert(msg);
}

// ====================== ОЧИСТКА ПЕРСОНАЛЬНЫХ ДАННЫХ (GDPR) ======================
function cleanupOldRegistrations() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REGISTRATIONS_SHEET_NAME);
  var headerMap = getHeaderMap(sheet);
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  for (var i = 1; i < data.length; i++) {
    var retentionVal = data[i][headerMap['Retention_Until'] - 1];
    if (!retentionVal) continue;
    if (new Date(retentionVal) < today) {
      sheet.getRange(i + 1, headerMap['Phone_Number']).setValue('—');
      sheet.getRange(i + 1, headerMap['Payment_Reference']).setValue('—');
      // Поля опекуна — тоже персональные (родителя), чистим вместе с остальными
      if (headerMap['Guardian_Name'])  sheet.getRange(i + 1, headerMap['Guardian_Name']).setValue('—');
      if (headerMap['Guardian_Phone']) sheet.getRange(i + 1, headerMap['Guardian_Phone']).setValue('—');
    }
  }
}