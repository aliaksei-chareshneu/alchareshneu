/**
 * Add this as a NEW file to the EXISTING Community Hub Apps Script project.
 * Private Supabase -> existing Registrations and Druzina_Requests. Never use
 * the public Web App doGet/doPost to export attendee or guardian information.
 * Script Properties: IMPERION_INTAKE_BRIDGE_KEY, IMPERION_NOTIFY_EMAIL.
 */
var IMP_INTAKE_URL="https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-intake-bridge";

function impPrivateConfig_(){
  var p=PropertiesService.getScriptProperties();
  var key=p.getProperty('IMPERION_INTAKE_BRIDGE_KEY')||'';
  var email=p.getProperty('IMPERION_NOTIFY_EMAIL')||'';
  var sheetId=p.getProperty('IMPERION_CRM_SHEET_ID')||
    (typeof SPREADSHEET_ID!=='undefined'?SPREADSHEET_ID:'');
  if(!/^[a-f0-9]{64}$/i.test(key))throw Error('Invalid/missing private intake key');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error('Invalid/missing owner notification email; import blocked to prevent silent lost leads');
  if(!sheetId)throw Error('Missing existing CRM spreadsheet ID');
  return {key:key,email:email,sheetId:sheetId};
}
function impPrivateFetch_(config,payload){
  var opt={method:payload?'post':'get',
    headers:{Authorization:'Bearer '+config.key},
    contentType:'application/json',muteHttpExceptions:true,timeoutSeconds:25};
  if(payload)opt.payload=JSON.stringify(payload);
  var resp=UrlFetchApp.fetch(IMP_INTAKE_URL,opt),data={};
  try{data=JSON.parse(resp.getContentText()||'{}')}catch(e){}
  if(resp.getResponseCode()!==200||data.ok!==true)
    throw Error('Private intake HTTP '+resp.getResponseCode());
  return data;
}
function impHeader_(sheet){
  var names=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0],map={};
  names.forEach(function(name,i){
    if(!name)return;
    if(Object.prototype.hasOwnProperty.call(map,name))throw Error('Duplicate CRM header: '+name);
    map[name]=i;
  });
  return {names:names,map:map};
}
function impText_(v){
  if(v===null||v===undefined)return '';
  if(v instanceof Date)return v;
  var s=String(v);
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s; // prevent Sheets formula injection
}
function impDate_(v){
  if(!v)return '';
  var d=new Date(v);return isFinite(d.getTime())?d:'';
}
function impExisting_(sheet,col){
  var n=sheet.getLastRow(),seen={};
  if(n>1)sheet.getRange(2,col,n-1,1).getDisplayValues().forEach(function(r){
    if(r[0])seen[String(r[0]).trim()]=true;
  });
  return seen;
}
function impAppend_(sheet,headers,object){
  var row=headers.names.map(function(k){
    return Object.prototype.hasOwnProperty.call(object,k)?impText_(object[k]):'';
  });
  var nextRow=sheet.getLastRow()+1;
  sheet.getRange(nextRow,1,1,row.length).setValues([row]);
  // Values typed as Date must retain their time component in the CRM UI.
  // Default blank-row formatting sometimes displays DATE and silently hides hours.
  headers.names.forEach(function(k,i){
    if(row[i] instanceof Date)sheet.getRange(nextRow,i+1).setNumberFormat('dd.mm.yyyy hh:mm');
  });
  var receipt=Object.prototype.hasOwnProperty.call(object,'Submission_ID')?'Submission_ID':
    (Object.prototype.hasOwnProperty.call(object,'Request_ID')?'Request_ID':'');
  if(receipt&&headers.map[receipt]!==undefined&&
     sheet.getRange(nextRow,headers.map[receipt]+1).getDisplayValue().trim()!==String(object[receipt]))
    throw Error('CRM append readback failed: '+receipt);
}
function impWriteRsvps_(ss,items,events){
  var sh=ss.getSheetByName('Registrations');if(!sh)throw Error('Missing Registrations');
  var h=impHeader_(sh);if(h.map.Submission_ID===undefined)throw Error('Missing Submission_ID');
  var existing=impExisting_(sh,h.map.Submission_ID+1),ids=[],added=0;
  items.forEach(function(r){
    var id=String(r.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid RSVP id');
    if(!existing[id]){
      // The canonical CRM validates RSVP_Status and Payment_Status. Browser intent is NOT a confirmed booking.
      var intent=String(r.rsvp_status||'');
      var states={YES:'REGISTERED',MAYBE:'MAYBE',NO:'DECLINED'};
      if(!Object.prototype.hasOwnProperty.call(states,intent))throw Error('Invalid public RSVP intent');
      var event=events&&events[String(r.event_id||'')];
      var isFree=!!(event&&event.price_verified===true&&Number(event.price_czk)===0);
      var paymentStatus=(intent==='NO'||isFree)?'NOT_REQUIRED':'PENDING';
      impAppend_(sh,h,{
        Reg_ID:'WEB-'+id,Event_ID:r.event_id||'',Timestamp:impDate_(r.created_at),
        Full_Name:[r.first_name,r.last_name].filter(Boolean).join(' '),
        Phone_Number:r.phone||'',Age:r.age_group||'',
        Guardian_Name:r.guardian_name||'',Guardian_Phone:r.guardian_phone||'',
        Photo_Consent:r.photo_choice||'NO',
        // Public safety acknowledgement is NOT a legal waiver or release of rights.
        // Keep this field blank unless a separate, valid waiver was explicitly recorded.
        Waiver_Accepted:'',
        Retention_Until:impDate_(r.retention_until),Submission_ID:id,
        RSVP_Status:states[intent],RSVP_Status_At:impDate_(r.created_at),
        Payment_Status:paymentStatus,
        Reply_Contact:r.email||r.phone||'',
        Source_Channel:'WEBSITE_RSVP_SUPABASE_UNCONFIRMED',
        Email:r.email||'',First_Name:r.first_name||'',Last_Name:r.last_name||'',
        Safety_Acknowledged:r.safety_acknowledged===true?'YES':'NO',
        Rules_Version:r.safety_version||'',Consent_Recorded_At:impDate_(r.created_at),
        Marketing_Consent:r.marketing_requested===true?'REQUESTED_UNCONFIRMED':'NO',
        Data_Controller:r.data_controller||'',Registration_Locale:r.language||'',
        Receipt_Status:'PENDING',Receipt_Attempts:0,Receipt_Locale:r.language||'cs'
      });
      existing[id]=true;added++;
    }
    ids.push(id);
  });
  return {ids:ids,added:added};
}
function impWriteEnquiries_(ss,items){
  var sh=ss.getSheetByName('Druzina_Requests');if(!sh)throw Error('Missing Druzina_Requests');
  var h=impHeader_(sh);if(h.map.Request_ID===undefined)throw Error('Missing Request_ID');
  var existing=impExisting_(sh,h.map.Request_ID+1),ids=[],added=0;
  items.forEach(function(r){
    var id=String(r.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid enquiry id');
    var key='ENQ-'+id;
    if(!existing[key]){
      var contact=String(r.contact||''),byEmail=r.contact_kind==='EMAIL'||contact.includes('@');
      impAppend_(sh,h,{
        Request_ID:key,Timestamp:impDate_(r.created_at),
        Request_Type:r.visit_type==='RETURNING'?'RETURNING_TRAINING_ENQUIRY':'FIRST_TRAINING_ENQUIRY',
        Full_Name:[r.first_name,r.last_name].filter(Boolean).join(' '),
        Email:byEmail?contact:'',Phone:byEmail?'':contact,
        Requested_Dates:r.preferred_date||'',Preferred_Days:r.preferred_day||'',
        Payment_Declared:'NO',Processing_Status:'RECEIVED_UNCONFIRMED',
        Notes:'Website enquiry only. Safety acknowledged; no booking or payment confirmed.',
        Receipt_Status:byEmail?'PENDING':'ONSCREEN_ONLY',Receipt_Attempts:0,Receipt_Locale:r.language||'cs'
      });
      existing[key]=true;added++;
    }
    ids.push(id);
  });
  return {ids:ids,added:added};
}

/** OSVC corporate enquiries are added to the EXISTING Leads tab, never to the NGO member table. */
function impWriteB2B_(ss,items){
  var sh=ss.getSheetByName('Leads');if(!sh)throw Error('Missing Leads');
  var h=impHeader_(sh);
  ['Lead_ID','Submission_ID','Stage','Source','Service','Owner','Action_Status'].forEach(function(k){
    if(h.map[k]===undefined)throw Error('Missing Leads header: '+k);
  });
  var existing=impExisting_(sh,h.map.Submission_ID+1),ids=[],added=0;
  items.forEach(function(r){
    var id=String(r.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid B2B id');
    var key='OSVC-B2B-'+id;
    if(!existing[key]){
      var offer=String(r.offer||''),allowed={
        AI_WORKSHOP:'IT/Science',DATA_PILOT:'IT/Science',
        SCIENTIFIC_CONSULTING:'IT/Science',HEMA_CORPORATE:'Other'
      };
      if(!Object.prototype.hasOwnProperty.call(allowed,offer))throw Error('Invalid B2B offer');
      var band=String(r.budget_band||'unknown');
      var priority=band==='70000+'||band==='30000-70000'?'P1':'P2';
      var created=impDate_(r.created_at),expire=impDate_(r.retention_until);
      if(!created||!expire)throw Error('Invalid B2B timestamp/retention');
      var notes='Unconfirmed OSVC website enquiry (not NGO membership); no contract, booking, invoice or CASH. '+
        'Company: '+String(r.company||'')+'; Offer: '+offer+
        '; Budget: '+band+' CZK; Team size: '+String(r.team_size||'not supplied')+
        '; Preferred timeframe: '+String(r.preferred_timeframe||'not supplied')+
        '; Tracking source: '+String(r.source||'corporate_website')+
        '; Privacy notice accepted for enquiry only. No marketing permission.';
      impAppend_(sh,h,{
        Lead_ID:'B2B-'+id,Created_At:created,
        Full_Name:[r.company,r.contact_name].filter(Boolean).join(' — '),
        Email:r.email||'',Phone_Number:r.phone||'',
        Source:'Website',Service:allowed[offer],
        Subject_Goal:String(r.summary||''),Language:'unknown',Format:'Flexible',Stage:'New',
        Expected_Value_CZK:'',Next_Action_At:new Date(Date.now()+86400000),
        Last_Contact_At:'',Followup_Count:0,Paid_CZK:0,Owner:'Aliaksei',
        Notes:notes,Submission_ID:key,Retention_Until:expire,
        Last_Automation_At:new Date(),Action_Status:'OSVC_B2B_INBOUND_REVIEW_NO_ORDER_NO_CASH',
        Priority:priority,
        Receipt_Status:'PENDING',Receipt_Attempts:0,Receipt_Locale:'en'
      });
      existing[key]=true;added++;
    }
    ids.push(id);
  });
  return {ids:ids,added:added};
}


/** Transactional applicant receipts: no marketing, no booking or payment. */
var IMP_RC_COLS=['Receipt_Status','Receipt_Attempts','Receipt_Sent_At','Receipt_Locale'];
function impEnsureReceiptCols_(sheet){
 if(!sheet)throw Error('Missing canonical CRM sheet');
 var h=impHeader_(sheet);
 IMP_RC_COLS.forEach(function(name){
  if(h.map[name]!==undefined)return;
  var col=sheet.getLastColumn()+1;
  if(col>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),1);
  sheet.getRange(1,col).setValue(name);h.map[name]=col-1;
 });
}
function impReceiptWords_(lang){
 var all={
 cs:['Přijali jsme vaši žádost','Přijali jsme vaši nezávaznou žádost.','Číslo žádosti','Akce / služba','Datum a čas','Místo / sraz','Uvedená cena','Preferovaný termín','Účast, datum, místo i případnou platbu musí potvrdit pořadatel. Do té doby nejezděte a neplaťte.','Bez vlastního šermířského vybavení. Pravidla:','Žádné marketingové zprávy; na tento e-mail můžete odpovědět.','Poptávka není objednávka, smlouva ani přijetí ceny.'],
 en:['We received your request','Your non-binding request has been recorded.','Request reference','Event / service','Date and time','Venue / meeting point','Listed price','Preferred day','Attendance, date, venue and any payment require personal confirmation. Do not travel or pay before confirmation.','No personal fencing gear needed. Safety rules:','No marketing messages. You can reply to this email.','Enquiry is not a purchase order, contract or accepted price.'],
 ru:['Ваша заявка получена','Ваша предварительная заявка сохранена.','Номер обращения','Мероприятие / услуга','Дата и время','Место / встреча','Указанная цена','Предпочтительный день','Участие, время, место и условия оплаты организатор подтвердит отдельно. Не приезжайте и не платите до подтверждения.','Свой инвентарь не нужен. Правила безопасности:','Без рекламных рассылок. Можно ответить на это письмо.','Запрос не является заказом, договором или согласованной ценой.'],
 uk:['Вашу заявку отримано','Ваш попередній запит збережено.','Номер запиту','Подія / послуга','Дата й час','Місце / збір','Вказана ціна','Бажаний день','Участь, час, місце й оплату організатор підтвердить окремо. Не вирушайте й не сплачуйте до підтвердження.','Власне спорядження не потрібне. Правила безпеки:','Без рекламних розсилок. Можна відповісти на цей лист.','Запит не є замовленням, договором чи узгодженою ціною.']
 };
 return all[lang]||all.cs;
}
function impReceiptCatalog_(){
 try{
  var res=UrlFetchApp.fetch('https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register',
     {muteHttpExceptions:true});
  if(res.getResponseCode()!==200)return {};
  var data=JSON.parse(res.getContentText()||'{}'),map={};
  (Array.isArray(data.events)?data.events:[]).forEach(function(e){if(e&&e.event_id)map[e.event_id]=e;});
  return map;
 }catch(e){console.error('Public event catalog unavailable to receipt mailer');return {};}
}
/** Optional per-event logistics link comes from the existing private Events CRM.
 * Do not put this field in anonymous event catalogs or mailing-list opt-ins.
 */
function impReceiptAttachEventGroups_(ss,events){
  events=events||{};
  var sh=ss&&ss.getSheetByName('Events');
  if(!sh||sh.getLastRow()<2)return events;
  var m=impHeader_(sh).map;
  if(m.Event_ID===undefined||m.Updates_Group_URL===undefined)return events;
  var lines=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues();
  lines.forEach(function(r){
    var id=String(r[m.Event_ID]||'').trim();
    var link=String(r[m.Updates_Group_URL]||'').trim();
    if(!id||!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}$/.test(link))return;
    if(!events[id])events[id]={event_id:id};
    events[id].updates_group_url=link;
  });
  return events;
}

function impReceiptMessage_(kind,row,m,events){
 function v(n){return m[n]===undefined?'':String(row[m[n]]||'').trim().slice(0,300);}
 var id='',email=v('Email'),label='',lang=v('Receipt_Locale')||'cs',w=impReceiptWords_(lang);
 var parts=[w[1]],sender='Družina Moravy';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return null;
 if(kind==='RSVP'){
  id=v('Submission_ID');if(!/^[0-9a-f-]{36}$/i.test(id)||!/^WEBSITE_RSVP_SUPABASE_/.test(v('Source_Channel')))return null;
  var e=events[v('Event_ID')];label=e&&e.title?e.title:v('Event_ID');
  if(e&&e.begins_at){
   var d=new Date(e.begins_at);if(isFinite(d.getTime()))parts.push(w[4]+': '+Utilities.formatDate(d,'Europe/Prague','dd.MM.yyyy HH:mm'));
  }
  if(e&&e.venue)parts.push(w[5]+': '+String(e.venue).slice(0,200));
  if(e&&e.price_verified===true&&Number.isInteger(e.price_czk))parts.push(w[6]+': '+e.price_czk+' Kč');
  var rulesUrl=e&&String(e.rules_url||'')||'';
  if(!/^https:\/\/aliaksei-chareshneu\.github\.io\/alchareshneu\//.test(rulesUrl))
   rulesUrl='https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/';
  if(e&&/hema|fenc|šerm|sword|combat/i.test(String(e.category||'')+' '+String(e.title||'')))
   parts.push(w[9]+' '+rulesUrl);
  else {
   var safetyLabels={cs:'Pravidla a bezpečnost: ',en:'Rules and safety: ',ru:'Правила и безопасность: ',uk:'Правила та безпека: '};
   parts.push((safetyLabels[lang]||safetyLabels.cs)+rulesUrl);
  }
  // A WhatsApp invitation is event logistics, not marketing consent or
  // confirmation of a place. Do not invite a minor or a declined RSVP.
  var group=e&&String(e.updates_group_url||'').trim();
  if(/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}$/.test(group)&&
     /^adult$/i.test(v('Age'))&&v('RSVP_Status')!=='DECLINED'){
    var copy={
     cs:['WhatsApp skupina pouze pro aktualizace k této akci:',
         'Připojení je dobrovolné; členové skupiny mohou vidět vaše číslo. Účast zatím není potvrzená. Pokud nechcete do skupiny, odpovězte na tento e-mail.'],
     en:['WhatsApp group for updates about this event:',
         'Joining is optional; other members may see your phone number. Attendance is not confirmed yet. If you prefer email updates, reply to this message.'],
     ru:['WhatsApp-группа для обновлений по этому мероприятию:',
         'Вступление добровольное; другие участники могут видеть ваш номер телефона. Участие ещё не подтверждено. Для связи по почте ответьте на это письмо.'],
     uk:['WhatsApp-група для оновлень щодо цієї події:',
         'Вступ добровільний; інші учасники можуть бачити ваш номер телефону. Участь ще не підтверджено. Для зв’язку поштою дайте відповідь на цей лист.']
    };
    var words=copy[lang]||copy.cs;
    parts.push('',words[0]+' '+group,words[1]);
  }
  sender=v('Data_Controller').includes('Aliaksei Chareshneu')?'Aliaksei Chareshneu (OSVČ)':'Družina Moravy';
  parts.push(w[8]);
 }else if(kind==='TRAINING'){
  id=v('Request_ID');if(!/^ENQ-[0-9a-f-]{36}$/i.test(id))return null;
  label='Družina Moravy HEMA';
  parts.push(w[7]+': '+(v('Preferred_Days')==='DATE'?v('Requested_Dates'):v('Preferred_Days')));
  parts.push(w[9]+' https://aliaksei-chareshneu.github.io/alchareshneu/druzina/safety/');
  parts.push(w[8]);
 }else if(kind==='B2B'){
  id=v('Submission_ID');if(!/^OSVC-B2B-[0-9a-f-]{36}$/i.test(id)||v('Stage')!=='New')return null;
  label=v('Service');sender='Aliaksei Chareshneu (OSVČ)';parts.push(w[11]);
 }else{return null;}
 parts.splice(1,0,w[2]+': '+id,w[3]+': '+label);
 if(kind==='RSVP'){
  var followNote={
   cs:'Pokud plánujete přijít, dejte nám prosím ještě krátce vědět. Vaše místo není potvrzené, dokud vám pořadatel neodpoví.',
   en:'If you plan to join us, please send a short message. Your place is not confirmed until the organiser replies.',
   ru:'Если вы планируете прийти, пожалуйста, напишите короткое сообщение организатору. Участие подтвердят ответным сообщением.',
   uk:'Якщо плануєте прийти, будь ласка, напишіть організатору коротке повідомлення. Участь буде підтверджено окремою відповіддю.'
  };
  parts.push('',followNote[lang]||followNote.cs,
   'Telegram: https://t.me/Chareshneu',
   'WhatsApp: https://wa.me/420702914842',
   'Email: reply to this message');
 }
 parts.push('',w[10]);
 return {to:email,subject:w[0]+' · '+id.slice(0,8),body:parts.join('\n'),sender:sender};
}
function impSendReceiptQueue_(ss,cfg,events){
 var tabs=[['Registrations','RSVP'],['Druzina_Requests','TRAINING'],['Leads','B2B']];
 var quota=MailApp.getRemainingDailyQuota(),max=Math.min(30,Math.max(0,quota-1)),sent=0,failed=0;
 if(max<=0)return {sent:0,failed:0,quotaBlocked:true};
 events=impReceiptAttachEventGroups_(ss,events||impReceiptCatalog_());
 tabs.forEach(function(pair){
  if(sent>=max)return;
  var sh=ss.getSheetByName(pair[0]);if(!sh||sh.getLastRow()<2)return;
  var h=impHeader_(sh),m=h.map;
  IMP_RC_COLS.forEach(function(k){if(m[k]===undefined)throw Error('Receipt column missing: '+k);});
  var rows=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues();
  rows.forEach(function(row,i){
   if(sent>=max)return;
   var state=String(row[m.Receipt_Status]||'');
   if(state!=='PENDING'&&state!=='RETRY')return;
   var count=Number(row[m.Receipt_Attempts]||0);
   if(count>=5){sh.getRange(i+2,m.Receipt_Status+1).setValue('FAILED_REVIEW');return;}
   var msg=impReceiptMessage_(pair[1],row,m,events);
   if(!msg){sh.getRange(i+2,m.Receipt_Status+1).setValue('REVIEW_NO_EMAIL');failed++;return;}
   try{
    MailApp.sendEmail({to:msg.to,subject:msg.subject,body:msg.body,
      name:msg.sender,replyTo:cfg.email});
    sh.getRange(i+2,m.Receipt_Sent_At+1).setValue(new Date());
    sh.getRange(i+2,m.Receipt_Status+1).setValue('SENT_TO_PROVIDER');
    sent++;
   }catch(e){
    sh.getRange(i+2,m.Receipt_Attempts+1).setValue(count+1);
    sh.getRange(i+2,m.Receipt_Status+1).setValue(count+1>=5?'FAILED_REVIEW':'RETRY');
    failed++;console.error('Transactional receipt send failed; CRM row retained');
   }
  });
 });
 return {sent:sent,failed:failed};
}

/** Optional one-time attendee follow-up, using the SAME Registrations row.
 * OFF by default. A manual Check_In_At is mandatory: submitting an RSVP
 * does NOT prove attendance. Never contact minors or marketing-only records.
 */
var IMP_EVENT_FOLLOWUP_COLS=['Event_Followup_Status','Event_Followup_Attempts','Event_Followup_Sent_At'];
function impEnsureEventFollowupCols_(sh){
 var h=impHeader_(sh);
 IMP_EVENT_FOLLOWUP_COLS.forEach(function(k){
  if(h.map[k]!==undefined)return;
  var col=sh.getLastColumn()+1;
  if(col>sh.getMaxColumns())sh.insertColumnsAfter(sh.getMaxColumns(),1);
  sh.getRange(1,col).setValue(k);h.map[k]=col-1;
 });
}
function impEventEnd_(v){
 if(v instanceof Date)return v;
 var s=String(v||''),match=/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(s);
 if(match)return new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),
   Number(match[4]),Number(match[5]));
 return new Date(v);
}
function impAttendeeThankYou_(row,m,event,props){
 var locale=String(row[m.Registration_Locale]||'cs'),isWalk=/walk|hike|výlet|proch|tour/i.test(String(event.category));
 var isDruzina=/družina|druzina/i.test(event.community);
 var words={
  cs:['Děkujeme za společnou akci','Děkujeme, že jste přišli na naši akci. Budeme rádi za upřímnou zpětnou vazbu: co se povedlo a co příště zlepšit? Stačí odpovědět na tento e-mail.','Pokud chcete, můžete také zanechat veřejnou recenzi:','Novinky komunity můžete dobrovolně sledovat zde:'],
  en:['Thank you for joining us','Thank you for coming along. We would appreciate your honest feedback: what worked well and what could be better? Just reply to this email.','If you wish, you can also leave a public review:','You can optionally follow community updates here:'],
  ru:['Спасибо, что были с нами','Спасибо, что пришли! Будем рады честному отзыву: что понравилось и что стоит улучшить? Можно просто ответить на это письмо.','Если захотите, можете оставить публичный отзыв:','Новости сообщества можно по желанию читать здесь:'],
  uk:['Дякуємо, що були з нами','Дякуємо, що завітали! Будемо раді чесному відгуку: що сподобалося і що можна поліпшити? Достатньо відповісти на цей лист.','Якщо бажаєте, можете залишити публічний відгук:','За бажанням можна стежити за новинами спільноти тут:']
 };
 var w=words[locale]||words.cs;
 var body=[w[1],'',event.title];
 var reviewKey=isDruzina?'IMPERION_DRUZINA_REVIEW_URL':'IMPERION_BRNOWALKERS_REVIEW_URL';
 var review=String(props.getProperty(reviewKey)||'').trim();
 // Only owner-configured review destinations. Never guess a Google Maps review link.
 if(/^https:\/\/(?:g\.page|maps\.app\.goo\.gl|(?:www\.)?(?:google\.com|facebook\.com))\//i.test(review))
  body.push('',w[2]+' '+review);
 // A request to opt in is not a confirmed marketing consent.
 if(String(row[m.Marketing_Consent]||'').toUpperCase()==='CONFIRMED'){
  body.push('',w[3]+' https://t.me/'+(isDruzina?'druzinamoravy_news':'pochody_brno_news'));
 }
 return {subject:w[0]+' · '+String(event.title||'').slice(0,110),body:body.join('\n'),
  sender:isDruzina?'Družina Moravy':isWalk?'BrnoWalkers':'Community events'};
}
function impSendAttendedFollowups_(ss,cfg){
 var p=PropertiesService.getScriptProperties();
 if(p.getProperty('IMPERION_ATTENDEE_FOLLOWUP_LIVE')!=='true')
  return {sent:0,failed:0,disabled:true};
 var sh=ss.getSheetByName('Registrations'),eventSheet=ss.getSheetByName('Events');
 if(!sh||!eventSheet)throw Error('Existing event/registration CRM is unavailable');
 impEnsureEventFollowupCols_(sh);
 var m=impHeader_(sh).map,em=impHeader_(eventSheet).map;
 ['Event_ID','Category','Community','Title','End_DateTime','Status','Data_Controller'].forEach(function(k){
  if(em[k]===undefined)throw Error('Missing Events.'+k);
 });
 ['Email','Event_ID','Source_Channel','Age','Check_In_At','RSVP_Status','Data_Controller',
  'Registration_Locale','Marketing_Consent','Event_Followup_Status',
  'Event_Followup_Attempts','Event_Followup_Sent_At'].forEach(function(k){
  if(m[k]===undefined)throw Error('Missing Registrations.'+k);
 });
 var now=Date.now(),byId={};
 var evs=eventSheet.getDataRange().getValues();
 evs.slice(1).forEach(function(r){
  var id=String(r[em.Event_ID]||''),end=impEventEnd_(r[em.End_DateTime]);
  if(!id||!isFinite(end.getTime())||end.getTime()+18*3600000>now
    ||end.getTime()+14*86400000<now)return;
  if(['Active','Completed','Archived'].indexOf(String(r[em.Status]))<0)return;
  byId[id]={title:String(r[em.Title]||'').slice(0,160),
   category:String(r[em.Category]||''),community:String(r[em.Community]||''),
   controller:String(r[em.Data_Controller]||'').trim()};
 });
 var quota=Math.max(0,MailApp.getRemainingDailyQuota()-3),max=Math.min(12,quota),sent=0,failed=0;
 if(!max||sh.getLastRow()<2)return {sent:0,failed:0,quotaBlocked:!max};
 var rows=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues();
 rows.forEach(function(row,i){
  if(sent>=max)return;
  var source=String(row[m.Source_Channel]||''),event=byId[String(row[m.Event_ID]||'')];
  if(source!=='WEBSITE_RSVP_SUPABASE_UNCONFIRMED'||!event
   ||!event.controller||event.controller!==String(row[m.Data_Controller]||'').trim()
   ||!String(row[m.Check_In_At]||'').trim()
   ||!/^adult$/i.test(String(row[m.Age]||''))
   ||['NO','DECLINED'].indexOf(String(row[m.RSVP_Status]||'').toUpperCase())>=0)return;
  var email=String(row[m.Email]||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return;
  var state=String(row[m.Event_Followup_Status]||'').trim();
  if(state&&state!=='RETRY')return; // exactly one follow-up per canonical row
  var attempts=Number(row[m.Event_Followup_Attempts]||0);
  if(attempts>=3){sh.getRange(i+2,m.Event_Followup_Status+1).setValue('FAILED_REVIEW');return;}
  var msg=impAttendeeThankYou_(row,m,event,p);
  try{
   MailApp.sendEmail({to:email,subject:msg.subject,body:msg.body,name:msg.sender,replyTo:cfg.email});
   sh.getRange(i+2,m.Event_Followup_Sent_At+1).setValue(new Date());
   sh.getRange(i+2,m.Event_Followup_Status+1).setValue('SENT_TO_PROVIDER');
   sent++;
  }catch(error){
   sh.getRange(i+2,m.Event_Followup_Attempts+1).setValue(attempts+1);
   sh.getRange(i+2,m.Event_Followup_Status+1).setValue(attempts+1>=3?'FAILED_REVIEW':'RETRY');
   failed++;console.error('Verified-attendance follow-up failed; retained for review');
  }
 });
 return {sent:sent,failed:failed};
}

/** Pending owner count digest is private Script Properties, not a second CRM.
 * A failed MailApp call retains the counts for the next hourly run.
 * Do not include attendee names, guardian data or contact details in emails.
 */
var IMP_PRIVATE_NOTIFY_PENDING='IMPERION_INTAKE_NOTIFY_PENDING';
function impPendingDigest_(){
  var raw=PropertiesService.getScriptProperties().getProperty(IMP_PRIVATE_NOTIFY_PENDING);
  if(!raw)return {rsvps:0,enquiries:0,b2b:0};
  var data;
  try{data=JSON.parse(raw)}catch(e){throw Error('Invalid pending digest state');}
  if(!data||!Number.isSafeInteger(data.rsvps)||!Number.isSafeInteger(data.enquiries)||
     data.rsvps<0||data.enquiries<0||
     (data.b2b!==undefined&&(!Number.isSafeInteger(data.b2b)||data.b2b<0)))
    throw Error('Invalid pending digest counters');
  return {rsvps:data.rsvps,enquiries:data.enquiries,b2b:data.b2b||0};
}
function impQueueOwnerDigest_(rsvps,enquiries,b2b){
  b2b=b2b||0;
  if(!Number.isSafeInteger(rsvps)||!Number.isSafeInteger(enquiries)||!Number.isSafeInteger(b2b)||
     rsvps<0||enquiries<0||b2b<0)throw Error('Invalid new intake counts');
  if(rsvps+enquiries+b2b===0)return;
  var p=PropertiesService.getScriptProperties(),pending=impPendingDigest_();
  p.setProperty(IMP_PRIVATE_NOTIFY_PENDING,JSON.stringify({
    rsvps:pending.rsvps+rsvps,enquiries:pending.enquiries+enquiries,b2b:pending.b2b+b2b
  }));
}
function impFlushOwnerDigest_(cfg){
  var pending=impPendingDigest_(),n=pending.rsvps+pending.enquiries+pending.b2b;
  if(n===0)return {sent:false,pending:false};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email))throw Error('Missing owner digest address');
  try{
    MailApp.sendEmail(cfg.email,'[Imperion] Nové žádosti: '+n,
      'Registrace na akce: '+pending.rsvps+'\n'+
      'Dotazy na trénink Družina: '+pending.enquiries+'\n'+
      'Firemní OSVČ poptávky: '+pending.b2b+'\n\n'+
      'Soukromé kontakty najdete jen ve stávající CRM:\n'+
      'https://docs.google.com/spreadsheets/d/'+cfg.sheetId+'/edit\n\n'+
      'Ani účast, ani platba nejsou automaticky potvrzeny.');
    PropertiesService.getScriptProperties().deleteProperty(IMP_PRIVATE_NOTIFY_PENDING);
    return {sent:true,pending:false};
  }catch(e){
    console.error('Private owner digest unavailable; pending count kept for retry');
    return {sent:false,pending:true};
  }
}

/** Run manually once first, then enable owner-created time triggers. */
function imperionSyncPrivateIntake(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(12000))throw Error('Another intake run is already in progress');
  try{
    var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId);
    ['Registrations','Druzina_Requests','Leads'].forEach(function(n){impEnsureReceiptCols_(ss.getSheetByName(n));});
    var addedR=0,addedE=0,addedB=0,processed=0;
    // One safe public price lookup; never infer paid status from a blank/unknown fee.
    var events=impReceiptCatalog_();
    for(var i=0;i<4;i++){
      var batch=impPrivateFetch_(cfg,null);
      if(batch.protocol!=='imperion-intake-bridge-v1'||
         !Array.isArray(batch.rsvps)||!Array.isArray(batch.enquiries)||!Array.isArray(batch.b2b))
        throw Error('Private intake response schema changed');
      if(!batch.rsvps.length&&!batch.enquiries.length&&!batch.b2b.length)break;
      var a=impWriteRsvps_(ss,batch.rsvps,events);
      var b=impWriteEnquiries_(ss,batch.enquiries);
      var c=impWriteB2B_(ss,batch.b2b);
      // Persist the owner-notification receipt BEFORE acknowledging the source;
      // a mail outage or later crash must not silently discard new leads.
      impQueueOwnerDigest_(a.added,b.added,c.added);
      // Acknowledge only AFTER CRM writes/readback and notification queuing succeed.
      impPrivateFetch_(cfg,{action:'ack',rsvps:a.ids,enquiries:b.ids,b2b:c.ids});
      addedR+=a.added;addedE+=b.added;addedB+=c.added;
      processed+=a.ids.length+b.ids.length+c.ids.length;
      if(a.ids.length<40&&b.ids.length<40&&c.ids.length<40)break;
    }
    // Retry a previously failed digest even if this run has no new rows.
    impFlushOwnerDigest_(cfg);
    var receipts=impSendReceiptQueue_(ss,cfg,events);
    var followups=impSendAttendedFollowups_(ss,cfg);
    console.log('Private intake receipts: dispatched='+receipts.sent+', errors='+receipts.failed);
    console.log('Private intake: new RSVP='+addedR+', enquiries='+addedE+', corporate OSVC='+addedB+', acked='+processed);
    return {newRsvps:addedR,newEnquiries:addedE,newB2B:addedB,acked:processed,receipts:receipts,followups:followups};
  }finally{lock.releaseLock();}
}
function imperionCleanupPrivateIntake(){
  var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId),now=new Date(),cleared=0;
  var r=ss.getSheetByName('Registrations');
  if(r&&r.getLastRow()>1){
    var h=impHeader_(r),m=h.map,rows=r.getRange(2,1,r.getLastRow()-1,r.getLastColumn()).getValues();
    var privateCols=['Full_Name','Telegram_Handle','Phone_Number','Age','Guardian_Name',
      'Guardian_Phone','Guardian_Relationship','Child_Name','Child_Age',
      'Emergency_Contact_Name','Emergency_Contact_Phone','Medical_Conditions',
      'Equipment_Note','Payment_Reference','Reply_Contact','Email','First_Name',
      'Last_Name','Marketing_Consent_At'];
    rows.forEach(function(x,i){
      var source=String(x[m.Source_Channel]||'');
      if(!/^WEBSITE_RSVP_SUPABASE_/.test(source)||source.endsWith('_PURGED'))return;
      var date=x[m.Retention_Until] instanceof Date?x[m.Retention_Until]:new Date(x[m.Retention_Until]);
      if(!isFinite(date.getTime())||date>now)return;
      privateCols.forEach(function(n){if(m[n]!==undefined)r.getRange(i+2,m[n]+1).clearContent()});
      r.getRange(i+2,m.Source_Channel+1).setValue('WEBSITE_RSVP_SUPABASE_PURGED');
      cleared++;
    });
  }
  var e=ss.getSheetByName('Druzina_Requests');
  if(e&&e.getLastRow()>1){
    var head=impHeader_(e),em=head.map,lines=e.getRange(2,1,e.getLastRow()-1,e.getLastColumn()).getValues();
    var cols=['Member_ID','Full_Name','Email','Phone','Telegram_Handle','Requested_Dates',
      'Preferred_Days','Equipment_Note','Notes'];
    lines.forEach(function(x,i){
      if(!String(x[em.Request_ID]||'').startsWith('ENQ-')||
         String(x[em.Processing_Status])==='EXPIRED_ANONYMIZED')return;
      var date=x[em.Timestamp] instanceof Date?x[em.Timestamp]:new Date(x[em.Timestamp]);
      if(!isFinite(date.getTime())||date.getTime()+90*86400000>now.getTime())return;
      cols.forEach(function(n){if(em[n]!==undefined)e.getRange(i+2,em[n]+1).clearContent()});
      e.getRange(i+2,em.Processing_Status+1).setValue('EXPIRED_ANONYMIZED');
      cleared++;
    });
  }

  // Privacy hygiene for uncontracted OSVC leads; NEVER touch paid/contracted rows.
  var leads=ss.getSheetByName('Leads');
  if(leads&&leads.getLastRow()>1){
    var hl=impHeader_(leads),lm=hl.map;
    var need=['Submission_ID','Stage','Retention_Until','Action_Status'];
    need.forEach(function(k){if(lm[k]===undefined)throw Error('Missing Leads header: '+k)});
    var lr=leads.getRange(2,1,leads.getLastRow()-1,leads.getLastColumn()).getValues();
    lr.forEach(function(x,i){
      if(!String(x[lm.Submission_ID]||'').startsWith('OSVC-B2B-'))return;
      if(String(x[lm.Action_Status])==='OSVC_B2B_EXPIRED_ANONYMIZED')return;
      // A paid or legally meaningful contract must be reviewed, not auto-deleted.
      if(['New','Lost'].indexOf(String(x[lm.Stage]))<0)return;
      var date=x[lm.Retention_Until] instanceof Date?x[lm.Retention_Until]:new Date(x[lm.Retention_Until]);
      if(!isFinite(date.getTime())||date>now)return;
      ['Full_Name','Email','Phone_Number','Subject_Goal','Notes'].forEach(function(name){
        if(lm[name]!==undefined)leads.getRange(i+2,lm[name]+1).clearContent();
      });
      leads.getRange(i+2,lm.Action_Status+1).setValue('OSVC_B2B_EXPIRED_ANONYMIZED');
      cleared++;
    });
  }
  console.log('Private intake anonymized '+cleared+' expired rows');
  return cleared;
}
/** Run once as the owner. Existing unrelated triggers are preserved. */
function imperionInstallPrivateIntake(){
  var cfg=impPrivateConfig_();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email))
    throw Error('IMPERION_NOTIFY_EMAIL must be configured');
  var triggers=ScriptApp.getProjectTriggers(),importers=[],cleanups=[];
  triggers.forEach(function(t){
    if(t.getHandlerFunction()==='imperionSyncPrivateIntake')importers.push(t);
    if(t.getHandlerFunction()==='imperionCleanupPrivateIntake')cleanups.push(t);
  });
  // Never remove a working import trigger before a replacement has been authorized.
  // A second owner account may have invisible triggers: owner must inspect the editor once.
  if(importers.length>1||cleanups.length>1)
    throw Error('Duplicate intake triggers under this account: inspect Triggers before proceeding');
  if(importers.length===0)
    ScriptApp.newTrigger('imperionSyncPrivateIntake').timeBased().everyMinutes(5).create();
  if(cleanups.length===0)
    ScriptApp.newTrigger('imperionCleanupPrivateIntake').timeBased().everyDays(1).atHour(4).create();
  return {installed:true,importerCreated:importers.length===0,retentionCreated:cleanups.length===0};
}
