/**
 * Event RSVP adapter for the EXISTING Community Hub workbook.
 * Install as a NEW file in the existing Apps Script project next to Code.gs.
 * Not a second CRM. No payment confirmation or sports waiver is inferred from RSVP.
 * Run setupEventRsvp() once as the account owner, then verify with TEST data.
 *
 * Permissions: Forms, Sheets, Script triggers. Service reminders to people are
 * intentionally NOT sent automatically in v1.
 */
var EVENT_RSVP_FORM_PROPERTY = 'EVENT_RSVP_FORM_ID';
var EVENT_RSVP_TZ = 'Europe/Prague';

function eventRsvpClean_(input) {
  var value = String(input == null ? '' : input).trim().slice(0, 300);
  // A form answer is untrusted: never let it become a Sheet formula.
  return /^[=+@-]/.test(value) ? "'" + value : value;
}

function eventRsvpNorm_(input) {
  return String(input || '').trim().replace(/^'/, '').toLowerCase().replace(/\s+/g, '');
}

function eventRsvpTime_(value) {
  if (value instanceof Date) return value;
  return new Date(String(value || '').replace(' ', 'T'));
}

function eventRsvpLabel_(item) {
  return Utilities.formatDate(item.date, EVENT_RSVP_TZ, 'dd.MM.yyyy HH:mm') +
    ' | ' + item.title + ' [' + item.id + ']';
}

function eventRsvpItems_() {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
  var data = sh.getDataRange().getValues();
  var h = data[0], at = function(name) { return h.indexOf(name); }, output = [];
  var now = Date.now(), end = now + 65 * 86400000;
  for (var i = 1; i < data.length; i++) {
    var row = data[i], id = String(row[at('Event_ID')] || '').trim();
    var date = eventRsvpTime_(row[at('Start_DateTime')]);
    if (!id || !['Active', 'Trigger_Sync'].includes(row[at('Status')]) || row[at('Category')] === 'Corporate') continue; // Trigger_Sync: prefilled link must exist before first event announcement.
    if (!isFinite(date.getTime()) || date.getTime() < now || date.getTime() > end) continue;
    output.push({
      id: id, date: date, title: String(row[at('Title')]),
      row: i + 1, price: Number(row[at('Price_CZK')] || 0),
      category: String(row[at('Category')] || '')
    });
  }
  output.sort(function(a,b) { return a.date - b.date; });
  return output;
}

function eventRsvpQuestion_(form, title) {
  var items = form.getItems();
  for (var i = 0; i < items.length; i++) if (items[i].getTitle() === title) return items[i];
  throw new Error('Missing RSVP question: ' + title);
}

function setupEventRsvp() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(EVENT_RSVP_FORM_PROPERTY);
  var form;
  if (id) {
    form = FormApp.openById(id);
  } else {
    form = FormApp.create('Potvrzení účasti / Event RSVP — BrnoWalkers & Družina Moravy');
    form.setDescription(
      'CZ: Vyberte KONKRÉTNÍ termín, jméno, kontakt a zda přijdete. ' +
      'EN: Select a SPECIFIC event, your name, reply contact and Yes/Maybe/No. ' +
      'RU: Выберите КОНКРЕТНОЕ мероприятие, имя, контакт и ответ Да/Возможно/Нет. ' +
      'UA: Оберіть КОНКРЕТНУ подію, ім’я, контакт і Так/Можливо/Ні. ' +
      'RSVP is not proof of payment, insurance, a reserved place or clearance for contact sports. ' +
      'For minors, guardian approval and event-specific safety rules are checked separately.'
    );
    form.setConfirmationMessage(
      'RSVP recorded. An organiser may confirm the exact meeting point or further steps separately. ' +
      'To change your answer, submit this form again using the SAME name, contact and event.'
    );
    form.setCollectEmail(false);
    form.setLimitOneResponsePerUser(false);
    form.addListItem().setTitle('Event').setRequired(true)
      .setHelpText('CZ Termín | EN Date | RU Дата | UA Дата');
    form.addTextItem().setTitle('Full_Name').setRequired(true)
      .setHelpText('CZ Jméno a příjmení | EN Full name | RU Имя и фамилия | UA Ім’я та прізвище');
    form.addTextItem().setTitle('Reply_Contact').setRequired(true)
      .setHelpText('Email, phone/WhatsApp or Telegram @username — for EVENT logistics only.');
    form.addMultipleChoiceItem().setTitle('RSVP_Answer').setRequired(true)
      .setChoiceValues(['YES - I plan to come', 'MAYBE - not sure yet', 'NO - cannot come'])
      .setHelpText('CZ Půjdu / Možná / Nepůjdu | RU Иду / Возможно / Не иду | UA Йду / Можливо / Не йду');
    form.addMultipleChoiceItem().setTitle('Age_Group').setRequired(true)
      .setChoiceValues(['18+', 'Under 18'])
      .setHelpText('Minors require guardian and event-specific consent.');
    form.addTextItem().setTitle('Guardian_Name').setRequired(false)
      .setHelpText('Required before any minor is admitted.');
    form.addTextItem().setTitle('Guardian_Contact').setRequired(false)
      .setHelpText('Required before any minor is admitted.');
    form.addCheckboxItem().setTitle('Privacy_Ack').setRequired(true)
      .setChoiceValues([
        'I understand my name, event and reply contact will be used for event coordination, not marketing. ' +
        'I can request deletion at chereshnev.biochem@gmail.com.'
      ]);
    props.setProperty(EVENT_RSVP_FORM_PROPERTY, form.getId());
  }

  // Idempotent triggers: a second setup never creates duplicate listeners.
  var handlers = ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction(); });
  if (handlers.indexOf('onEventRsvpSubmit') < 0) {
    ScriptApp.newTrigger('onEventRsvpSubmit').forForm(form).onFormSubmit().create();
  }
  if (handlers.indexOf('syncEventRsvp') < 0) {
    ScriptApp.newTrigger('syncEventRsvp').timeBased().everyDays(1).atHour(8).create();
  }
  if (handlers.indexOf('cleanupEventRsvp') < 0) {
    ScriptApp.newTrigger('cleanupEventRsvp').timeBased().everyDays(1).atHour(9).create();
  }
  syncEventRsvp();
  Logger.log('RSVP published URL: ' + form.getPublishedUrl());
  return form.getPublishedUrl();
}

function syncEventRsvp() {
  var id = PropertiesService.getScriptProperties().getProperty(EVENT_RSVP_FORM_PROPERTY);
  if (!id) return 'NOT_CONFIGURED';
  var form = FormApp.openById(id);
  var items = eventRsvpItems_();
  if (!items.length) { form.setAcceptingResponses(false); return 'NO_UPCOMING_ACTIVE_EVENTS'; }
  var q = eventRsvpQuestion_(form, 'Event').asListItem();
  q.setChoiceValues(items.map(eventRsvpLabel_));
  form.setAcceptingResponses(true);

  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var linkCol = h.indexOf('Tally_Form_URL') + 1;
  if (!linkCol) throw new Error('Missing canonical Events.Tally_Form_URL column');

  items.forEach(function(item) {
    var prefill = form.createResponse()
      .withItemResponse(q.createResponse(eventRsvpLabel_(item))).toPrefilledUrl();
    var cell = sh.getRange(item.row, linkCol);
    if (cell.getValue() !== prefill) cell.setValue(prefill);
  });
  return 'UPDATED_ACTIVE_EVENTS=' + items.length;
}

function eventRsvpPrefilledUrl(eventId) {
  var formId = PropertiesService.getScriptProperties().getProperty(EVENT_RSVP_FORM_PROPERTY);
  if (!formId) return '';
  var form = FormApp.openById(formId);
  var q = eventRsvpQuestion_(form, 'Event').asListItem();
  var items = eventRsvpItems_();
  var found = items.filter(function(x) { return x.id === String(eventId); })[0];
  if (!found) return '';
  // The current Trigger_Sync event may be NEW and absent from yesterday's
  // Google Form dropdown: update choices BEFORE generating the announcement URL.
  q.setChoiceValues(items.map(eventRsvpLabel_));
  return form.createResponse().withItemResponse(q.createResponse(eventRsvpLabel_(found))).toPrefilledUrl();
}

function onEventRsvpSubmit(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!e || !e.response) throw new Error('Missing Form submit event');
    var byTitle = {};
    e.response.getItemResponses().forEach(function(ir) {
      byTitle[ir.getItem().getTitle()] = ir.getResponse();
    });
    if (!byTitle.Privacy_Ack || !byTitle.Privacy_Ack.length) return;
    var match = /\[([A-Za-z0-9-]+)\]$/.exec(String(byTitle.Event || ''));
    if (!match) throw new Error('RSVP Event_ID could not be read');
    var eventId = match[1], name = String(byTitle.Full_Name || '').trim();
    var contact = String(byTitle.Reply_Contact || '').trim();
    if (!name || !contact) throw new Error('Missing name/contact');

    // Never accept an arbitrary event code or an obsolete choice.
    var ev = eventRsvpItems_().filter(function(x) { return x.id === eventId; })[0];
    if (!ev) throw new Error('Event is cancelled, outdated or not in the active calendar: ' + eventId);
    var answer = String(byTitle.RSVP_Answer || '');
    var status = /^YES\b/.test(answer) ? 'CONFIRMED' :
      /^MAYBE\b/.test(answer) ? 'MAYBE' : /^NO\b/.test(answer) ? 'DECLINED' : '';
    if (!status) throw new Error('Invalid RSVP answer');
    var minor = byTitle.Age_Group === 'Under 18';
    if (minor && status === 'CONFIRMED') {
      status = 'REGISTERED'; // Guardian details alone are not VERIFIED guardian consent: human clearance required.
    }
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(REGISTRATIONS_SHEET_NAME);
    var values = sheet.getDataRange().getValues(), headers = values[0];
    var ix = function(h) { return headers.indexOf(h); };
    var target = -1, normName = eventRsvpNorm_(name), normContact = eventRsvpNorm_(contact);
    var submissionId = e.response.getId();
    for (var i = 3; i < values.length; i++) {
      var r = values[i];
      if (String(r[ix('Submission_ID')]) === submissionId) return; // Replay is harmless.
      if (String(r[ix('Event_ID')]) === eventId &&
          eventRsvpNorm_(r[ix('Reply_Contact')]) === normContact &&
          eventRsvpNorm_(r[ix('Full_Name')]) === normName) target = i + 1;
    }

    var now = new Date(), retention = new Date(ev.date.getTime() + 90 * 86400000);
    if (target > 0) {
      // Attendance and verified payment are ledger facts, not overwritten by RSVP.
      if (values[target - 1][ix('RSVP_Status')] === 'ATTENDED') {
        // A late RSVP is not allowed to reverse an actual check-in. Also avoid
        // leaving an unreferenced extra Form response full of personal data.
        try { FormApp.openById(PropertiesService.getScriptProperties().getProperty(EVENT_RSVP_FORM_PROPERTY)).deleteResponse(submissionId); }
        catch (err) { console.error('Cannot purge irrelevant late RSVP response: ' + String(err)); }
        return;
      }
      var previousSubmissionId = String(values[target - 1][ix('Submission_ID')] || '').trim();
      sheet.getRange(target, ix('RSVP_Status') + 1).setValue(status);
      sheet.getRange(target, ix('RSVP_Status_At') + 1).setValue(now);
      sheet.getRange(target, ix('Submission_ID') + 1).setValue(submissionId);
      // Preserve the latest optional guardian details without marking them independently verified.
      if (minor) {
        if (byTitle.Guardian_Name) sheet.getRange(target, ix('Guardian_Name') + 1).setValue(eventRsvpClean_(byTitle.Guardian_Name));
        if (byTitle.Guardian_Contact) sheet.getRange(target, ix('Guardian_Phone') + 1).setValue(eventRsvpClean_(byTitle.Guardian_Contact));
      }
      // Keep only the latest full Google Form response for this registration.
      // If deletion temporarily fails, cleanupEventRsvp also scans all old
      // responses by event + contact before anonymizing the canonical row.
      if (previousSubmissionId && previousSubmissionId !== submissionId) {
        try { FormApp.openById(PropertiesService.getScriptProperties().getProperty(EVENT_RSVP_FORM_PROPERTY)).deleteResponse(previousSubmissionId); }
        catch (err) { console.error('Old RSVP Form response deletion needs retry: ' + String(err)); }
      }
    } else {
      var record = {};
      record.Reg_ID = Utilities.getUuid();
      record.Event_ID = eventId;
      record.Timestamp = now;
      record.Full_Name = eventRsvpClean_(name);
      record.Telegram_Handle = /^@/.test(contact) ? eventRsvpClean_(contact) : '';
      record.Phone_Number = /^\+?\d[\d() .-]{7,}$/.test(contact) ? eventRsvpClean_(contact) : '';
      record.Age = minor ? 'Under 18' : '18+';
      record.Guardian_Name = eventRsvpClean_(byTitle.Guardian_Name);
      record.Guardian_Phone = eventRsvpClean_(byTitle.Guardian_Contact);
      record.Waiver_Accepted = ''; // An RSVP is NOT a legal/safety waiver.
      record.Photo_Consent = ''; // Not requested, not presumed.
      record.Payment_Reference = '';
      record.Retention_Until = retention;
      record.Submission_ID = submissionId;
      record.RSVP_Status = status;
      record.RSVP_Status_At = now;
      record.Payment_Status = ev.price === 0 ? 'NOT_REQUIRED' : 'PENDING';
      record.Reply_Contact = eventRsvpClean_(contact);
      record.Source_Channel = 'RSVP_FORM';
      var nextRow = Math.max(4, sheet.getLastRow() + 1);
      sheet.getRange(nextRow, 1, 1, headers.length)
        .setValues([headers.map(function(h) { return record[h] == null ? '' : record[h]; })]);
    }
  } catch (err) {
    console.error('onEventRsvpSubmit: ' + String(err));
    throw err; // Make failed submissions visible to the script owner.
  } finally {
    lock.releaseLock();
  }
}

/**
 * GDPR retention for RSVP Form responses: both the canonical Sheet and the
 * Form responses must be purged. Other financial ledgers stay separate.
 * Any failed Form deletion is logged and retried; never silently claim purge.
 */
function cleanupEventRsvp() {
  var formId = PropertiesService.getScriptProperties().getProperty(EVENT_RSVP_FORM_PROPERTY);
  if (!formId) return 'NOT_CONFIGURED';
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var form = FormApp.openById(formId);
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REGISTRATIONS_SHEET_NAME);
    var rows = sheet.getDataRange().getValues(), headers = rows[0];
    var col = function(name) { return headers.indexOf(name); };
    var required = ['Event_ID', 'Retention_Until', 'Source_Channel', 'Submission_ID', 'Full_Name', 'Reply_Contact'];
    required.forEach(function(h) { if (col(h) < 0) throw new Error('Missing column ' + h); });
    // Form stores every re-submission independently. Build a key index so the
    // GDPR purge catches even older Google Form responses no longer referenced
    // by the most recent Submission_ID stored in Registrations.
    var formResponseIndex = {};
    form.getResponses().forEach(function(response) {
      var fields = {};
      response.getItemResponses().forEach(function(ir) {
        fields[ir.getItem().getTitle()] = ir.getResponse();
      });
      var match = /\[([A-Za-z0-9-]+)\]$/.exec(String(fields.Event || ''));
      if (!match) return;
      var key = [match[1], eventRsvpNorm_(fields.Full_Name), eventRsvpNorm_(fields.Reply_Contact)].join('|');
      if (!formResponseIndex[key]) formResponseIndex[key] = [];
      formResponseIndex[key].push(response.getId());
    });
    var personal = [
      'Full_Name', 'Telegram_Handle', 'Phone_Number', 'Age',
      'Guardian_Name', 'Guardian_Phone', 'Guardian_Relationship',
      'Child_Name', 'Child_Age', 'Emergency_Contact_Name', 'Emergency_Contact_Phone',
      'Medical_Conditions', 'Equipment_Note', 'Payment_Reference',
      'Reply_Contact', 'Submission_ID', 'Photo_Consent', 'Waiver_Accepted'
    ];
    var total = 0, errors = [];
    for (var i = 3; i < rows.length; i++) {
      var row = rows[i];
      if (row[col('Source_Channel')] !== 'RSVP_FORM') continue;
      var until = row[col('Retention_Until')];
      if (!until || new Date(until).getTime() > Date.now()) continue;
      var key = [String(row[col('Event_ID')] || '').trim(), eventRsvpNorm_(row[col('Full_Name')]), eventRsvpNorm_(row[col('Reply_Contact')])].join('|');
      var responseIds = (formResponseIndex[key] || []).slice();
      var responseId = String(row[col('Submission_ID')] || '').trim();
      if (responseId && responseId !== '—' && responseIds.indexOf(responseId) < 0) responseIds.push(responseId);
      var failed = false;
      responseIds.forEach(function(id) {
        try { form.deleteResponse(id); }
        catch (err) {
          // A missing response may have been purged already; inability to
          // delete a present response is a blocking privacy error.
          if (form.getResponses().some(function(r) { return r.getId() === id; })) failed = true;
        }
      });
      if (failed) {
        errors.push('row ' + (i + 1) + ': cannot delete all Form responses');
        continue;
      }
      personal.forEach(function(h) {
        if (col(h) >= 0 && row[col(h)] !== '' && row[col(h)] !== '—') {
          sheet.getRange(i + 1, col(h) + 1).setValue('—');
        }
      });
      sheet.getRange(i + 1, col('Retention_Until') + 1).setValue('');
      total++;
    }
    if (errors.length) throw new Error('RSVP deletion incomplete: ' + errors.join('; '));
    return 'PURGED=' + total;
  } finally {
    lock.releaseLock();
  }
}
