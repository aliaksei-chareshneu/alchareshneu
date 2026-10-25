/*
 * Universal event registration for the existing Community Hub Apps Script.
 * Deploy ONLY after review in the already-bound Apps Script project.
 * Never expose Spreadsheet IDs, private CRM data or credentials in client HTML.
 * Does not change legacy Tally doPost or the public JSONP event feed.
 */
var PORTAL_TZ = 'Europe/Prague';
var PORTAL_VERSION = '2026-10-25-v1';
var PORTAL_BASE = 'https://aliaksei-chareshneu.github.io/alchareshneu/';
var PORTAL_SOURCE = 'WEBSITE_RSVP';

function regpPage(e) {
  var template = HtmlService.createTemplateFromFile('RegistrationPortal');
  var wanted = String(e && e.parameter && e.parameter.event || '');
  template.initialEventId = /^[A-Za-z0-9-]{2,100}$/.test(wanted) ? wanted : '';
  template.initialLanguage = /^(en|cs|ru|uk)$/.test(String(e && e.parameter && e.parameter.lang || ''))
    ? String(e.parameter.lang) : 'en';
  return template.evaluate().setTitle('Event registration | BrnoWalkers & Družina Moravy')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function regpDate_(value) {
  if (value instanceof Date) return value;
  var match = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]));
  return new Date(value);
}

function regpEvents_() {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(EVENTS_SHEET_NAME);
  if (!sh) throw new Error('Event registry is unavailable');
  var data = sh.getDataRange().getValues();
  var headers = data[0] || [];
  var cols = ['Event_ID','Status','Category','Community','Title','Start_DateTime',
    'Location_Name','Price_CZK','Registration_Mode','Data_Controller','Rules_URL'];
  cols.forEach(function (n) { if (headers.indexOf(n) < 0) throw new Error('Missing Events.' + n); });
  var at = function (row, n) { return row[headers.indexOf(n)]; };
  var now = Date.now(), until = now + 400 * 86400000;
  var events = [];
  data.slice(1).forEach(function (row) {
    var id = String(at(row, 'Event_ID') || '').trim();
    var dt = regpDate_(at(row, 'Start_DateTime'));
    var category = String(at(row, 'Category') || '');
    var controller = String(at(row, 'Data_Controller') || '').trim();
    if (!/^[A-Za-z0-9-]{2,100}$/.test(id) || String(at(row, 'Status')) !== 'Active'
        || String(at(row, 'Registration_Mode')).toUpperCase() !== 'OPEN'
        || category === 'Corporate' || !controller || !isFinite(dt.getTime())
        || dt.getTime() <= now || dt.getTime() > until) return;
    var rulesUrl = String(at(row, 'Rules_URL') || '');
    if (!/^https:\/\/aliaksei-chareshneu\.github\.io\/alchareshneu\/[^\s]+$/.test(rulesUrl)) {
      rulesUrl = PORTAL_BASE + 'register/safety/';
    }
    var isContact = /HEMA|LARP|Combat|Archery|Battle/i.test(category);
    // Contact activities must have their specific safety URL explicitly reviewed.
    if (isContact && !/\/druzina\/(safety|rules)\//.test(rulesUrl)) return;
    var price = at(row, 'Price_CZK');
    events.push({
      id:id, title:String(at(row, 'Title') || '').slice(0,180),
      community:String(at(row, 'Community') || '').slice(0,100),
      category:category.slice(0,80),
      date:Utilities.formatDate(dt, PORTAL_TZ, 'EEE, d MMM yyyy · HH:mm'),
      location:String(at(row, 'Location_Name') || '').slice(0,180),
      price:price === '' || price === null ? 'Check event details' :
        (Number(price) === 0 ? 'Free' : String(price) + ' Kč (subject to confirmation)'),
      dataController:controller.slice(0,180), rulesUrl:rulesUrl,
      additionalSafety:isContact,sortKey:dt.getTime()
    });
  });
  events.sort(function(a,b){ return a.sortKey - b.sortKey; });
  events.forEach(function(item){ delete item.sortKey; });
  return events;
}

function regpLive_() {
  return PropertiesService.getScriptProperties().getProperty('UNIVERSAL_PORTAL_LIVE') === 'true';
}

function regpGetEvents() {
  if (!regpLive_()) return {events:[],version:PORTAL_VERSION,notLive:true};
  return {events:regpEvents_(),version:PORTAL_VERSION};
}

function regpClean_(value, maxLength) {
  var clean = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  clean = clean.replace(/\s+/g, ' ').slice(0, maxLength || 200);
  return /^[=+\-@]/.test(clean) ? "'" + clean : clean;
}

function regpEmail_(value) {
  var email = String(value || '').trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    throw new Error('Please enter a valid email address');
  return email;
}

function regpPhone_(value) {
  var phone = String(value || '').trim();
  var digits = phone.replace(/\D/g, '');
  if (phone.length > 35 || digits.length < 7 || digits.length > 15
      || !/^\+?[\d\s().-]+$/.test(phone)) throw new Error('Please enter a valid phone number');
  return phone;
}

function regpSubmit(payload) {
  if (!regpLive_()) throw new Error('Registrations are not open yet');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid form data');
  if (payload.website) return {ok:true,recorded:false}; // invisible anti-bot honeypot
  var id = String(payload.eventId || '');
  var ev = regpEvents_().filter(function(x){return x.id === id;})[0];
  if (!ev) throw new Error('Registration is closed or the event is not available');
  var first = regpClean_(payload.firstName, 80);
  var last = regpClean_(payload.lastName, 80);
  if (first.length < 2 || last.length < 2) throw new Error('First name and surname are required');
  var email = regpEmail_(payload.email), phone = regpPhone_(payload.phone);
  var isMinor = payload.ageGroup === 'under18';
  if (payload.ageGroup !== 'adult' && !isMinor) throw new Error('Choose your age group');
  var guardianName = isMinor ? regpClean_(payload.guardianName, 160) : '';
  if (isMinor && guardianName.length < 3) throw new Error('Guardian name is required for minors');
  var guardianPhone = isMinor ? regpPhone_(payload.guardianPhone) : '';
  if (payload.safety !== true) throw new Error('Please read and acknowledge the safety rules');
  var photo = String(payload.photo || 'NO');
  if (photo !== 'YES' && photo !== 'NO') throw new Error('Please choose a photo-permission option');
  // A minor cannot grant publicity permission without verified guardian approval.
  if (isMinor) photo = 'NO';
  var rsvp = String(payload.rsvp || '');
  if (['YES','MAYBE','NO'].indexOf(rsvp) < 0) throw new Error('Please select your attendance');
  var market = !isMinor && payload.futureUpdates === true; // Minors cannot independently opt into invitations.
  var locale = ['en','cs','ru','uk'].indexOf(payload.language) >= 0 ? payload.language : 'en';
  var name = first.replace(/^'/,'') + ' ' + last.replace(/^'/,'');
  var status = rsvp === 'NO' ? 'DECLINED' : rsvp === 'MAYBE' ? 'MAYBE' : 'REGISTERED'; // Organizer approval is separate.
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var eventsSheet = ss.getSheetByName(EVENTS_SHEET_NAME);
  var erows = eventsSheet.getDataRange().getValues(), eh=erows[0];
  var erow=erows.slice(1).filter(function(row){return String(row[eh.indexOf('Event_ID')])===id;})[0];
  if (!erow || String(erow[eh.indexOf('Status')]) !== 'Active'
      || String(erow[eh.indexOf('Registration_Mode')]).toUpperCase() !== 'OPEN')
      throw new Error('This event is not accepting registrations');
  var eventDate=regpDate_(erow[eh.indexOf('Start_DateTime')]);
  var sh = ss.getSheetByName(REGISTRATIONS_SHEET_NAME);
  var values = sh.getDataRange().getValues(), heads=values[0]||[];
  var required = ['Reg_ID','Event_ID','Timestamp','Full_Name','Phone_Number','Photo_Consent',
    'Retention_Until','Submission_ID','RSVP_Status','RSVP_Status_At','Payment_Status',
    'Reply_Contact','Source_Channel','Email','First_Name','Last_Name','Safety_Acknowledged',
    'Rules_Version','Consent_Recorded_At','Marketing_Consent','Marketing_Consent_At',
    'Data_Controller','Registration_Locale'];
  required.forEach(function(n){if(heads.indexOf(n)<0)throw new Error('CRM field missing: '+n);});
  var at=function(n){return heads.indexOf(n);};
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(12000)) throw new Error('Please try again in a moment');
  try {
    // Always re-read under lock for deduplication.
    values=sh.getDataRange().getValues();
    var target=-1;
    for(var i=3;i<values.length;i++){
      var existing=values[i];
      if(String(existing[at('Event_ID')])===id &&
          String(existing[at('Email')]||'').toLowerCase()===email &&
          String(existing[at('Full_Name')]||'').toLowerCase()===name.toLowerCase()) {
        target=i+1;break;
      }
    }
    if(target>0 && String(values[target-1][at('RSVP_Status')])==='ATTENDED')
      throw new Error('This event already has a recorded check-in. Contact the organizer');
    var now=new Date();
    var eventExpiry=new Date(eventDate.getTime()+90*86400000);
    var newsletterExpiry=new Date(now.getTime()+365*86400000);
    var retention=market && newsletterExpiry>eventExpiry?newsletterExpiry:eventExpiry;
    var old=target>0?values[target-1]:[];
    var fields={
      Event_ID:id, Full_Name:regpClean_(name,170), First_Name:first,Last_Name:last,
      Email:email,Phone_Number:phone,Age:isMinor?'Under 18':'18+',
      Guardian_Name:guardianName,Guardian_Phone:guardianPhone,
      Photo_Consent:photo==='YES'?'yes':'no',Safety_Acknowledged:'yes',
      Rules_Version:PORTAL_VERSION,Consent_Recorded_At:now,
      Marketing_Consent:market?'yes':'no',Marketing_Consent_At:market?now:'',
      Data_Controller:ev.dataController,Registration_Locale:locale,
      Retention_Until:retention,RSVP_Status:status,RSVP_Status_At:now,
      Reply_Contact:email,Source_Channel:PORTAL_SOURCE
    };
    if(target<0){
      fields.Reg_ID=Utilities.getUuid();
      fields.Timestamp=now;
      fields.Submission_ID='WEB-'+Utilities.getUuid();
      fields.Payment_Status=Number(erow[eh.indexOf('Price_CZK')])===0?'NOT_REQUIRED':'PENDING';
    }
    // A new RSVP is NOT a signed sports waiver or a verified payment.
    var out=heads.map(function(h,index){
      return Object.prototype.hasOwnProperty.call(fields,h)?fields[h]:(target>0?old[index]:'');
    });
    if(target>0)sh.getRange(target,1,1,heads.length).setValues([out]);
    else sh.getRange(Math.max(4,sh.getLastRow()+1),1,1,heads.length).setValues([out]);
    SpreadsheetApp.flush();
    return {ok:true,recorded:true,updated:target>0,reference:String(fields.Submission_ID || old[at('Submission_ID')]),
      status:status,needsGuardian:isMinor,marketingSubscribed:market,
      message:'Your RSVP was recorded. The organizer will confirm the exact terms and meeting point separately.'};
  } finally {lock.releaseLock();}
}

function cleanupUniversalRegistrations(){
  var sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REGISTRATIONS_SHEET_NAME);
  var d=sh.getDataRange().getValues(),h=d[0]||[],idx=function(n){return h.indexOf(n);};
  var personal=['Full_Name','Phone_Number','Telegram_Handle','Age','Guardian_Name',
    'Guardian_Phone','Guardian_Relationship','Child_Name','Child_Age',
    'Emergency_Contact_Name','Emergency_Contact_Phone','Medical_Conditions',
    'Equipment_Note','Photo_Consent','Waiver_Accepted','Payment_Reference',
    'Submission_ID','Reply_Contact','Email','First_Name','Last_Name',
    'Safety_Acknowledged','Rules_Version','Consent_Recorded_At',
    'Marketing_Consent','Marketing_Consent_At','Data_Controller','Registration_Locale'];
  var cleaned=0;
  for(var i=3;i<d.length;i++){
    var row=d[i];
    if(String(row[idx('Source_Channel')])!==PORTAL_SOURCE)continue;
    var until=row[idx('Retention_Until')];
    if(!until || new Date(until).getTime()>Date.now())continue;
    var written=row.slice();
    personal.forEach(function(n){var j=idx(n);if(j>=0)written[j]='';});
    written[idx('Source_Channel')]='WEBSITE_RSVP_PURGED';
    written[idx('Retention_Until')]='';
    sh.getRange(i+1,1,1,h.length).setValues([written]);
    cleaned++;
  }
  return {purged:cleaned};
}

function activateUniversalRegistration(){
  // Owner-controlled post-deployment switch: only after incognito/mobile and CRM write-read tests.
  var events = regpEvents_();
  if (!events.length) throw new Error('No currently approved OPEN event');
  PropertiesService.getScriptProperties().setProperty('UNIVERSAL_PORTAL_LIVE','true');
  try { CacheService.getScriptCache().remove('site_events_json'); } catch(e) {}
  return {live:true,approvedEventCount:events.length};
}

function pauseUniversalRegistration(){
  PropertiesService.getScriptProperties().deleteProperty('UNIVERSAL_PORTAL_LIVE');
  try { CacheService.getScriptCache().remove('site_events_json'); } catch(e) {}
  return {live:false};
}

function setupUniversalRegistration(){
  var found=ScriptApp.getProjectTriggers().some(function(t){
    return t.getHandlerFunction()==='cleanupUniversalRegistrations';
  });
  if(!found)ScriptApp.newTrigger('cleanupUniversalRegistrations').timeBased().everyDays(1).atHour(9).create();
  return {ok:true,cleanupInstalled:true,portalVersion:PORTAL_VERSION};
}
