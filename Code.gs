// ====================== CONFIG ======================
// Заполни эти значения после Шагов 1-4 из гайда
var TELEGRAM_BOT_TOKEN      = 'ВСТАВЬ_ТОКЕН_БОТА';
var TELEGRAM_CHANNEL_ID     = '@имя_канала'; // или числовой -100xxxxxxxxxx
var TELEGRAM_ADMIN_CHAT_ID  = 'ТВОЙ_ЧИСЛОВОЙ_CHAT_ID';

var CALENDAR_ID             = 'xxxxx@group.calendar.google.com';
var CALENDAR_PUBLIC_LINK    = 'ССЫЛКА_PUBLIC_URL_КАЛЕНДАРЯ';

var TALLY_FORM_ID           = 'ID_ТВОЕЙ_ФОРМЫ';
var TALLY_WEBHOOK_SECRET    = 'ПРИДУМАЙ_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ';

var FACEBOOK_ENABLED        = false; // включишь после App Review
var FACEBOOK_PAGE_ID        = '';
var FACEBOOK_PAGE_TOKEN     = '';
var FACEBOOK_GRAPH_VERSION  = 'v25.0'; // актуальная версия на момент написания; проверяй на developers.facebook.com/docs/graph-api/changelog ближе к моменту включения FB (после App Review)

var EVENTS_SHEET_NAME        = 'Events';
var REGISTRATIONS_SHEET_NAME = 'Registrations';
var SPREADSHEET_ID           = 'ID_ЭТОЙ_ТАБЛИЦЫ'; // из URL таблицы

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
  var get = function (col) { return sheet.getRange(row, headerMap[col]).getValue(); };
  var set = function (col, val) { sheet.getRange(row, headerMap[col]).setValue(val); };

  // Защита от двойной публикации при случайном повторном Trigger_Sync.
  // Если событие уже синхронизировано (Calendar_Link заполнен) и это не ручной retry —
  // молча восстанавливаем Status=Active и выходим. Двойной пост в Telegram и Calendar не нужен.
  if (!forceRetry && headerMap['Calendar_Link'] && get('Calendar_Link')) {
    set('Status', 'Active');
    set('Sync_Error', '');
    return;
  }

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

  var isFree = (Number(price) === 0);
  var tallyUrl = 'https://tally.so/r/' + TALLY_FORM_ID +
    '?event_id=' + encodeURIComponent(eventId) +
    '&title=' + encodeURIComponent(title) +
    '&category=' + encodeURIComponent(category) +
    '&community=' + encodeURIComponent(community) +
    '&price=' + encodeURIComponent(price) +
    '&is_free=' + (isFree ? '1' : '0');
  set('Tally_Form_URL', tallyUrl);

  var ce = colorAndEmoji(category, community);
  // Corporate — внутренний учёт (B2B-бронирование, не публичное событие).
  // Раньше единственной защитой было "не ставь Trigger_Sync для Corporate" — ручная
  // дисциплина, которая рано или поздно нарушится. Теперь Corporate идёт через тот же
  // единый вход Trigger_Sync, что и всё остальное, а публичные каналы подавляются
  // самим кодом ниже (Calendar и админ-буфер — всегда, Telegram-канал и Facebook — нет).
  var isPublicEvent = (category !== 'Corporate');
  var errors = [];

  // --- Google Calendar ---
  try {
    var startDate = parseDate(startDT);
    var endDate   = parseDate(endDT);
    var startFormatted = formatDateForPost(startDT); // читаемая строка для сообщений
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
    // htmlLink — это ссылка для человека (закодированный eid, не годится для API-вызовов).
    // Для программного удаления события при отмене нужен raw event ID отдельно.
    if (headerMap['Calendar_Event_ID']) set('Calendar_Event_ID', created.id);
  } catch (err) {
    errors.push('Calendar: ' + err.message);
  }

  // --- Telegram: пост в канал (пропускаем для Corporate — это не публичное событие) ---
  if (isPublicEvent) {
    try {
      var channelText = ce.emoji + ' <b>' + escapeHtml(title) + '</b>\n\n' +
        '📍 ' + escapeHtml(locationName) + '\n' +
        '🗓 ' + startFormatted + '\n' +
        '💰 ' + price + ' Kč\n\n' +
        escapeHtml(description);
      var tgResp = sendTelegramMessage(TELEGRAM_CHANNEL_ID, channelText, tallyUrl, '📝 Записаться');
      set('Telegram_Post_ID', (tgResp && tgResp.result) ? tgResp.result.message_id : '');
    } catch (err) {
      errors.push('Telegram channel: ' + err.message);
    }
  }

  // --- Telegram: буфер админу (WhatsApp + Facebook-черновик) — всегда, даже для Corporate,
  //     админ должен знать про событие в любом случае, просто без публичной части ---
  try {
    var bufferText = isPublicEvent
      ? '=== WhatsApp (вставить как есть) ===\n' +
        ce.emoji + ' ' + title + '\n' + startFormatted + ', ' + locationName + '\n' +
        paymentPhrase(category, isFree, price) +
        '\nРегистрация: ' + tallyUrl
      : '=== Corporate (внутреннее, НЕ публикуется) ===\n' +
        title + '\n' + startFormatted + ', ' + locationName + '\n' +
        'Событие добавлено в календарь для учёта. Публичного анонса не было — это ожидаемо.';

    if (isPublicEvent && !FACEBOOK_ENABLED) {
      bufferText += '\n\n=== Facebook (вставить вручную, автопостинг выключен) ===\n' +
        title + ' — ' + community + '\n' + description + '\n' +
        'Когда: ' + startFormatted + '\nГде: ' + locationName + '\n' +
        paymentPhrase(category, isFree, price) + '\n' +
        'Регистрация: ' + tallyUrl + '\nВсе события: ' + CALENDAR_PUBLIC_LINK;
    }
    sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, bufferText, null, null);
  } catch (err) {
    errors.push('Telegram admin buffer: ' + err.message);
  }

  // --- Facebook (только если включено И событие публичное) ---
  if (isPublicEvent && FACEBOOK_ENABLED) {
    try {
      var fbText = title + ' — ' + community + '\n' + description + '\n' +
        'Когда: ' + startFormatted + '\nГде: ' + locationName + '\n' +
        paymentPhrase(category, isFree, price) + '\n' +
        'Регистрация: ' + tallyUrl + '\nВсе события: ' + CALENDAR_PUBLIC_LINK;
      postToFacebookPage(fbText);
    } catch (err) {
      errors.push('Facebook: ' + err.message);
    }
  }

  // --- Финал ---
  set('Last_Synced_At', new Date());
  if (errors.length > 0) {
    set('Sync_Error', errors.join(' | '));
    // Status умышленно НЕ трогаем — остаётся Trigger_Sync, видно что цикл не закрылся чисто
  } else {
    set('Status', 'Active');
    set('Sync_Error', '');
    // Инвалидируем кэш doGet — сайт покажет новое событие при следующем открытии,
    // не ждёт истечения SITE_EVENTS_CACHE_SECONDS (5 мин)
    try { CacheService.getScriptCache().remove('site_events_json'); } catch (e) {}
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
  return JSON.parse(resp.getContentText());
}

function postToFacebookPage(message) {
  var url = 'https://graph.facebook.com/' + FACEBOOK_GRAPH_VERSION + '/' + FACEBOOK_PAGE_ID + '/feed';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: { message: message, access_token: FACEBOOK_PAGE_TOKEN },
    muteHttpExceptions: true
  });
  var json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json;
}

// ====================== СЦЕНАРИЙ 3: ПУБЛИЧНЫЙ API СОБЫТИЙ ДЛЯ САЙТА ======================
// GET-запрос на тот же Web App URL (без секрета — это публичные данные, которые и так
// видны в Telegram-канале и в публичном календаре). Отдаёт ближайшие Active-события,
// сайт сам решает, какой картинкой и как их показать (см. index.html).
//
// Формат ответа — JSONP (?callback=имяФункции), а не обычный fetch()+JSON.
// Причина: Apps Script Web App в реальности отвечает HTTP-редиректом на
// script.googleusercontent.com, и есть задокументированные случаи, когда заголовок
// Access-Control-Allow-Origin не переживает этот внутренний редирект при кросс-доменном
// fetch() из браузера. Загрузка через <script src="..."> (JSONP) в принципе не подчиняется
// политике CORS — это не запасной вариант "на всякий случай", а основной маршрут.
function doGet(e) {
  var callback = e.parameter.callback;

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
    return respond(JSON.stringify({ events: [], error: String(err) }));
  }
}

// ====================== СЦЕНАРИЙ 2: ПРИЁМ РЕГИСТРАЦИЙ (Tally → Web App) ======================
function doPost(e) {
  try {
    if (e.parameter.secret !== TALLY_WEBHOOK_SECRET) {
      return ContentService.createTextOutput('forbidden').setMimeType(ContentService.MimeType.TEXT);
    }

    var data = JSON.parse(e.postData.contents);
    var submissionId = (data.data && data.data.submissionId) || '';
    var byLabel = {};
    (data.data && data.data.fields || []).forEach(function (f) { byLabel[f.label] = f.value; });

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(REGISTRATIONS_SHEET_NAME);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var submissionCol = headers.indexOf('Submission_ID');

    // Tally повторяет доставку вебхука (через 5мин/30мин/1ч/6ч/1день), если не получила
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
    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('doPost: ' + err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
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

  // Сравниваем календарные даты (Europe/Prague), а не смещение в часах от текущего момента.
  // Раньше окно было "+44ч...+52ч от now" — при ежедневном триггере в 10:00 это на самом деле
  // ловило события ПОСЛЕЗАВТРА (Ч+2), а не завтра, при этом текст сообщения говорил "завтра".
  // Сравнение по календарным суткам не зависит от того, в какой час дня сработал триггер
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
      '📍 ' + escapeHtml(locationName) +
      (locationAddr ? '\n📌 ' + escapeHtml(locationAddr) : '') + '\n' +
      '🕐 ' + startStr + '\n' +
      '💰 ' + paymentPhrase(category, isFree, price) + '\n' +
      '\n🗓 <a href="' + calLink + '">Добавить в календарь</a>';

    try {
      sendTelegramMessage(TELEGRAM_CHANNEL_ID, reminderText,
        tallyUrl || null,
        tallyUrl ? '📝 Ещё не записался?' : null);
    } catch (err) {
      console.error('Reminder failed for ' + title + ': ' + err);
    }
  });
}

// ====================== ОТМЕНА СОБЫТИЯ ======================
// Вызывается вручную через меню: выдели строку события → Community Hub → Отменить событие.
// Публикует объявление об отмене в Telegram и переводит Status в Archived.
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
      catch (err) { /* событие могло уже быть удалено руками — не блокируем отмену из-за этого */ }
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
      sendTelegramMessage(TELEGRAM_CHANNEL_ID, cancelText, null, null);
    }
    set('Status', 'Archived');
    set('Sync_Error', 'CANCELLED ' + new Date().toISOString());
    // Инвалидируем кэш сайта чтобы отменённое событие исчезло
    try { CacheService.getScriptCache().remove('site_events_json'); } catch (e) {}
    ui.alert(isPublicEvent
      ? 'Объявление об отмене опубликовано, событие удалено из календаря. Статус изменён на Archived.'
      : 'Событие удалено из календаря (без публичного объявления — Corporate). Статус изменён на Archived.');
  } catch (err) {
    ui.alert('Ошибка при публикации: ' + err.message);
  }
}

// ====================== ПАКЕТ РЕПЕТИТОРСТВА: ВСЕ ЗАНЯТИЯ В КАЛЕНДАРЬ РАЗОМ ======================
// Даты/время занятий согласовываются с учеником лично (не через Tally) — этот инструмент
// просто разом создаёт все N событий в календаре, а не по одному вручную.
function createTutoringPackageEvents() {
  var ui = SpreadsheetApp.getUi();

  var labelResp = ui.prompt('Пакет репетиторства',
    'Имя ученика и предмет (например: "Иван — английский, пакет 10"):',
    ui.ButtonSet.OK_CANCEL);
  if (labelResp.getSelectedButton() !== ui.Button.OK) return;
  var label = labelResp.getResponseText().trim();
  if (!label) { ui.alert('Не указано имя/предмет — отменено.'); return; }

  var datesResp = ui.prompt('Даты занятий',
    'Через запятую, формат ГГГГ-ММ-ДД ЧЧ:ММ\nПример: 2026-07-10 15:00, 2026-07-14 15:00, 2026-07-17 15:00',
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
        end:   { dateTime: toRFC3339(end),   timeZone: 'Europe/Prague' },
        colorId: 6 // Tangerine — репетиторство, отдельно от цветов клубных событий
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
      // Поля опекуна — тоже персональные данные (родителя), чистим вместе с остальными
      if (headerMap['Guardian_Name'])  sheet.getRange(i + 1, headerMap['Guardian_Name']).setValue('—');
      if (headerMap['Guardian_Phone']) sheet.getRange(i + 1, headerMap['Guardian_Phone']).setValue('—');
    }
  }
}
