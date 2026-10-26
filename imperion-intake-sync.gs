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
  names.forEach(function(name,i){if(name)map[name]=i;});
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
  sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);
}
function impWriteRsvps_(ss,items){
  var sh=ss.getSheetByName('Registrations');if(!sh)throw Error('Missing Registrations');
  var h=impHeader_(sh);if(h.map.Submission_ID===undefined)throw Error('Missing Submission_ID');
  var existing=impExisting_(sh,h.map.Submission_ID+1),ids=[],added=0;
  items.forEach(function(r){
    var id=String(r.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid RSVP id');
    if(!existing[id]){
      impAppend_(sh,h,{
        Reg_ID:'WEB-'+id,Event_ID:r.event_id||'',Timestamp:impDate_(r.created_at),
        Full_Name:[r.first_name,r.last_name].filter(Boolean).join(' '),
        Phone_Number:r.phone||'',Age:r.age_group||'',
        Guardian_Name:r.guardian_name||'',Guardian_Phone:r.guardian_phone||'',
        Photo_Consent:r.photo_choice||'NO',
        Waiver_Accepted:r.safety_acknowledged===true?'YES':'NO',
        Retention_Until:impDate_(r.retention_until),Submission_ID:id,
        RSVP_Status:r.rsvp_status||'MAYBE',RSVP_Status_At:impDate_(r.created_at),
        Payment_Status:'NOT_COLLECTED',
        Reply_Contact:r.email||r.phone||'',
        Source_Channel:'WEBSITE_RSVP_SUPABASE_UNCONFIRMED',
        Email:r.email||'',First_Name:r.first_name||'',Last_Name:r.last_name||'',
        Safety_Acknowledged:r.safety_acknowledged===true?'YES':'NO',
        Rules_Version:r.safety_version||'',Consent_Recorded_At:impDate_(r.created_at),
        Marketing_Consent:r.marketing_requested===true?'REQUESTED_UNCONFIRMED':'NO',
        Data_Controller:r.data_controller||'',Registration_Locale:r.language||''
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
        Notes:'Website enquiry only. Safety acknowledged; no booking or payment confirmed.'
      });
      existing[key]=true;added++;
    }
    ids.push(id);
  });
  return {ids:ids,added:added};
}
/** Run manually once first, then enable owner-created time triggers. */
function imperionSyncPrivateIntake(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(12000))throw Error('Another intake run is already in progress');
  try{
    var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId);
    var addedR=0,addedE=0,processed=0;
    for(var i=0;i<4;i++){
      var batch=impPrivateFetch_(cfg,null);
      if(batch.protocol!=='imperion-intake-bridge-v1'||
         !Array.isArray(batch.rsvps)||!Array.isArray(batch.enquiries))
        throw Error('Private intake response schema changed');
      if(!batch.rsvps.length&&!batch.enquiries.length)break;
      var a=impWriteRsvps_(ss,batch.rsvps);
      var b=impWriteEnquiries_(ss,batch.enquiries);
      // Acknowledge only AFTER all private CRM writes succeed.
      impPrivateFetch_(cfg,{action:'ack',rsvps:a.ids,enquiries:b.ids});
      addedR+=a.added;addedE+=b.added;processed+=a.ids.length+b.ids.length;
      if(a.ids.length<40&&b.ids.length<40)break;
    }
    if(addedR+addedE>0&&cfg.email){
      // Owner-only count digest, not attendee/guardian details.
      try{
        MailApp.sendEmail(cfg.email,'[Imperion] Новые заявки: '+(addedR+addedE),
          'Заявки на мероприятия: '+addedR+'\n'+
          'Запросы тренировок Družina: '+addedE+'\n\n'+
          'Контакты в существующей CRM:\n'+
          'https://docs.google.com/spreadsheets/d/'+cfg.sheetId+'/edit\n\n'+
          'Ни участие, ни оплата не подтверждены автоматически.');
      }catch(e){console.error('Private intake digest failed; CRM rows already saved');}
    }
    console.log('Private intake: new RSVP='+addedR+', enquiries='+addedE+', acked='+processed);
    return {newRsvps:addedR,newEnquiries:addedE,acked:processed};
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
  console.log('Private intake anonymized '+cleared+' expired rows');
  return cleared;
}
/** Run once as the owner. Existing unrelated triggers are preserved. */
function imperionInstallPrivateIntake(){
  var cfg=impPrivateConfig_();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email))
    throw Error('IMPERION_NOTIFY_EMAIL must be configured');
  var triggers=ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction()});
  if(triggers.indexOf('imperionSyncPrivateIntake')<0)
    ScriptApp.newTrigger('imperionSyncPrivateIntake').timeBased().everyHours(1).create();
  if(triggers.indexOf('imperionCleanupPrivateIntake')<0)
    ScriptApp.newTrigger('imperionCleanupPrivateIntake').timeBased().everyDays(1).atHour(4).create();
  return {installed:true};
}
