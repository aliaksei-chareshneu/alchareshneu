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
/** Shared strict ISO parsing; local event text has a separate explicit Prague parser. */
function ocDateValue_(value){
 var text=value instanceof Date?(isFinite(value.getTime())?value.toISOString():'Invalid Date'):String(value==null?'':value).trim();
 if(!text)return {kind:'MISSING',day:'',at:0,text:''};
 var day=text.slice(0,10),midnight=Date.parse(day+'T00:00:00Z');
 var validDay=/^\d{4}-\d{2}-\d{2}$/.test(day)&&isFinite(midnight)&&new Date(midnight).toISOString().slice(0,10)===day;
 if(validDay&&text===day)return {kind:'DAY',day:day,at:Infinity,text:text};
 var match=text.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/);
 if(!validDay||!match||Number(match[1])>23||Number(match[2])>59||Number(match[3]||0)>59||
    Number(match[5]||0)>14||Number(match[6]||0)>59||Number(match[5]||0)===14&&Number(match[6]||0)!==0){
  return {kind:'INVALID',day:'',at:0,text:text};
 }
 var at=Date.parse(text);
 if(!isFinite(at))return {kind:'INVALID',day:'',at:0,text:text};
 return {kind:'TIME',day:day,at:at,text:text};
}
function ocLeadDeadline_(value,now,today){
 var parsed=ocDateValue_(value);
 if(parsed.kind==='MISSING'||parsed.kind==='INVALID')return {state:parsed.kind==='MISSING'?'NO_DATE':'INVALID_DATE',day:'',at:0,text:parsed.text};
 var day=parsed.kind==='DAY'?parsed.day:Utilities.formatDate(new Date(parsed.at),'Europe/Prague','yyyy-MM-dd');
 return {state:parsed.kind==='DAY'?(day<today?'OVERDUE':day===today?'TODAY':'UPCOMING'):(parsed.at<now?'OVERDUE':day===today?'TODAY':'UPCOMING'),day:day,at:parsed.at,text:parsed.text};
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
/** A stored receipt is not a provider recheck. Never expose credential-bearing URLs. */
function ocSocialReceipt_(value){
 var text=String(value==null?'':value).trim();
 if(text.length>2048||/[\s\\<>"'\x00-\x1f\x7f]/.test(text))return '';
 var match=text.match(/^https:\/\/([^/?#]+)(?:[/?#].*)?$/i);if(!match)return '';
 var host=match[1].replace(/:443$/,'').toLowerCase(),labels=host.split('.');
 if(host.length>253||labels.length<2||!/[a-z]/.test(labels[labels.length-1])||!labels.every(function(label){return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);}))return '';
 var query=[text.split('#')[0].split('?').slice(1).join('?'),text.split('#').slice(1).join('#')].join('&');
 try{
  if(query.split('&').some(function(part){var key=decodeURIComponent(part.split('=')[0].replace(/\+/g,' ')).toLowerCase().replace(/-/g,'_');return /^(token|access_token|api_?key|authorization|key|secret|sig|signature|x_amz_.*|x_goog_.*)$/.test(key);}))return '';
 }catch(_){return '';}
 return text;
}
function ocSocialSummary_(rows){
 var pending={APPROVED:'WAITING',BUFFER_APPROVED:'WAITING',SCHEDULED:'WAITING',SCHEDULED_PENDING:'WAITING',BUFFER_QUEUED:'WAITING',QUEUED:'WAITING',CLAIMED:'IN_PROGRESS',BUFFER_SUBMITTING:'IN_PROGRESS',DELIVERY_IN_PROGRESS:'IN_PROGRESS'};
 var review={REVIEW_REQUIRED:'REVIEW_REQUIRED',DELIVERY_UNVERIFIED:'REVIEW_REQUIRED',READY_MANUAL:'MANUAL_ACTION',PUBLISHED:'UNVERIFIED_STATUS',ALREADY_POSTED:'UNVERIFIED_STATUS',MANUAL_OWNER_CONFIRMED:'UNVERIFIED_STATUS',MANUAL_LINK_RECORDED:'UNVERIFIED_STATUS',MANUAL_VERIFIED:'UNVERIFIED_STATUS'};
 var rank={ATTENTION:0,PENDING:1,DRAFT:2,INACTIVE:3,VERIFIED:4};
 return rows.filter(function(r){return Object.keys(r).some(function(k){return r[k]!=null&&String(r[k]).trim()!=='';});}).map(function(r,index){
  var status=String(r.Status||'').trim().toUpperCase(),error=String(r.Error||'').trim(),receipt=ocSocialReceipt_(r.Post_URL);
  if(status.length>80)status='UNKNOWN';
  var state='ATTENTION',reason='UNKNOWN_STATUS';
  if(status==='PUBLISHED_VERIFIED'){state=receipt&&!error?'VERIFIED':'ATTENTION';reason=error?'RECORD_CONFLICT':receipt?'VERIFIED':'MISSING_RECEIPT';}
  else if(Object.prototype.hasOwnProperty.call(pending,status)){state='PENDING';reason=pending[status];}
  else if(Object.prototype.hasOwnProperty.call(review,status))reason=review[status];
  else if(status==='DRAFT'){state='DRAFT';reason='DRAFT';}
  else if(/^(CANCELLED|CANCELED|SKIPPED|ARCHIVED)$/.test(status)){state='INACTIVE';reason='INACTIVE';}
  else if(/^(ERROR|FAILED|BLOCKED)(?:_[A-Z0-9_]+)?$/.test(status)||/^(QUOTA_EXCEEDED|RATE_LIMITED)$/.test(status))reason='PUBLISH_ERROR';
  else status='UNKNOWN';
  if(state!=='INACTIVE'&&status!=='UNKNOWN'&&status!=='PUBLISHED_VERIFIED'&&error&&!(state==='PENDING'&&/^QUEUED_ONLY(?:;|$)/i.test(error))){state='ATTENTION';reason='PUBLISH_ERROR';}
  if(reason==='PUBLISH_ERROR'&&/LIMIT|QUOTA|RATE_LIMIT/.test(status))reason='PROVIDER_LIMIT';
  if(reason==='PUBLISH_ERROR'&&/quota|rate[_ -]?limit|account[_ -]?limit|too many requests|\b429\b|лимит|квот/i.test(error))reason='PROVIDER_LIMIT';
  var scheduled=r.Scheduled_At instanceof Date?r.Scheduled_At.toISOString():String(r.Scheduled_At==null?'':r.Scheduled_At);
  return {id:String(r.Job_ID==null?'':r.Job_ID),event:String(r.Event_ID==null?'':r.Event_ID),channel:String(r.Channel==null?'':r.Channel),status:status,scheduled:scheduled,
   state:state,reason:reason,verified:state==='VERIFIED',receipt:state==='VERIFIED'?receipt:'',index:index};
 }).sort(function(a,b){return rank[a.state]-rank[b.state]||a.index-b.index;}).map(function(r){delete r.index;return r;});
}
function ocSocialQueue_(rows){
 var items=ocSocialSummary_(rows),queue={total:items.length,attention:0,pending:0,draft:0,inactive:0,verified:0,shown:Math.min(items.length,100),limit:100,truncated:items.length>100};
 var fields={ATTENTION:'attention',PENDING:'pending',DRAFT:'draft',INACTIVE:'inactive',VERIFIED:'verified'};
 items.forEach(function(r){queue[fields[r.state]]++;});return {rows:items.slice(0,100),queue:queue};
}
function ocEventTime_(value){
 var parsed=ocDateValue_(value);if(parsed.kind!=='INVALID')return parsed;
 // Existing Events text format is local Prague time, unlike timezone-free lead deadlines.
 if(!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(parsed.text))return parsed;
 var text=parsed.text.replace('T',' '),pattern=text.length===16?'yyyy-MM-dd HH:mm':'yyyy-MM-dd HH:mm:ss';
 try{
  var date=Utilities.parseDate(text,'Europe/Prague',pattern),at=date.getTime();
  if(!isFinite(at)||Utilities.formatDate(date,'Europe/Prague',pattern)!==text)return parsed;
  // A second matching instant means the wall-clock time is ambiguous during a rollback.
  if([-7200000,-3600000,3600000,7200000].some(function(shift){return Utilities.formatDate(new Date(at+shift),'Europe/Prague',pattern)===text;}))return {kind:'AMBIGUOUS',text:parsed.text,day:'',at:0};
  return {kind:'TIME',text:parsed.text,day:text.slice(0,10),at:at};
 }catch(_){return parsed;}
}
function ocEventQueue_(rows,now){
 now=now===undefined?Date.now():Number(now);if(!isFinite(now))throw Error('Invalid event agenda clock');
 var today=Utilities.formatDate(new Date(now),'Europe/Prague','yyyy-MM-dd'),rank={LIVE:0,TODAY:1,UPCOMING:2,REVIEW:3,PAST:4};
 var items=rows.filter(function(r){return String(r.Status||'').trim().toUpperCase()==='ACTIVE';}).map(function(r,index){
  var start=ocEventTime_(r.Start_DateTime),end=ocEventTime_(r.End_DateTime),state='REVIEW',reason='RANGE_VALID';
  var reasons={MISSING:'MISSING',INVALID:'INVALID',DAY:'TIME_MISSING',AMBIGUOUS:'AMBIGUOUS'};
  if(start.kind!=='TIME')reason='START_'+reasons[start.kind];
  else if(end.kind!=='TIME')reason='END_'+reasons[end.kind];
  else if(end.at<=start.at)reason='END_NOT_AFTER_START';
  else state=end.at<=now?'PAST':start.at<=now?'LIVE':Utilities.formatDate(new Date(start.at),'Europe/Prague','yyyy-MM-dd')===today?'TODAY':'UPCOMING';
  return {id:String(r.Event_ID==null?'':r.Event_ID),title:String(r.Title||''),community:String(r.Community||''),date:start.text,end:end.text,
   startAt:start.kind==='TIME'?new Date(start.at).toISOString():null,endAt:end.kind==='TIME'?new Date(end.at).toISOString():null,
   state:state,reason:reason,index:index,sortAt:state==='LIVE'?end.at:state==='PAST'?-end.at:start.kind==='TIME'?start.at:Infinity};
 });
 var queue={total:items.length,live:0,today:0,upcoming:0,review:0,past:0,shown:Math.min(items.length,100),limit:100,truncated:items.length>100,timeZone:'Europe/Prague'};
 var fields={LIVE:'live',TODAY:'today',UPCOMING:'upcoming',REVIEW:'review',PAST:'past'};
 items.forEach(function(r){queue[fields[r.state]]++;});
 items.sort(function(a,b){return rank[a.state]-rank[b.state]||(a.sortAt<b.sortAt?-1:a.sortAt>b.sortAt?1:0)||a.index-b.index;});
 return {queue:queue,rows:items.slice(0,100).map(function(r){delete r.index;delete r.sortAt;return r;})};
}
function ocBankState_(props,prefix){
 var last=props.getProperty(prefix+'_LAST_OK_AT')||'',raw=props.getProperty(prefix+'_LAST_BANK_BALANCE');
 var age=last?Date.now()-Date.parse(last):NaN,verified=isFinite(age)&&age>=0&&age<2*3600000;
 return {configured:!!props.getProperty(prefix+'_READ_TOKEN')&&!!props.getProperty(prefix+'_EXPECTED_ACCOUNT_ID'),
  lastSuccess:last,fresh:verified,balance:verified&&raw!==null&&String(raw).trim()!==''&&isFinite(Number(raw))?Number(raw):null};
}

/** Local project capabilities only; never infer another project's configuration. */
function ocCapabilities_(p,ss){
 var hasRecovery=typeof platformRecoveryPreview==='function' && typeof RP!=='undefined' && typeof rpOnLeadFormSubmit==='function';
 var recoveryState=!hasRecovery?'MODULE_MISSING':p.getProperty('PLATFORM_RECOVERY_PAUSED')==='true'?'PAUSED':p.getProperty('PLATFORM_RECOVERY_PAUSED')==='false'?'ENABLED_NOT_VERIFIED':'NOT_CONFIGURED';
 // Sheet existence only: automatic refresh must not read financial rows or run a preview.
 var paymentPreviewState=typeof paymentReconciliationPreview!=='function'?'MODULE_MISSING':!ss?'NOT_CHECKED':
  !ss.getSheetByName('Druzina_Payments')?'PAYMENTS_SHEET_MISSING':
  !ss.getSheetByName('Druzina_Fio_Transactions')?'BANK_SHEET_MISSING':'READY';
 function bankReady(prefix,installed){
  return installed && /^[A-Za-z0-9]{64}$/.test(p.getProperty(prefix+'_READ_TOKEN')||'') &&
   /^\d{6,20}$/.test(p.getProperty(prefix+'_EXPECTED_ACCOUNT_ID')||'') &&
   p.getProperty(prefix+'_ENTITY_CONFIRMED')==='true';
 }
 return {recoveryState:recoveryState,paymentPreviewState:paymentPreviewState,actions:{
  previewRecovery:hasRecovery,
  pauseRecovery:hasRecovery && typeof platformPauseRecovery==='function' && recoveryState==='ENABLED_NOT_VERIFIED',
  previewPayments:paymentPreviewState==='READY',
  syncOSVC:bankReady('FIO_OSVC',typeof fioSyncOSVCReadOnly==='function'),
  syncDruzina:bankReady('FIO_DRUZINA',typeof fioSyncDruzinaReadOnly==='function')
 }};
}

/** Stored settings/markers only. Never inspect Forms or triggers on automatic reads. */
function ocRecoveryMarker_(value,now){
 var parsed=ocDateValue_(value);
 if(parsed.kind==='MISSING')return {state:'MISSING',at:null};
 if(parsed.kind!=='TIME'||parsed.at>now)return {state:'INVALID',at:null};
 return {state:'RECORDED',at:new Date(parsed.at).toISOString()};
}
function ocRecoveryDiagnostics_(p,now,mode){
 var bound=typeof RP!=='undefined'&&typeof RP.SPREADSHEET_ID==='string'&&!!RP.SPREADSHEET_ID.trim();
 var formConfigured=!!String(p.getProperty('RP_LEAD_FORM_ID')||'').trim();
 var since=ocRecoveryMarker_(p.getProperty('PLATFORM_RECOVERY_SINCE'),now);
 var lastOk=ocRecoveryMarker_(p.getProperty('PLATFORM_RECOVERY_LAST_OK'),now);
 var lastError=ocRecoveryMarker_(p.getProperty('PLATFORM_RECOVERY_LAST_ERROR_AT'),now);
 var reason=mode==='MODULE_MISSING'?'MODULE_MISSING':!bound?'BINDING_MISSING':!formConfigured?'FORM_MISSING':
  since.state==='MISSING'?'WINDOW_MISSING':[since,lastOk,lastError].some(function(m){return m.state==='INVALID';})?'INVALID_RECORD':
  lastError.state==='RECORDED'&&(lastOk.state!=='RECORDED'||Date.parse(lastError.at)>=Date.parse(lastOk.at))?'ERROR_RECORDED':
  lastOk.state!=='RECORDED'?'NO_RUN_RECORD':'RECORDS_PRESENT';
 return {mode:mode,bound:bound,formConfigured:formConfigured,since:since,lastOk:lastOk,lastError:lastError,reason:reason};
}
/** Project the existing read-only preview; never return raw module details or IDs. */
function ocRecoveryPreview_(){
 if(typeof platformRecoveryPreview!=='function')throw Error('Recovery module not installed');
 if(typeof RP==='undefined'||typeof RP.SPREADSHEET_ID!=='string'||!RP.SPREADSHEET_ID.trim())throw Error('Recovery Hub binding missing');
 var d=platformRecoveryPreview();
 function count(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n&&n>=0&&n<=9007199254740991;}
 if(!d||typeof d!=='object'||Array.isArray(d)||d.mode!=='READ_ONLY'||!count(d.responseCount)||!count(d.missingLeads)||d.missingLeads>d.responseCount||
    !count(d.batchLimit)||d.batchLimit<1||d.batchLimit>50||!count(d.exactFormTriggers)||d.recovered!==0||d.cashVerified!==false||d.publicPostsSent!==0)throw Error('Incomplete recovery preview');
 return {mode:'READ_ONLY',responseCount:d.responseCount,missingLeads:d.missingLeads,batchLimit:d.batchLimit,exactFormTriggers:d.exactFormTriggers,
  recovered:0,cashVerified:false,publicPostsSent:0,checkedAt:new Date().toISOString()};
}

function operatorSnapshot(){
 ocOwner_();var ss=SpreadsheetApp.openById(ocId_()),p=PropertiesService.getScriptProperties();
 var leads=ocRows_(ss,'Leads');
 if(!leads.missing&&['Lead_ID','Full_Name','Subject_Goal','Notes','Stage','Next_Action_At','Action_Status','Service'].some(function(k){return leads.headers.filter(function(h){return h===k;}).length!==1;}))throw Error('Leads schema missing or duplicate required column');
 var social=ocRows_(ss,'SocialPublishing');
 if(!social.missing&&['Job_ID','Event_ID','Channel','Scheduled_At','Status','Post_URL','Error'].some(function(k){return social.headers.filter(function(h){return h===k;}).length!==1;}))throw Error('SocialPublishing schema missing or duplicate required column');
 var events=ocRows_(ss,'Events');
 if(!events.missing&&['Event_ID','Title','Community','Status','Start_DateTime','End_DateTime'].some(function(k){return events.headers.filter(function(h){return h===k;}).length!==1;}))throw Error('Events schema missing or duplicate required column');
 var config=ocRows_(ss,'Revenue_Config'),publications=ocSocialQueue_(social.rows);
 var cfg={};config.rows.forEach(function(r){cfg[r.Key]=r.Value;});var now=Date.now();
 var agenda=ocEventQueue_(events.rows,now),capabilities=ocCapabilities_(p,ss);
 return {capabilities:capabilities,recoveryDiagnostics:ocRecoveryDiagnostics_(p,now,capabilities.recoveryState),at:new Date(now).toISOString(),hub:ss.getUrl(),leads:ocLeadSummary_(leads.rows,now),leadUrl:leads.url,
  ingestion:cfg.STATUS||'NOT_VERIFIED',social:publications.rows,socialQueue:publications.queue,socialUrl:social.url,
  events:agenda.rows,eventQueue:agenda.queue,eventUrl:events.url,
  banks:{osvc:ocBankState_(p,'FIO_OSVC'),druzina:ocBankState_(p,'FIO_DRUZINA')},
  recoveryPaused:p.getProperty('PLATFORM_RECOVERY_PAUSED')!=='false',
  missing:[leads.missing?'Leads':'',social.missing?'SocialPublishing':'',events.missing?'Events':''].filter(Boolean)};
}
function operatorAction(action){
 ocOwner_();
 // Explicit allow-list: no arbitrary handler execution, mass sending or payment writes.
 if(action==='previewPayments'){if(typeof paymentReconciliationPreview!=='function')throw Error('Payment reconciliation module not installed');return paymentReconciliationPreview();}
 if(action==='previewRecovery')return ocRecoveryPreview_();
 if(action==='pauseRecovery'){if(typeof platformPauseRecovery!=='function')throw Error('Recovery module not installed');return platformPauseRecovery();}
 if(action==='syncOSVC'){if(typeof fioSyncOSVCReadOnly!=='function')throw Error('OSVC bank module not installed');return fioSyncOSVCReadOnly();}
 if(action==='syncDruzina'){if(typeof fioSyncDruzinaReadOnly!=='function')throw Error('NGO bank module not installed');return fioSyncDruzinaReadOnly();}
 throw Error('Unsupported action');
}

