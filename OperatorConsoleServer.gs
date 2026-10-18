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
 return {missing:false,url:ss.getUrl()+'#gid='+sh.getSheetId(),rows:data.map(function(r){var x={};h.forEach(function(k,i){x[k]=r[i] instanceof Date?r[i].toISOString():r[i];});return x;})};
}
function ocIsTest_(r){return /TEST-ONLY|QA TEST|SYNTHETIC|NO.CONTACT/i.test([r.Lead_ID,r.Full_Name,r.Subject_Goal,r.Notes].join(' '));}
function ocLeadSummary_(rows){
 var valid=rows.filter(function(r){return !ocIsTest_(r);}),stages={};
 valid.forEach(function(r){var k=String(r.Stage||'Unknown');stages[k]=(stages[k]||0)+1;});
 return {count:valid.length,excludedTests:rows.length-valid.length,stages:stages,
   needsAction:valid.filter(function(r){return r.Next_Action_At&&!/^(CLOSED|HOLD|DORMANT|WAIT)/.test(r.Action_Status||'')&&r.Stage!=='Lost'&&r.Stage!=='Won';}).slice(0,40).map(function(r){return {id:r.Lead_ID,service:r.Service,stage:r.Stage,next:r.Next_Action_At,status:r.Action_Status};}),
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
  lastSuccess:last,fresh:verified,balance:verified&&raw!==null&&raw!==''&&isFinite(Number(raw))?Number(raw):null};
}
function operatorSnapshot(){
 ocOwner_();var ss=SpreadsheetApp.openById(ocId_()),p=PropertiesService.getScriptProperties();
 var leads=ocRows_(ss,'Leads'),social=ocRows_(ss,'SocialPublishing'),events=ocRows_(ss,'Events'),config=ocRows_(ss,'Revenue_Config');
 var cfg={};config.rows.forEach(function(r){cfg[r.Key]=r.Value;});
 return {at:new Date().toISOString(),hub:ss.getUrl(),leads:ocLeadSummary_(leads.rows),leadUrl:leads.url,
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
