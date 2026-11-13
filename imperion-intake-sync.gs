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
    headers:{Authorization:'Bearer '+config.key,'x-imperion-intake-protocol':'payment-v2','x-imperion-intake-academy':'v1'},
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
function impEnsureRsvpAttribution_(sh){
 var h=impHeader_(sh);
 ['Discovery_Source','UTM_Source','UTM_Medium','UTM_Campaign'].forEach(function(k){
  if(h.map[k]!==undefined)return;
  var col=sh.getLastColumn()+1;
  if(col>sh.getMaxColumns())sh.insertColumnsAfter(sh.getMaxColumns(),1);
  sh.getRange(1,col).setValue(k);
  h.map[k]=col-1;
 });
 return impHeader_(sh);
}
function impAppendOrelSource_(ss,r){
 if(String(r.event_id||'')!=='PUB-OREL-20261114')return;
 var sh=ss.getSheetByName('OREL_20261114_Sources');if(!sh)return;
 var email=String(r.email||'').toLowerCase().trim(),n=sh.getLastRow();
 if(!email)return;
 if(n>1&&sh.getRange(2,2,n-1,1).getDisplayValues().some(function(x){
  return String(x[0]||'').toLowerCase().trim()===email;
 }))return;
 var channels={IS_MUNI:'IS MUNI',SPOLEK_MUNI:'Spolek přírodovědců MUNI',
  FACEBOOK:'Facebook',INSTAGRAM:'Instagram',WHATSAPP:'WhatsApp',
  TELEGRAM:'Telegram',FRIEND:'Friends',GOTOBRNO:'GOtoBRNO',
  OTHER_SITE:'Other website',OTHER:'Other'};
 var channel=channels[r.discovery_source]||'';
 var detail=[r.utm_source?'UTM: '+r.utm_source:'',r.utm_campaign?'Campaign: '+r.utm_campaign:''].filter(Boolean).join('; ');
 var row=[[r.first_name,r.last_name].filter(Boolean).join(' '),email,
  r.rsvp_status||'',r.language||'',channel,detail,'','','',
  channel?'FORM_REPORTED':(detail?'CAMPAIGN_TAGGED':'UNATTRIBUTED'),
  'NOT_REQUESTED','',r.event_id||'','Automatic source data, no seat approval'];
 sh.getRange(n+1,1,1,14).setValues([row]);
}
/** Add payment audit metadata to the SAME Registrations tab; no duplicate CRM.
 * Never copy bank PDF files, original filenames, storage paths or hashes to Sheets.
 */
function impEnsureRsvpPaymentCols_(sh){
 var h=impHeader_(sh);
 var required=['Requested_Tier','Quoted_Tier','Personal_Approval_At','Quoted_Base_CZK','Late_Fee_CZK',
  'Quoted_Total_CZK','Quoted_Group_Size','Late_48h','Payment_Evidence_Status','Payment_Proof_Received_At'];
 var missing=required.filter(function(k){return h.map[k]===undefined;});
 if(missing.length){
  var last=sh.getLastColumn();
  var space=sh.getMaxColumns()-last;
  if(space<missing.length)sh.insertColumnsAfter(sh.getMaxColumns(),missing.length-space);
  missing.forEach(function(key,i){sh.getRange(1,last+i+1).setValue(key);});
 }
 return impHeader_(sh);
}
/** Update only payment evidence on an already imported RSVP; never add duplicate.
 * Do not overwrite earlier consents, identities or manually verified bank status.
 */
function impUpdateExistingRsvpProof_(sh,h,r){
 if(r.payment_evidence_status!=='PROOF_RECEIVED')return;
 var keys={
  Requested_Tier:r.training_requested_tier||'',
  Quoted_Tier:r.quoted_tier||'',
  Personal_Approval_At:impDate_(r.training_authorized_at),
  Quoted_Base_CZK:r.quoted_base_czk||'',
  Late_Fee_CZK:r.quoted_late_fee_czk===0?0:(r.quoted_late_fee_czk||''),
  Quoted_Total_CZK:r.quoted_total_czk||'',
  Quoted_Group_Size:r.quoted_confirmed_count||'',
  Late_48h:r.quoted_late_48h===true?'YES':'NO',
  Payment_Evidence_Status:'PROOF_RECEIVED',
  Payment_Proof_Received_At:impDate_(r.payment_evidence_received_at),
 };
 var col=h.map.Submission_ID+1,last=sh.getLastRow(),id=String(r.id||'');
 if(last<2)return;
 var entries=sh.getRange(2,col,last-1,1).getDisplayValues();
 for(var i=0;i<entries.length;i++){
  if(String(entries[i][0]||'').trim()!==id)continue;
  var row=i+2;
  Object.keys(keys).forEach(function(key){
   if(h.map[key]===undefined)throw Error('Missing payment CRM column: '+key);
   sh.getRange(row,h.map[key]+1).setValue(impText_(keys[key]));
   if(keys[key] instanceof Date)sh.getRange(row,h.map[key]+1).setNumberFormat('dd.mm.yyyy hh:mm');
  });
  if(sh.getRange(row,h.map.Payment_Evidence_Status+1).getDisplayValue()!=='PROOF_RECEIVED')
   throw Error('Payment proof CRM readback failed');
  return;
 }
 throw Error('Existing RSVP row missing for proof sync');
}
function impWriteRsvps_(ss,items,events){
  var sh=ss.getSheetByName('Registrations');if(!sh)throw Error('Missing Registrations');
  var h=(items||[]).some(function(r){return r&&Object.prototype.hasOwnProperty.call(r,'discovery_source');})?
   impEnsureRsvpAttribution_(sh):impHeader_(sh);
  if((items||[]).some(function(r){return r && (r.payment_evidence_status==='PROOF_RECEIVED' ||
    /^PUB-HEMA-/.test(String(r.event_id||'')));}))
   h=impEnsureRsvpPaymentCols_(sh);
  if(h.map.Submission_ID===undefined)throw Error('Missing Submission_ID');
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
        Discovery_Source:r.discovery_source||'',UTM_Source:r.utm_source||'',
        UTM_Medium:r.utm_medium||'',UTM_Campaign:r.utm_campaign||'',
        Requested_Tier:r.training_requested_tier||'',
        Quoted_Tier:r.quoted_tier||'',
        Personal_Approval_At:impDate_(r.training_authorized_at),
        Quoted_Base_CZK:r.quoted_base_czk||'',
        Late_Fee_CZK:r.quoted_late_fee_czk===0?0:(r.quoted_late_fee_czk||''),
        Quoted_Total_CZK:r.quoted_total_czk||'',
        Quoted_Group_Size:r.quoted_confirmed_count||'',
        Late_48h:r.quoted_late_48h===true?'YES':'NO',
        Payment_Evidence_Status:r.payment_evidence_status||'NOT_REQUIRED',
        Payment_Proof_Received_At:impDate_(r.payment_evidence_received_at),
        Receipt_Status:'PENDING',Receipt_Attempts:0,Receipt_Locale:r.language||'cs'
      });
      existing[id]=true;added++;
      try{impAppendOrelSource_(ss,r);}catch(e){console.error('Orel source mirror unavailable');}
    }else if(r.payment_evidence_status==='PROOF_RECEIVED'){
      impUpdateExistingRsvpProof_(sh,h,r);
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
        SCIENTIFIC_CONSULTING:'IT/Science',HEMA_CORPORATE:'Other',
         EVENT_HOST:'Other',EVENT_PROGRAM:'Other',MEDIA_SPONSOR:'Marketing / Media'
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


/** Private OSVC Academy leads -> same EXISTING Leads tab. No client mail/booking/paid claim. */
function impWriteAcademy_(ss,items){
  var sh=ss.getSheetByName('Leads');if(!sh)throw Error('Missing Leads for Academy');
  var h=impHeader_(sh);
  ['Lead_ID','Submission_ID','Stage','Source','Service','Owner','Action_Status'].forEach(function(k){
    if(h.map[k]===undefined)throw Error('Missing Leads header: '+k);
  });
  var seen=impExisting_(sh,h.map.Submission_ID+1),ids=[],added=0;
  var products={LESSON:'Online tutoring · 60 min',CONSULT:'Service choice · 10 min',
    PACK5:'Online programme · 5 lessons',PACK10:'Online programme · 10 lessons',
    PACK20:'Online programme · 20 lessons',
    UNI:'Admissions support',MED:'Medical studies preparation',A2:'Czech A2',
    CER:'CERMAT prep',CAREER:'Career consulting',DEFENSE:'Exam defense',
    EXEC:'Executive learning',LIFE:'Living / study support'};
  (items||[]).forEach(function(r){
    var id=String(r.id||''),code=String(r.product_code||'');
    if(!/^[0-9a-f-]{36}$/i.test(id)||!Object.prototype.hasOwnProperty.call(products,code))
      throw Error('Invalid Academy identifier/product');
    var key='OSVC-ACADEMY-'+id;
    if(!seen[key]){
      var created=impDate_(r.created_at),expire=impDate_(r.retention_until);
      if(!created||!expire)throw Error('Invalid Academy retention or created time');
      var lang=String(r.locale||'en');
      if(!/^(cs|en|ru|uk)$/.test(lang))throw Error('Invalid Academy locale');
      var notes='Individual OSVC Academy website enquiry, NOT booked, NOT paid, NOT invoiced. '+
        'Program '+code+'; preferred times (Europe/Prague): '+String(r.deadline||'').slice(0,400)+
        '; UTM: '+[r.utm_source,r.utm_medium,r.utm_campaign].map(function(v){return String(v||'').slice(0,64)}).join('/')+
        '; Source: '+String(r.source||'academy_programmes').slice(0,85)+
        '; Seller Aliaksei Chareshneu OSVC, not NGO. No marketing consent.';
      impAppend_(sh,h,{
        Lead_ID:'ACADEMY-'+id,Created_At:created,Full_Name:String(r.first_name||'').slice(0,110),
        Email:String(r.email||'').slice(0,180),Source:'Website',
        Service:'Tutoring',Subject_Goal:String(r.goal||'').slice(0,500),
        Language:lang,Format:code==='CONSULT'?'Online consultation':'Online requested',
        Stage:'New',Product_ID:code,Expected_Value_CZK:'',
        Next_Action_At:new Date(Date.now()+86400000),Followup_Count:0,
        Paid_CZK:0,Owner:'Aliaksei',Notes:notes,
        Submission_ID:key,Retention_Until:expire,Last_Automation_At:new Date(),
        Action_Status:'OSVC_ACADEMY_INBOUND_UNCONFIRMED_NO_BOOKING_NO_PAYMENT',
        Priority:(code==='LESSON'||/^PACK/.test(code))?'P1':'P2',
        Receipt_Status:'REVIEW_NO_EMAIL',Receipt_Attempts:0,Receipt_Locale:lang
      });
      seen[key]=true;added++;
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
/** A public catalog fetch can transiently fail. Fall back to the existing
 * canonical Events CRM, never an invented event title/date.
 */
function impReceiptCatalog_(ss){
 var map={};
 try{
  var res=UrlFetchApp.fetch('https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register',
    {muteHttpExceptions:true});
  if(res.getResponseCode()===200){
   var data=JSON.parse(res.getContentText()||'{}');
   (Array.isArray(data.events)?data.events:[]).forEach(function(e){
    if(e&&e.event_id)map[e.event_id]=e;
   });
  }else console.error('Public event catalog HTTP '+res.getResponseCode());
 }catch(e){console.error('Public event catalog unavailable to receipt mailer');}
 // The fallback is a READ-ONLY lookup: never change Events or Registrations here.
 try{
  var sh=ss&&ss.getSheetByName('Events');
  if(!sh||sh.getLastRow()<2)return map;
  var m=impHeader_(sh).map;
  var required=['Event_ID','Status','Title','Start_DateTime','Location_Name','Location_Address',
   'Price_CZK','Category','Community','Rules_URL'];
  if(required.some(function(k){return m[k]===undefined;}))return map;
  var records=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  records.forEach(function(row){
   var id=String(row[m.Event_ID]||'').trim();
   if(!/^[A-Za-z0-9-]{2,100}$/.test(id)||
      String(row[m.Status]||'').trim().toLowerCase()!=='active')return;
   var price=String(row[m.Price_CZK]===undefined?'':row[m.Price_CZK]).trim();
   var venue=[row[m.Location_Name],row[m.Location_Address]].filter(Boolean).join(', ').slice(0,180);
   var fallback={
    event_id:id,title:String(row[m.Title]||'').trim().slice(0,180),
    begins_at:row[m.Start_DateTime],venue:venue,category:String(row[m.Category]||'').trim(),
    community:String(row[m.Community]||'').trim(),
    rules_url:String(row[m.Rules_URL]||'').trim(),
    price_czk:/^\d{1,6}$/.test(price)?Number(price):null,
    price_verified:/^\d{1,6}$/.test(price)
   };
   if(!fallback.title||!fallback.begins_at||!fallback.venue)return;
   var e=map[id]||{};
   Object.keys(fallback).forEach(function(k){
    if(e[k]===undefined||e[k]===null||e[k]==='')e[k]=fallback[k];
   });
   map[id]=e;
  });
 }catch(e){console.error('Private Events catalog fallback unavailable');}
 return map;
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

/** These routes are informational by default. The separate discussion chats are
 * restricted and may only be sent by impSendApprovedChatInvites_ after operator approval.
 * Canonical Drive links checked on 2026-11-01; no new CRM or mailing list.
 */
function impCommunityRoute_(community,lang){
 var name=String(community||'').normalize('NFKC').trim().toLowerCase();
 var key=name==='družina moravy'||name==='druzina moravy'?'druzina':
   name==='brnowalkers'||name==='brnowalkers / osvč'?'brnowalkers':null;
 if(!key||['cs','en','ru','uk'].indexOf(lang)<0)return null;
 var platform=lang==='cs'||lang==='en'?'whatsapp':'telegram';
 var links={
  druzina:{
   whatsapp:{news:'https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu',chatProperty:'IMPERION_CHAT_DRUZINA_WA'},
   telegram:{news:'https://t.me/druzinamoravy_news',chatProperty:'IMPERION_CHAT_DRUZINA_TG'}},
  brnowalkers:{
   whatsapp:{news:'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0',chatProperty:'IMPERION_CHAT_BRNOWALKERS_WA'},
   telegram:{news:'https://t.me/pochody_brno_news',chatProperty:'IMPERION_CHAT_BRNOWALKERS_TG'}}
 };
 var route=links[key][platform];
 var valid=platform==='whatsapp'?/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}$/:
   /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/;
 if(!valid.test(route.news))return null;
 return {community:key,platform:platform,news:route.news,chatProperty:route.chatProperty};
}

/** Transactional RSVP receipt: record the form answer, never request a second RSVP.
 * A form submission is not organiser-approved attendance. Optional troubleshooting
 * screenshots must have personal information hidden.
 */
function impRsvpReceiptCopy_(lang,status){
 var messages={
  cs:{
   pending:'Přihláška přijata – místo zatím nepotvrzeno',
   maybeSubject:'Přihláška přijata – účast zatím nerozhodnuta',
   declinedSubject:'Vaše odpověď byla zaznamenána',
   intro:'Děkujeme, Vaši odpověď z registračního formuláře jsme přijali. Toto je potvrzení přijetí, nikoli rezervace místa.',
   yes:'Zaznamenali jsme, že chcete přijít (ANO). Nemusíte vyplňovat formulář znovu ani potvrzovat svou účast dalším e-mailem. Organizátor Vám po kontrole kapacity samostatně potvrdí místo nebo oznámí další postup.',
   maybe:'Zaznamenali jsme odpověď MOŽNÁ. Místo zatím není rezervováno. Jakmile budete vědět, zda přijdete, stačí odpovědět na tento e-mail; formulář nevyplňujte znovu.',
   no:'Zaznamenali jsme odpověď NE. S Vaší účastí nepočítáme. Pokud šlo o omyl, stačí odpovědět na tento e-mail; formulář nevyplňujte znovu.',
   unknown:'Vaši žádost evidujeme, ale místo zatím potvrzené není. Po kontrole kapacity Vám organizátor samostatně oznámí další postup. Formulář není potřeba vyplňovat znovu.',
   troubleshooting:'Pokud při registraci nastala chyba nebo něco nebylo jasné, napište nám prosím, co se zobrazilo. Pokud můžete, přiložte snímek obrazovky bez viditelných osobních údajů. Jestli vše fungovalo, nemusíte nic posílat.'
  },
  en:{
   pending:'Registration received – place not yet confirmed',
   maybeSubject:'Registration received – attendance undecided',
   declinedSubject:'Your response has been recorded',
   intro:'Thank you. We have received your form response. This acknowledges your submission; it is not a confirmed booking.',
   yes:'You selected YES and we have saved it. You do not need to submit the form again or send another email to confirm your interest. After checking capacity, the organiser will separately confirm your place or explain the next step.',
   maybe:'You selected MAYBE. No place is reserved yet. Once you know whether you can attend, just reply to this email; please do not submit the form again.',
   no:'You selected NO. We are not expecting you to attend. If this was a mistake, reply to this email rather than submitting the form again.',
   unknown:'We have recorded your request, but no place is confirmed yet. The organiser will tell you the next step after checking capacity. You do not need to re-submit the form.',
   troubleshooting:'If you encountered an error or an unclear message while registering, please tell us what appeared. If possible, attach a screenshot with any personal information hidden. If everything worked, no reply is needed.'
  },
  ru:{
   pending:'Заявка получена – место пока не подтверждено',
   maybeSubject:'Заявка получена – решение об участии не принято',
   declinedSubject:'Ваш ответ зарегистрирован',
   intro:'Спасибо! Мы получили ответ из регистрационной формы. Это подтверждение получения заявки, но не бронирование места.',
   yes:'Вы выбрали ДА, и мы сохранили ваш ответ. Повторно заполнять форму или подтверждать интерес отдельным письмом не нужно. После проверки вместимости организатор отдельно подтвердит место или сообщит о дальнейших действиях.',
   maybe:'Вы выбрали ВОЗМОЖНО. Место пока не забронировано. Когда решите, сможете ли прийти, просто ответьте на это письмо; форму повторно заполнять не нужно.',
   no:'Вы выбрали НЕТ. Мы не рассчитываем на ваше участие. Если это ошибка, просто ответьте на это письмо вместо повторной регистрации.',
   unknown:'Ваша заявка сохранена, но место ещё не подтверждено. После проверки вместимости организатор сообщит о дальнейших действиях; повторная регистрация не требуется.',
   troubleshooting:'Если при регистрации возникла ошибка или какое-то сообщение было непонятным, напишите, что именно отображалось. По возможности приложите скриншот, скрыв личные данные. Если всё работало, отвечать не нужно.'
  },
  uk:{
   pending:'Заявку отримано – місце ще не підтверджене',
   maybeSubject:'Заявку отримано – участь ще не визначена',
   declinedSubject:'Вашу відповідь збережено',
   intro:'Дякуємо! Ми отримали вашу відповідь із реєстраційної форми. Це підтвердження отримання, а не бронювання місця.',
   yes:'Ви обрали ТАК, і ми зберегли вашу відповідь. Повторно заповнювати форму або підтверджувати намір окремим листом не потрібно. Після перевірки місткості організатор окремо підтвердить місце або повідомить про наступні дії.',
   maybe:'Ви обрали МОЖЛИВО. Місце поки не заброньоване. Коли вирішите, чи прийдете, просто дайте відповідь на цей лист; повторно заповнювати форму не потрібно.',
   no:'Ви обрали НІ. Ми не розраховуємо на вашу участь. Якщо це помилка, просто дайте відповідь на цей лист, а не реєструйтеся повторно.',
   unknown:'Вашу заявку збережено, але місце ще не підтверджене. Після перевірки місткості організатор повідомить про наступні дії; повторна реєстрація не потрібна.',
   troubleshooting:'Якщо під час реєстрації виникла помилка або щось було незрозуміло, напишіть, що саме відображалося. За можливості додайте скриншот, приховавши особисті дані. Якщо все працювало, відповідати не потрібно.'
  }
 };
 var w=messages[lang]||messages.cs;
 var selected=status==='DECLINED'?'no':status==='MAYBE'?'maybe':status==='REGISTERED'?'yes':'unknown';
 return {intro:w.intro,next:w[selected],troubleshooting:w.troubleshooting,
  subject:selected==='no'?w.declinedSubject:selected==='maybe'?w.maybeSubject:w.pending};
}

function impReceiptMessage_(kind,row,m,events){
 function v(n){return m[n]===undefined?'':String(row[m[n]]||'').trim().slice(0,300);}
 var id='',email=v('Email'),label='',lang=v('Receipt_Locale')||'cs',w=impReceiptWords_(lang);
 var receiptCopy=kind==='RSVP'?impRsvpReceiptCopy_(lang,v('RSVP_Status')):null;
 var parts=[receiptCopy?receiptCopy.intro:w[1]],sender='Družina Moravy';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return null;
 if(kind==='RSVP'){
  id=v('Submission_ID');if(!/^[0-9a-f-]{36}$/i.test(id)||!/^WEBSITE_RSVP_SUPABASE_/.test(v('Source_Channel')))return null;
  var e=events&&events[v('Event_ID')];if(!e||!String(e.title||'').trim())return null;
  label=e.title;
  if(e&&e.begins_at){
   var originalTime=String(e.begins_at||'').trim();
   var local=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(originalTime);
   if(local)parts.push(w[4]+': '+local[3]+'.'+local[2]+'.'+local[1]+' '+local[4]+':'+local[5]);
   else{
    var d=new Date(e.begins_at);
    if(isFinite(d.getTime()))parts.push(w[4]+': '+Utilities.formatDate(d,'Europe/Prague','dd.MM.yyyy HH:mm'));
   }
  }
  if(e&&e.venue)parts.push(w[5]+': '+String(e.venue).slice(0,200));
  var paidQuote=Number(v('Quoted_Total_CZK'));
  if(v('Payment_Evidence_Status')==='PROOF_RECEIVED'&&paidQuote>0)
    parts.push(w[6]+': '+paidQuote+' Kč (PDF received for review; bank not verified)');
  else if(e&&e.price_verified===true&&Number.isInteger(e.price_czk)&&
       !e.trainingPayment)parts.push(w[6]+': '+e.price_czk+' Kč');
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
  if((lang==='cs'||lang==='en')&&
     /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}$/.test(group)&&
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
  // A link to a voluntary information channel is NOT a subscription or approved booking.
  // Never offer community membership links to minors or declined applications.
  if(/^adult$/i.test(v('Age'))&&v('RSVP_Status')!=='DECLINED'){
    var route=impCommunityRoute_(e&&e.community,lang);
    if(route){
      var communityText={
       cs:['Novinky komunity (dobrovolně):','Členové WhatsApp skupiny mohou vidět vaše telefonní číslo.','Členové Telegramu mohou vidět váš profil dle nastavení soukromí.','Diskusní chat se zpřístupňuje až po ověření účasti; u Družiny také po úhradě dalšího tréninku.'],
       en:['Community announcements (optional):','WhatsApp group members may see your phone number.','Telegram members may see your profile depending on privacy settings.','The discussion chat requires verified attendance; Družina also requires payment for the next training.'],
       ru:['Новости сообщества (добровольно):','Участники WhatsApp могут видеть ваш номер телефона.','Участники Telegram могут видеть ваш профиль в зависимости от настроек приватности.','Доступ в чат — после подтверждённого посещения, для Družina также после оплаты следующей тренировки.'],
       uk:['Новини спільноти (добровільно):','Учасники WhatsApp можуть бачити ваш номер телефону.','Учасники Telegram можуть бачити ваш профіль відповідно до налаштувань приватності.','Доступ до чату — після підтвердженого відвідування, для Družina також після оплати наступного тренування.']
      }[lang];
      parts.push('',communityText[0]+' '+route.news,
        route.platform==='whatsapp'?communityText[1]:communityText[2],communityText[3]);
    }
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
  parts.push('',receiptCopy.next,'',receiptCopy.troubleshooting,
   'Telegram: https://t.me/Chareshneu',
   'WhatsApp: https://wa.me/420702914842',
   'Email: reply to this message');
 }
 parts.push('',w[10]);
 return {to:email,subject:(receiptCopy?receiptCopy.subject:w[0])+' · '+id.slice(0,8),body:parts.join('\n'),sender:sender};
}
function impSendReceiptQueue_(ss,cfg,events){
 var tabs=[['Registrations','RSVP'],['Druzina_Requests','TRAINING'],['Leads','B2B']];
 var quota=MailApp.getRemainingDailyQuota(),max=Math.min(30,Math.max(0,quota-1)),sent=0,failed=0;
 if(max<=0)return {sent:0,failed:0,quotaBlocked:true};
 events=impReceiptAttachEventGroups_(ss,events||impReceiptCatalog_(ss));
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
   if(!msg){
    if(pair[1]==='RSVP'&&(!events[String(row[m.Event_ID]||'').trim()]||!String(events[String(row[m.Event_ID]||'').trim()].title||'').trim())){
      sh.getRange(i+2,m.Receipt_Attempts+1).setValue(count+1);
      sh.getRange(i+2,m.Receipt_Status+1).setValue(count+1>=5?'FAILED_REVIEW':'RETRY');
    }else sh.getRange(i+2,m.Receipt_Status+1).setValue('REVIEW_NO_EMAIL');
    failed++;return;
   }
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

/** Private owner digest. Store only counters and a few non-identifying CRM row
 * pointers in Script Properties. Never put names, email, phone, guardian or
 * free-form enquiry content in owner notification emails.
 * Existing counters without details remain readable after an upgrade.
 */
var IMP_PRIVATE_NOTIFY_PENDING='IMPERION_INTAKE_NOTIFY_PENDING';
var IMP_OWNER_DIGEST_SAMPLE_LIMIT=12;
function impPendingDigest_(){
  var raw=PropertiesService.getScriptProperties().getProperty(IMP_PRIVATE_NOTIFY_PENDING);
  if(!raw)return {rsvps:0,enquiries:0,b2b:0,academy:0,items:[]};
  var data;
  try{data=JSON.parse(raw)}catch(e){throw Error('Invalid pending digest state');}
  if(!data||!Number.isSafeInteger(data.rsvps)||!Number.isSafeInteger(data.enquiries)||
     data.rsvps<0||data.enquiries<0||
     (data.b2b!==undefined&&(!Number.isSafeInteger(data.b2b)||data.b2b<0))||
     (data.academy!==undefined&&(!Number.isSafeInteger(data.academy)||data.academy<0)))
    throw Error('Invalid pending digest counters');
  return {rsvps:data.rsvps,enquiries:data.enquiries,b2b:data.b2b||0,academy:data.academy||0,
    items:Array.isArray(data.items)?data.items.slice(-IMP_OWNER_DIGEST_SAMPLE_LIMIT):[]};
}
/** Snapshot only the freshly appended rows, never old CRM contacts or test data.
 * Row numbers are pointers for the owner; counts remain authoritative if this
 * optional snapshot is unavailable.
 */
function impDigestNewRows_(ss,rsvps,enquiries,b2b,academy){
  academy=academy||0;
  if(!ss)return [];
  var samples=[];
  [
    {tab:'Registrations',kind:'RSVP',count:rsvps},
    {tab:'Druzina_Requests',kind:'TRAINING',count:enquiries},
    {tab:'Leads',kind:'B2B',count:b2b,scan:b2b+academy},
    {tab:'Leads',kind:'ACADEMY',count:academy,scan:b2b+academy}
  ].forEach(function(spec){
    if(!spec.count)return;
    var sh=ss.getSheetByName(spec.tab);
    if(!sh||sh.getLastRow()<=spec.count)return;
    var take=Math.min(spec.scan||spec.count,IMP_OWNER_DIGEST_SAMPLE_LIMIT*2);
    var first=sh.getLastRow()-take+1;
    var m=impHeader_(sh).map;
    var rows=sh.getRange(first,1,take,sh.getLastColumn()).getDisplayValues();
    function v(row,k){return m[k]===undefined?'':String(row[m[k]]||'').trim();}
    rows.forEach(function(row,i){
      var n=first+i;
      if(spec.kind==='RSVP'){
        if(!/^WEBSITE_RSVP_SUPABASE_/.test(v(row,'Source_Channel'))||
           !/^[0-9a-f-]{36}$/i.test(v(row,'Submission_ID')))return;
        samples.push({kind:'RSVP',row:n,eventId:v(row,'Event_ID').slice(0,90),
          status:v(row,'RSVP_Status').slice(0,20)});
      }else if(spec.kind==='TRAINING'){
        if(!/^ENQ-[0-9a-f-]{36}$/i.test(v(row,'Request_ID')))return;
        samples.push({kind:'TRAINING',row:n,
          training:v(row,'Request_Type')==='RETURNING_TRAINING_ENQUIRY'?'RETURNING':'FIRST'});
      }else if(spec.kind==='B2B'){
        if(!/^OSVC-B2B-[0-9a-f-]{36}$/i.test(v(row,'Submission_ID')))return;
        var budget=/;\s*Budget:\s*([A-Za-z0-9+_-]{1,24})\s*CZK(?:;|$)/.exec(v(row,'Notes'));
        samples.push({kind:'B2B',row:n,service:v(row,'Service').slice(0,45),
          priority:v(row,'Priority').slice(0,6),budget:budget?budget[1]:''});
      }else if(spec.kind==='ACADEMY'){
        if(!/^OSVC-ACADEMY-[0-9a-f-]{36}$/i.test(v(row,'Submission_ID')))return;
        samples.push({kind:'ACADEMY',row:n,service:v(row,'Product_ID').slice(0,25)});
      }
    });
  });
  return samples;
}
function impQueueOwnerDigest_(rsvps,enquiries,b2b,ss,academy){
  b2b=b2b||0;academy=academy||0;
  if(!Number.isSafeInteger(rsvps)||!Number.isSafeInteger(enquiries)||!Number.isSafeInteger(b2b)||
     !Number.isSafeInteger(academy)||rsvps<0||enquiries<0||b2b<0||academy<0)throw Error('Invalid new intake counts');
  if(rsvps+enquiries+b2b+academy===0)return;
  var p=PropertiesService.getScriptProperties(),pending=impPendingDigest_(),fresh=[];
  try{fresh=impDigestNewRows_(ss,rsvps,enquiries,b2b,academy);}
  catch(e){console.error('Optional owner digest details unavailable; counts retained');}
  var state={
    rsvps:pending.rsvps+rsvps,enquiries:pending.enquiries+enquiries,b2b:pending.b2b+b2b,academy:pending.academy+academy,
    items:pending.items.concat(fresh).slice(-IMP_OWNER_DIGEST_SAMPLE_LIMIT)
  };
  var serialized=JSON.stringify(state);
  while(serialized.length>7800&&state.items.length){
    state.items.shift();
    serialized=JSON.stringify(state);
  }
  p.setProperty(IMP_PRIVATE_NOTIFY_PENDING,serialized);
}
/** Public event title/date from the existing catalog or the existing RSVP
 * control tab; neither source exposes attendee contact details here.
 */
function impOwnerDigestEvents_(ss,events){
  var out={};
  Object.keys(events||{}).forEach(function(id){
    var e=events[id]||{},d=e.begins_at?new Date(e.begins_at):null;
    out[id]={title:String(e.title||id).replace(/[\r\n]/g,' ').slice(0,130),
      date:d&&isFinite(d.getTime())&&typeof Utilities!=='undefined'?
        Utilities.formatDate(d,'Europe/Prague','dd.MM.yyyy HH:mm'):''};
  });
  if(!ss)return out;
  var sh=ss.getSheetByName('RSVP_Control');
  if(!sh||sh.getLastRow()<2)return out;
  var rows=sh.getRange(2,1,Math.min(sh.getLastRow()-1,150),3).getDisplayValues();
  rows.forEach(function(r){
    var id=String(r[2]||'').trim();
    if(!id)return;
    var title=String(r[1]||'').replace(/[\r\n]/g,' ').slice(0,130);
    var date=String(r[0]||'').trim().slice(0,30);
    if(!out[id])out[id]={title:title||id,date:date};
    else {
      if(!out[id].title||out[id].title===id)out[id].title=title||id;
      if(!out[id].date)out[id].date=date;
    }
  });
  return out;
}
function impOwnerDigestRowUrl_(cfg,ss,tab,row){
  var root='https://docs.google.com/spreadsheets/d/'+cfg.sheetId+'/edit';
  if(!ss||!Number.isSafeInteger(row)||row<2)return root;
  var sh=ss.getSheetByName(tab);
  return sh?root+'#gid='+sh.getSheetId()+'&range=A'+row:root;
}
function impFlushOwnerDigest_(cfg,ss,events){
  var pending=impPendingDigest_(),n=pending.rsvps+pending.enquiries+pending.b2b+pending.academy;
  if(n===0)return {sent:false,pending:false};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email))throw Error('Missing owner digest address');
  var titleById={};
  try{titleById=impOwnerDigestEvents_(ss,events);}
  catch(e){console.error('Owner digest event titles unavailable; using IDs');}
  var list=Array.isArray(pending.items)?pending.items:[],lines=[
    'Nové požadavky z webových formulářů: '+n,
    'Počty se vztahují k novým záznamům, ne k potvrzené účasti ani platbám.'
  ];
  var rsvp=list.filter(function(x){return x&&x.kind==='RSVP';});
  var training=list.filter(function(x){return x&&x.kind==='TRAINING';});
  var b2b=list.filter(function(x){return x&&x.kind==='B2B';});
  var academy=list.filter(function(x){return x&&x.kind==='ACADEMY';});
  if(pending.rsvps){
    lines.push('','REGISTRACE NA AKCE — nové odpovědi: '+pending.rsvps);
    var grouped={};
    rsvp.forEach(function(item){
      var key=String(item.eventId||'neznámá akce');
      if(!grouped[key])grouped[key]={rows:[],yes:0,maybe:0,no:0};
      var group=grouped[key];
      group.rows.push(item.row);
      if(item.status==='REGISTERED')group.yes++;
      else if(item.status==='MAYBE')group.maybe++;
      else if(item.status==='DECLINED')group.no++;
    });
    Object.keys(grouped).forEach(function(id){
      var group=grouped[id],event=titleById[id]||{},
        eventName=event.title||id;
      lines.push('• '+eventName+(event.date?' — '+event.date:''));
      lines.push('  Nové odpovědi: '+group.rows.length+
        ' | chce přijít: '+group.yes+' | možná: '+group.maybe+' | nepřijde: '+group.no);
      group.rows.forEach(function(row){
        lines.push('  Otevřít přihlášku: '+impOwnerDigestRowUrl_(cfg,ss,'Registrations',row));
      });
    });
    if(!rsvp.length)lines.push('Podrobnosti jsou v listu Registrations.');
    lines.push('Stav „chce přijít“ znamená odeslaný formulář, ne potvrzené místo.');
  }
  if(pending.enquiries){
    lines.push('','DRUŽINA MORAVY — zájem o první / další trénink: '+pending.enquiries);
    training.forEach(function(item){
      lines.push('• '+(item.training==='RETURNING'?'Opakovaná návštěva':'První návštěva')+
        ' | '+impOwnerDigestRowUrl_(cfg,ss,'Druzina_Requests',item.row));
    });
    if(!training.length)lines.push('Podrobnosti jsou v listu Druzina_Requests.');
    lines.push('Zájem o trénink není potvrzená rezervace.');
  }
  if(pending.b2b){
    lines.push('','FIREMNÍ OSVČ POPTÁVKY — nové obchodní poptávky: '+pending.b2b);
    b2b.forEach(function(item){
      lines.push('• '+(item.service||'Firemní služba')+
        (item.budget?' | rozpočet (deklarovaný): '+item.budget+' Kč':'')+
        (item.priority?' | priorita: '+item.priority:''));
      lines.push('  Otevřít lead: '+impOwnerDigestRowUrl_(cfg,ss,'Leads',item.row));
    });
    if(!b2b.length)lines.push('Podrobnosti jsou v listu Leads.');
    lines.push('Poptávka není objednávka, smlouva, faktura ani příjem.');
  }
  if(pending.academy){
    lines.push('','ACADEMY — nové nezávazné poptávky výuky: '+pending.academy);
    academy.forEach(function(item){
      lines.push('• '+(item.service||'lekce')+' | '+impOwnerDigestRowUrl_(cfg,ss,'Leads',item.row));
    });
    if(!academy.length)lines.push('Detaily v EXISTUJÍCÍM listu Leads.');
    lines.push('Poptávka NEZNAMENÁ potvrzený volný termín, platbu ani dohodu.');
  }
  if(rsvp.length+training.length+b2b.length+academy.length<n)
    lines.push('','V e-mailu jsou jen poslední dostupné náhledy; úplné údaje jsou v CRM.');
  lines.push('','DALŠÍ KROK: zkontrolovat uvedené záznamy v CRM, ověřit dostupnost a odpovědět individuálně.',
    'CRM: https://docs.google.com/spreadsheets/d/'+cfg.sheetId+'/edit');
  var subject='[Imperion] Nové žádosti: '+n;
  if(n===1&&pending.rsvps===1){
    var item=rsvp[0],event=item&&titleById[item.eventId];
    subject='[Imperion] Nová registrace — '+String(event&&event.title||'akce').slice(0,64);
  }else if(n===1&&pending.enquiries===1)
    subject='[Imperion] Nový zájem o trénink Družina';
  else if(n===1&&pending.b2b===1)
    subject='[Imperion] Nová firemní OSVČ poptávka';
  else if(n===1&&pending.academy===1)
    subject='[Imperion] Nová nezávazná poptávka Academy';
  try{
    MailApp.sendEmail(cfg.email,subject,lines.join('\n'));
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
    var addedR=0,addedE=0,addedB=0,addedA=0,processed=0;
    // One safe public price lookup; never infer paid status from a blank/unknown fee.
    var events=impReceiptCatalog_();
    for(var i=0;i<4;i++){
      var batch=impPrivateFetch_(cfg,null);
      if(batch.protocol!=='imperion-intake-bridge-v1'||
         !Array.isArray(batch.rsvps)||!Array.isArray(batch.enquiries)||!Array.isArray(batch.b2b)||!Array.isArray(batch.academy))
        throw Error('Private intake response schema changed');
      if(!batch.rsvps.length&&!batch.enquiries.length&&!batch.b2b.length&&!batch.academy.length)break;
      var a=impWriteRsvps_(ss,batch.rsvps,events);
      var b=impWriteEnquiries_(ss,batch.enquiries);
      var c=impWriteB2B_(ss,batch.b2b);
      var d=impWriteAcademy_(ss,batch.academy);
      // Persist the owner-notification receipt BEFORE acknowledging the source;
      // a mail outage or later crash must not silently discard new leads.
      impQueueOwnerDigest_(a.added,b.added,c.added,ss,d.added);
      // Acknowledge only AFTER CRM writes/readback and notification queuing succeed.
      impPrivateFetch_(cfg,{action:'ack',rsvps:a.ids,enquiries:b.ids,b2b:c.ids,academy:d.ids});
      addedR+=a.added;addedE+=b.added;addedB+=c.added;addedA+=d.added;
      processed+=a.ids.length+b.ids.length+c.ids.length+d.ids.length;
      if(a.ids.length<40&&b.ids.length<40&&c.ids.length<40&&d.ids.length<40)break;
    }
    // Retry a previously failed digest even if this run has no new rows.
    impFlushOwnerDigest_(cfg,ss,events);
    var receipts=impSendReceiptQueue_(ss,cfg,events);
    var followups=impSendAttendedFollowups_(ss,cfg);
    var chatInvites=impSendApprovedChatInvites_(ss,cfg);
    console.log('Private intake receipts: dispatched='+receipts.sent+', errors='+receipts.failed);
    console.log('Private intake: new RSVP='+addedR+', enquiries='+addedE+', corporate OSVC='+addedB+', Academy OSVC='+addedA+', acked='+processed);
    return {newRsvps:addedR,newEnquiries:addedE,newB2B:addedB,newAcademy:addedA,acked:processed,receipts:receipts,followups:followups,chatInvites:chatInvites};
  }finally{lock.releaseLock();}
}

/** Optional, separate, *approved* discussion-chat invite queue in canonical CRM.
 * Disabled until IMPERION_CHAT_INVITES_LIVE=true. No RSVP alone can set the
 * approval marker, and no chat URL is exposed to the public browser/API.
 * Chat_Access_Approval must be set by an operator after checking evidence:
 * BW = ATTENDED_VERIFIED; Družina = ATTENDED_AND_NEXT_TRAINING_PAID_VERIFIED.
 */
var IMP_CHAT_COLS=['Chat_Access_Approval','Chat_Invite_Status','Chat_Invite_Attempts','Chat_Invite_Sent_At'];
function impEnsureChatCols_(sheet){
 var h=impHeader_(sheet);
 IMP_CHAT_COLS.forEach(function(name){
  if(h.map[name]!==undefined)return;
  var col=sheet.getLastColumn()+1;
  if(col>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),1);
  sheet.getRange(1,col).setValue(name);h.map[name]=col-1;
 });
}
function impSendApprovedChatInvites_(ss,cfg){
 if(PropertiesService.getScriptProperties().getProperty('IMPERION_CHAT_INVITES_LIVE')!=='true')
  return {sent:0,failed:0,disabled:true};
 var regs=ss.getSheetByName('Registrations'),eventSheet=ss.getSheetByName('Events');
 if(!regs||!eventSheet)throw Error('Canonical CRM tabs unavailable');
 impEnsureChatCols_(regs);
 var m=impHeader_(regs).map,em=impHeader_(eventSheet).map;
 ['Email','Event_ID','Age','Check_In_At','RSVP_Status','Source_Channel',
  'Registration_Locale','Data_Controller'].concat(IMP_CHAT_COLS).forEach(function(k){
   if(m[k]===undefined)throw Error('Missing Registrations.'+k);
 });
 ['Event_ID','Community','Data_Controller','Status'].forEach(function(k){
   if(em[k]===undefined)throw Error('Missing Events.'+k);
 });
 var byId={};
 eventSheet.getDataRange().getDisplayValues().slice(1).forEach(function(row){
  var id=String(row[em.Event_ID]||'').trim();
  if(id&&!/cancel|zruš|withdraw/i.test(String(row[em.Status]||''))){
   byId[id]={community:String(row[em.Community]||''),
     controller:String(row[em.Data_Controller]||'').trim()};
  }
 });
 var quota=Math.max(0,MailApp.getRemainingDailyQuota()-3),
     max=Math.min(10,quota),sent=0,failed=0;
 if(!max||regs.getLastRow()<2)return {sent:0,failed:0,quotaBlocked:!max};
 var rows=regs.getRange(2,1,regs.getLastRow()-1,regs.getLastColumn()).getDisplayValues();
 rows.forEach(function(row,i){
  if(sent>=max)return;
  var v=function(k){return String(row[m[k]]||'').trim();};
  var ev=byId[v('Event_ID')];
  if(!ev||!ev.controller||ev.controller!==v('Data_Controller')||
     v('Source_Channel')!=='WEBSITE_RSVP_SUPABASE_UNCONFIRMED'||
     !/^adult$/i.test(v('Age'))||!v('Check_In_At')||
     /^(NO|DECLINED)$/i.test(v('RSVP_Status')))return;
  var route=impCommunityRoute_(ev.community,v('Registration_Locale'));
  if(!route)return;
  var approval=route.community==='druzina'
    ? 'ATTENDED_AND_NEXT_TRAINING_PAID_VERIFIED' : 'ATTENDED_VERIFIED';
  if(v('Chat_Access_Approval')!==approval)return;
  var email=v('Email'),state=v('Chat_Invite_Status'),
      attempts=Number(v('Chat_Invite_Attempts')||0);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||state&&state!=='RETRY')return;
  if(attempts>=3){regs.getRange(i+2,m.Chat_Invite_Status+1).setValue('FAILED_REVIEW');return;}
  // Only private Script Properties carry gated chat invitations. No URLs in GitHub.
  var chatUrl=String(PropertiesService.getScriptProperties().getProperty(route.chatProperty)||'').trim();
  var chatPattern=route.platform==='whatsapp'?/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}$/:
    /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/;
  if(!chatPattern.test(chatUrl))return; // Missing/revoked invitation: do not send.
  var locale=v('Registration_Locale'),w={
   cs:['Pozvánka do diskusního chatu','Po ověření podmínek přístupu vás zveme do diskusního chatu. Připojení je dobrovolné.','Ostatní členové WhatsAppu mohou vidět vaše telefonní číslo.','Ostatní členové Telegramu mohou vidět váš profil dle nastavení soukromí.'],
   en:['Discussion chat invitation','After verifying the membership conditions, you are invited to the discussion chat. Joining is optional.','Other WhatsApp members may see your phone number.','Other Telegram members may see your profile depending on privacy settings.'],
   ru:['Приглашение в чат сообщества','После проверки условий доступа приглашаем вас в чат. Вступление добровольное.','Участники WhatsApp могут видеть ваш номер телефона.','Участники Telegram могут видеть ваш профиль в зависимости от настроек приватности.'],
   uk:['Запрошення до чату спільноти','Після перевірки умов доступу запрошуємо до чату. Вступ добровільний.','Учасники WhatsApp можуть бачити ваш номер телефону.','Учасники Telegram можуть бачити ваш профіль залежно від налаштувань приватності.']
  }[locale]||[];
  try{
   MailApp.sendEmail({to:email,subject:w[0],body:[w[1],chatUrl,
    route.platform==='whatsapp'?w[2]:w[3]].join('\n'),
    name:route.community==='druzina'?'Družina Moravy':'BrnoWalkers',
    replyTo:cfg.email});
   regs.getRange(i+2,m.Chat_Invite_Sent_At+1).setValue(new Date());
   regs.getRange(i+2,m.Chat_Invite_Status+1).setValue('SENT_TO_PROVIDER');
   sent++;
  }catch(e){
   regs.getRange(i+2,m.Chat_Invite_Attempts+1).setValue(attempts+1);
   regs.getRange(i+2,m.Chat_Invite_Status+1).setValue(attempts+1>=3?'FAILED_REVIEW':'RETRY');
   failed++;console.error('Approved chat invite mail failed; canonical row retained');
  }
 });
 return {sent:sent,failed:failed};
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
      var sid=String(x[lm.Submission_ID]||'');
      if(!/^OSVC-(?:B2B|ACADEMY)-/.test(sid))return;
      var academyRow=sid.indexOf('OSVC-ACADEMY-')===0;
      var purgeStatus=academyRow?'OSVC_ACADEMY_EXPIRED_ANONYMIZED':'OSVC_B2B_EXPIRED_ANONYMIZED';
      if(String(x[lm.Action_Status])===purgeStatus)return;
      // A paid or legally meaningful contract must be reviewed, not auto-deleted.
      if(['New','Lost'].indexOf(String(x[lm.Stage]))<0)return;
      var date=x[lm.Retention_Until] instanceof Date?x[lm.Retention_Until]:new Date(x[lm.Retention_Until]);
      if(!isFinite(date.getTime())||date>now)return;
      ['Full_Name','Email','Phone_Number','Subject_Goal','Notes'].forEach(function(name){
        if(lm[name]!==undefined)leads.getRange(i+2,lm[name]+1).clearContent();
      });
      leads.getRange(i+2,lm.Action_Status+1).setValue(purgeStatus);
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
