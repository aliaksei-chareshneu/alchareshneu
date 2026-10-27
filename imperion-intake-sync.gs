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
  var receipt=Object.prototype.hasOwnProperty.call(object,'Submission_ID')?'Submission_ID':
    (Object.prototype.hasOwnProperty.call(object,'Request_ID')?'Request_ID':'');
  if(receipt&&headers.map[receipt]!==undefined&&
     sheet.getRange(nextRow,headers.map[receipt]+1).getDisplayValue().trim()!==String(object[receipt]))
    throw Error('CRM append readback failed: '+receipt);
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
        Priority:priority
      });
      existing[key]=true;added++;
    }
    ids.push(id);
  });
  return {ids:ids,added:added};
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
    var addedR=0,addedE=0,addedB=0,processed=0;
    for(var i=0;i<4;i++){
      var batch=impPrivateFetch_(cfg,null);
      if(batch.protocol!=='imperion-intake-bridge-v1'||
         !Array.isArray(batch.rsvps)||!Array.isArray(batch.enquiries)||!Array.isArray(batch.b2b))
        throw Error('Private intake response schema changed');
      if(!batch.rsvps.length&&!batch.enquiries.length&&!batch.b2b.length)break;
      var a=impWriteRsvps_(ss,batch.rsvps);
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
    console.log('Private intake: new RSVP='+addedR+', enquiries='+addedE+', corporate OSVC='+addedB+', acked='+processed);
    return {newRsvps:addedR,newEnquiries:addedE,newB2B:addedB,acked:processed};
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
  var triggers=ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction()});
  if(triggers.indexOf('imperionSyncPrivateIntake')<0)
    ScriptApp.newTrigger('imperionSyncPrivateIntake').timeBased().everyHours(1).create();
  if(triggers.indexOf('imperionCleanupPrivateIntake')<0)
    ScriptApp.newTrigger('imperionCleanupPrivateIntake').timeBased().everyDays(1).atHour(4).create();
  return {installed:true};
}
