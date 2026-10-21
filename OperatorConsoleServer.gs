/** Private owner console over the existing Community Hub. No new datastore. */
function ocId_(){if(typeof RP!=='undefined'&&RP.SPREADSHEET_ID)return RP.SPREADSHEET_ID;if(typeof SPREADSHEET_ID!=='undefined')return SPREADSHEET_ID;throw Error('Existing Hub binding missing');}
function ocOwner_(){
 var file=DriveApp.getFileById(ocId_()),owner=file.getOwner();
 var active=String(Session.getActiveUser().getEmail()||'').toLowerCase();
 if(!owner||!active||active!==owner.getEmail().toLowerCase())throw Error('Owner sign-in required');
 if(file.getSharingAccess()!==DriveApp.Access.PRIVATE||file.getEditors().length||file.getViewers().length)throw Error('Owner-only Hub required');
}
function operatorOpen(){ocOwner_();SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('OperatorConsole').setWidth(1100).setHeight(760),'IMPERION · Operations');}
function operatorInstallMenu(){ocOwner_();SpreadsheetApp.getUi().createMenu('IMPERION').addItem('Открыть приложение','operatorOpen').addToUi();}
function ocRows_(ss,name){
 var sh=ss.getSheetByName(name);if(!sh)return {missing:true,rows:[],url:''};
 if(sh.getLastRow()>10000)throw Error('Dataset exceeds console read limit');
 var data=sh.getDataRange().getValues(),h=data.shift()||[];
 return {missing:false,headers:h,url:ss.getUrl()+'#gid='+sh.getSheetId(),rows:data.map(function(r){var x={};h.forEach(function(k,i){x[k]=r[i] instanceof Date?r[i].toISOString():r[i];});return x;})};
}
function ocIsTest_(r){return /TEST-ONLY|QA TEST|SYNTHETIC|NO.CONTACT/i.test([r.Lead_ID,r.Full_Name,r.Subject_Goal,r.Notes].join(' '));}
/** Do not guess a timezone for text timestamps or normalize impossible dates. */
function ocLeadDeadline_(value,now,today){
 var text=value instanceof Date?(isFinite(value.getTime())?value.toISOString():'Invalid Date'):String(value==null?'':value).trim();
 if(!text)return {state:'NO_DATE',day:'',at:0,text:''};
 var day=text.slice(0,10),midnight=Date.parse(day+'T00:00:00Z');
 var validDay=/^\d{4}-\d{2}-\d{2}$/.test(day)&&isFinite(midnight)&&new Date(midnight).toISOString().slice(0,10)===day;
 if(validDay&&text===day)return {state:day<today?'OVERDUE':day===today?'TODAY':'UPCOMING',day:day,at:Infinity,text:text};
 var match=text.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/);
 if(!validDay||!match||Number(match[1])>23||Number(match[2])>59||Number(match[3]||0)>59||
    Number(match[5]||0)>14||Number(match[6]||0)>59||Number(match[5]||0)===14&&Number(match[6]||0)!==0){
  return {state:'INVALID_DATE',day:'',at:0,text:text};
 }
 var at=Date.parse(text);
 if(!isFinite(at))return {state:'INVALID_DATE',day:'',at:0,text:text};
 var localDay=Utilities.formatDate(new Date(at),'Europe/Prague','yyyy-MM-dd');
 return {state:at<now?'OVERDUE':localDay===today?'TODAY':'UPCOMING',day:localDay,at:at,text:text};
}
function ocLeadSummary_(rows,now){
 now=now===undefined?Date.now():Number(now);
 if(!isFinite(now))throw Error('Invalid lead queue clock');
 var records=rows.filter(function(r){return Object.keys(r).some(function(k){return r[k]!=null&&String(r[k]).trim()!=='';});});
 var valid=records.filter(function(r){return !ocIsTest_(r);}),stages={};
 valid.forEach(function(r){var k=String(r.Stage||'Unknown');stages[k]=(stages[k]||0)+1;});
 var today=Utilities.formatDate(new Date(now),'Europe/Prague','yyyy-MM-dd');
 var rank={OVERDUE:0,TODAY:1,INVALID_DATE:2,NO_DATE:3,UPCOMING:4};
 var candidates=valid.filter(function(r){return !/^(CLOSED|HOLD|DORMANT|WAIT)/.test(String(r.Action_Status||'').trim().toUpperCase())&&!/^(LOST|WON)$/.test(String(r.Stage||'').trim().toUpperCase());})
  .map(function(r,i){return {row:r,index:i,deadline:ocLeadDeadline_(r.Next_Action_At,now,today)};});
 var queue={total:candidates.length,overdue:0,today:0,upcoming:0,noDate:0,invalidDate:0,shown:Math.min(candidates.length,40),limit:40,truncated:candidates.length>40,timeZone:'Europe/Prague'};
 var fields={OVERDUE:'overdue',TODAY:'today',UPCOMING:'upcoming',NO_DATE:'noDate',INVALID_DATE:'invalidDate'};
 candidates.forEach(function(c){queue[fields[c.deadline.state]]++;});
 candidates.sort(function(a,b){var x=a.deadline,y=b.deadline;return rank[x.state]-rank[y.state]||(x.day<y.day?-1:x.day>y.day?1:0)||(x.at<y.at?-1:x.at>y.at?1:0)||a.index-b.index;});
 return {count:valid.length,excludedTests:records.length-valid.length,stages:stages,queue:queue,
   needsAction:candidates.slice(0,40).map(function(c){var r=c.row;return {id:r.Lead_ID,service:r.Service,stage:r.Stage,next:c.deadline.text,status:r.Action_Status,dueState:c.deadline.state};}),
   cash:null,contracted:null,weighted30:null};
}
function ocSocialSummary_(rows){
 return rows.map(function(r){var status=String(r.Status||'DRAFT'),receipt=String(r.Post_URL||'');
  return {id:r.Job_ID,event:r.Event_ID,channel:r.Channel,status:status,scheduled:r.Scheduled_At||'',
   verified:status==='PUBLISHED_VERIFIED'&&!!receipt,receipt:receipt,error:r.Error||''};});
}
function ocBankState_(props,prefix){
 var last=props.getProperty(prefix+'_LAST_OK_AT')||'',raw=props.getProperty(prefix+'_LAST_BANK_BALANCE');
 var age=last?Date.now()-Date.parse(last):NaN,verified=isFinite(age)&&age>=0&&age<2*3600000;
 return {configured:!!props.getProperty(prefix+'_READ_TOKEN')&&!!props.getProperty(prefix+'_EXPECTED_ACCOUNT_ID'),
  lastSuccess:last,fresh:verified,balance:verified&&raw!==null&&String(raw).trim()!==''&&isFinite(Number(raw))?Number(raw):null};
}

/** Local project capabilities only; never infer another project's configuration. */
function ocCapabilities_(p){
 var hasRecovery=typeof platformRecoveryPreview==='function' && typeof RP!=='undefined' && typeof rpOnLeadFormSubmit==='function';
 var recoveryState=!hasRecovery?'MODULE_MISSING':p.getProperty('PLATFORM_RECOVERY_PAUSED')==='true'?'PAUSED':p.getProperty('PLATFORM_RECOVERY_PAUSED')==='false'?'ENABLED_NOT_VERIFIED':'NOT_CONFIGURED';
 function bankReady(prefix,installed){
  return installed && /^[A-Za-z0-9]{64}$/.test(p.getProperty(prefix+'_READ_TOKEN')||'') &&
   /^\d{6,20}$/.test(p.getProperty(prefix+'_EXPECTED_ACCOUNT_ID')||'') &&
   p.getProperty(prefix+'_ENTITY_CONFIRMED')==='true';
 }
 return {recoveryState:recoveryState,actions:{
  previewRecovery:hasRecovery,
  pauseRecovery:hasRecovery && typeof platformPauseRecovery==='function' && recoveryState==='ENABLED_NOT_VERIFIED',
  previewPayments:typeof paymentReconciliationPreview==='function',
  syncOSVC:bankReady('FIO_OSVC',typeof fioSyncOSVCReadOnly==='function'),
  syncDruzina:bankReady('FIO_DRUZINA',typeof fioSyncDruzinaReadOnly==='function')
 }};
}

function operatorSnapshot(){
 ocOwner_();var ss=SpreadsheetApp.openById(ocId_()),p=PropertiesService.getScriptProperties();
 var leads=ocRows_(ss,'Leads');
 if(!leads.missing&&['Lead_ID','Full_Name','Subject_Goal','Notes','Stage','Next_Action_At','Action_Status','Service'].some(function(k){return leads.headers.filter(function(h){return h===k;}).length!==1;}))throw Error('Leads schema missing or duplicate required column');
 var social=ocRows_(ss,'SocialPublishing'),events=ocRows_(ss,'Events'),config=ocRows_(ss,'Revenue_Config');
 var cfg={};config.rows.forEach(function(r){cfg[r.Key]=r.Value;});var now=Date.now();
 return {capabilities:ocCapabilities_(p),at:new Date(now).toISOString(),hub:ss.getUrl(),leads:ocLeadSummary_(leads.rows,now),leadUrl:leads.url,
  ingestion:cfg.STATUS||'NOT_VERIFIED',social:ocSocialSummary_(social.rows),socialUrl:social.url,
  events:events.rows.filter(function(r){return r.Status==='Active';}).map(function(r){return {id:r.Event_ID,title:r.Title,date:r.Start_DateTime,community:r.Community};}),eventUrl:events.url,
  banks:{osvc:ocBankState_(p,'FIO_OSVC'),druzina:ocBankState_(p,'FIO_DRUZINA')},
  recoveryPaused:p.getProperty('PLATFORM_RECOVERY_PAUSED')!=='false',
  missing:[leads.missing?'Leads':'',social.missing?'SocialPublishing':'',events.missing?'Events':''].filter(Boolean)};
}
function operatorAction(action){
 ocOwner_();
 // Explicit allow-list: no arbitrary handler execution, mass sending or payment writes.
 if(action==='previewPayments'){if(typeof paymentReconciliationPreview!=='function')throw Error('Payment reconciliation module not installed');return paymentReconciliationPreview();}
 if(action==='previewRecovery'){if(typeof platformRecoveryPreview!=='function')throw Error('Recovery module not installed');return platformRecoveryPreview();}
 if(action==='pauseRecovery'){if(typeof platformPauseRecovery!=='function')throw Error('Recovery module not installed');return platformPauseRecovery();}
 if(action==='syncOSVC'){if(typeof fioSyncOSVCReadOnly!=='function')throw Error('OSVC bank module not installed');return fioSyncOSVCReadOnly();}
 if(action==='syncDruzina'){if(typeof fioSyncDruzinaReadOnly!=='function')throw Error('NGO bank module not installed');return fioSyncDruzinaReadOnly();}
 throw Error('Unsupported action');
}

