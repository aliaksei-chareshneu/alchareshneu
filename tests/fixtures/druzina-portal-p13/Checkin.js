// Private, authorized-review evidence. A payment or a matching name never proves consent.
const DRUZINA_CONSENT_HEADERS = [
  'Member_ID', 'Safety_Form_Source', 'Safety_Form_Version', 'Safety_Form_Verified_At',
  'Safety_Form_Valid_Until', 'Rules_Source', 'Rules_Version', 'Rules_Verified_At',
  'Rules_Valid_Until', 'Guardian_Required', 'Guardian_Classification_Source',
  'Guardian_Classified_At', 'Guardian_Source', 'Guardian_Verified_At',
  'Guardian_Valid_Until', 'Reviewed_At'
];

function ensureDruzinaConsentsSheet_(){
  const ss=ss_(); let sheet=ss.getSheetByName(SHEETS.CONSENTS);
  if(!sheet){
    sheet=ss.insertSheet(SHEETS.CONSENTS);
    sheet.getRange(1,1,1,DRUZINA_CONSENT_HEADERS.length).setValues([DRUZINA_CONSENT_HEADERS]);
    sheet.setFrozenRows(1);
  }else{
    const headers=headers_(SHEETS.CONSENTS);
    if(DRUZINA_CONSENT_HEADERS.some((name,i)=>headers[i]!==name)) throw new Error('Consent sheet header mismatch');
  }
  const configured=rows_(SHEETS.CONFIG).map(r=>String(r.Key));
  for(const [key,note] of [
    ['SAFETY_FORM_VERSION','Set only after the current safety form and organizer are verified.'],
    ['RULES_VERSION','Set only after the current training rules and organizer are verified.'],
    ['PREZENCKY_SPREADSHEET_ID',APP.PREZENCKY_SPREADSHEET_ID],
    ['PREZENCKY_SYNC_ENABLED','Keep FALSE until the check-in smoke test and private ledger access are verified.']
  ]) if(!configured.includes(key)) appendObj_(SHEETS.CONFIG,{Key:key,Value:key==='PREZENCKY_SPREADSHEET_ID'?APP.PREZENCKY_SPREADSHEET_ID:key==='PREZENCKY_SYNC_ENABLED'?'FALSE':'',Status:key.startsWith('PREZENCKY_')?'PRELAUNCH':'AWAITING_CURRENT_DOCUMENT',Type:key.startsWith('PREZENCKY_')?'integration':'consent',Notes:note});
  return sheet;
}

function consentMap_(){
  if(!ss_().getSheetByName(SHEETS.CONSENTS)) return {};
  const map={};
  rows_(SHEETS.CONSENTS).forEach(r=>{if(r.Member_ID) map[String(r.Member_ID)]=r;});
  return map;
}

function evidenceState_(record,prefix,currentVersion,now){
  if(!currentVersion) return 'NEEDS_CONFIG';
  if(!record || !record[prefix+'_Source'] || !record[prefix+'_Verified_At']) return 'MISSING';
  if(String(record[prefix+'_Version'])!==String(currentVersion)) return 'OUTDATED';
  const verified=new Date(record[prefix+'_Verified_At']).getTime();
  if(!Number.isFinite(verified)||verified>now) return 'NEEDS_REVIEW';
  const until=record[prefix+'_Valid_Until'];
  if(until && evidenceExpired_(until,now)) return 'EXPIRED';
  return 'VERIFIED';
}

function consentStatus_(record,config){
  const now=Date.now();
  const safetyForm=evidenceState_(record,'Safety_Form',config.SAFETY_FORM_VERSION,now);
  const rules=evidenceState_(record,'Rules',config.RULES_VERSION,now);
  let guardian='UNKNOWN';
  if(record && record.Guardian_Required==='NO' && record.Guardian_Classification_Source && record.Guardian_Classified_At) guardian='NOT_REQUIRED';
  if(record && record.Guardian_Required==='YES'){
    guardian=record.Guardian_Source && record.Guardian_Verified_At?'VERIFIED':'MISSING';
    const until=record.Guardian_Valid_Until;
    if(guardian==='VERIFIED' && until && evidenceExpired_(until,now)) guardian='EXPIRED';
  }
  return {safetyForm,rules,guardian,ready:safetyForm==='VERIFIED'&&rules==='VERIFIED'&&['VERIFIED','NOT_REQUIRED'].includes(guardian)};
}

function consentEvidenceRef_(source){
  const value=String(source||'').trim();
  if(!value || value.length>250 || /[<>\x00-\x1F]/.test(value) || /^[=+\-@']/.test(value)) throw new Error('Evidence source reference is required');
  return value;
}
function evidenceExpired_(until,now){
  const value=String(until);
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) return value<Utilities.formatDate(new Date(now),APP.TIMEZONE,'yyyy-MM-dd');
  const end=new Date(value).getTime();
  return !Number.isFinite(end)||end<now;
}

// Trainer/admin confirms existing evidence; this does not ask participants to re-sign.
function recordDruzinaConsentReview(payload){
  requireTrainer_(payload&&payload.adminToken);
  return withLock_(()=>{
    ensureDruzinaConsentsSheet_();
    const memberId=String(payload.memberId||'');
    if(!findOne_(SHEETS.MEMBERS,r=>String(r.Member_ID)===memberId)) throw new Error('Member not found');
    const kind=String(payload.kind||'').toUpperCase(), source=consentEvidenceRef_(payload.source);
    const cfg=configMap_(), now=nowIso_();
    const validUntil=String(payload.validUntil||'').trim();
    if(validUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)||!Number.isFinite(new Date(validUntil).getTime())||new Date(validUntil).toISOString().slice(0,10)!==validUntil||evidenceExpired_(validUntil,Date.now()))) throw new Error('Evidence expiry must be a current or future date');
    const current=consentMap_()[memberId], patch={Reviewed_At:now};
    if(kind==='SAFETY_FORM' || kind==='RULES'){
      const prefix=kind==='SAFETY_FORM'?'Safety_Form':'Rules';
      const version=String(cfg[kind==='SAFETY_FORM'?'SAFETY_FORM_VERSION':'RULES_VERSION']||'').trim();
      if(!version) throw new Error('Current '+kind+' version is not configured');
      patch[prefix+'_Source']=source; patch[prefix+'_Version']=version;
      patch[prefix+'_Verified_At']=now; patch[prefix+'_Valid_Until']=validUntil;
    }else if(kind==='AGE_CLASSIFICATION'){
      if(payload.guardianRequired!==true && payload.guardianRequired!==false) throw new Error('Guardian requirement must be explicit');
      patch.Guardian_Required=payload.guardianRequired?'YES':'NO';
      patch.Guardian_Classification_Source=source; patch.Guardian_Classified_At=now;
      if(!payload.guardianRequired){ patch.Guardian_Source=''; patch.Guardian_Verified_At=''; patch.Guardian_Valid_Until=''; }
    }else if(kind==='GUARDIAN'){
      if(!current || current.Guardian_Required!=='YES') throw new Error('Classify the member as a minor first');
      patch.Guardian_Source=source; patch.Guardian_Verified_At=now; patch.Guardian_Valid_Until=validUntil;
    }else throw new Error('Unknown consent evidence type');
    if(current) patchRow_(SHEETS.CONSENTS,current._row,patch);
    else appendObj_(SHEETS.CONSENTS,Object.assign({Member_ID:memberId},patch));
    audit_('admin','Member',memberId,'CONSENT_EVIDENCE_REVIEW','',kind,'Evidence reference stored privately');
    return consentStatus_(consentMap_()[memberId],cfg);
  });
}

function revokeDruzinaConsentReview(payload){
  requireTrainer_(payload&&payload.adminToken);
  return withLock_(()=>{
    const memberId=String(payload.memberId||''), kind=String(payload.kind||'').toUpperCase();
    const row=consentMap_()[memberId]; if(!row) throw new Error('No consent evidence for member');
    const prefix=kind==='SAFETY_FORM'?'Safety_Form':kind==='RULES'?'Rules':kind==='GUARDIAN'?'Guardian':'';
    if(!prefix) throw new Error('Unknown consent evidence type');
    const patch={Reviewed_At:nowIso_()};
    patch[prefix+'_Source']=''; patch[prefix+'_Verified_At']=''; patch[prefix+'_Valid_Until']='';
    patchRow_(SHEETS.CONSENTS,row._row,patch);
    audit_('admin','Member',memberId,'CONSENT_EVIDENCE_REVOKED',kind,'','');
    return consentStatus_(consentMap_()[memberId],configMap_());
  });
}

// The separate insurance attendance ledger mirrors check-in facts only.
// A trainer check-in is not a participant signature or an on-site safety briefing.
function prezenckySheet_(){
  const sheet=SpreadsheetApp.openById(APP.PREZENCKY_SPREADSHEET_ID).getSheetByName('Prezenční evidence');
  if(!sheet) throw new Error('Missing Družina insurance attendance ledger');
  const headers=sheet.getRange(1,1,1,11).getValues()[0].map(String);
  if(headers[5]!=='Jméno a příjmení účastníka'||headers[7]!=='Podpis / potvrzení účasti'||headers[8]!=='Bezpečnostní poučení') throw new Error('Attendance ledger header mismatch');
  const extra=['Member_ID','Booking_ID','Portal_Checkin_Status','Portal_Checkin_Updated_At'];
  extra.forEach((name,i)=>{
    const current=String(sheet.getRange(1,12+i).getValue()||'');
    if(current&&current!==name) throw new Error('Attendance ledger link header mismatch');
    if(!current) sheet.getRange(1,12+i).setValue(name);
  });
  return sheet;
}

function syncCheckinToPrezencky_(booking){
  const status=String(booking.Attendance_Status||'');
  if(!['PRESENT','NO_SHOW'].includes(status)) return {skipped:true};
  const sheet=prezenckySheet_(), lastRow=sheet.getLastRow();
  const ids=lastRow>=2?sheet.getRange(2,13,lastRow-1,1).getValues():[];
  const matches=[]; ids.forEach((r,i)=>{if(String(r[0])===String(booking.Booking_ID)) matches.push(i+2);});
  if(matches.length>1) throw new Error('Duplicate Booking_ID in attendance ledger');
  const rowNumber=matches[0];
  if(status==='NO_SHOW'&&!rowNumber) return {skipped:true};
  if(status==='NO_SHOW'){
    sheet.getRange(rowNumber,14,1,2).setValues([['NO_SHOW',nowIso_()]]);
    return {corrected:true,row:rowNumber};
  }
  const session=sessionById_(booking.Session_ID), member=findOne_(SHEETS.MEMBERS,r=>String(r.Member_ID)===String(booking.Member_ID));
  if(!session||!member) throw new Error('Check-in session or member missing');
  const date=Utilities.formatDate(new Date(session.Start_DateTime),APP.TIMEZONE,'yyyy-MM-dd');
  const values=[date,'Družina Moravy — '+String(session.Theme||'training'),String(session.Location||APP.LOCATION),'','Training',String(member.Full_Name||''),'','Trainer confirmed in portal; not participant signature','Briefing confirmation pending','',String(session.Session_ID),String(member.Member_ID),String(booking.Booking_ID),'PRESENT',nowIso_()];
  if(rowNumber) sheet.getRange(rowNumber,14,1,2).setValues([['PRESENT',nowIso_()]]);
  else sheet.appendRow(values);
  return {synced:true,row:rowNumber||sheet.getLastRow()};
}

function syncDruzinaCheckinsToPrezencky(){
  requireOwner_();
  if(configMap_().PREZENCKY_SYNC_ENABLED!==true) return {skipped:true,reason:'PREZENCKY_SYNC_ENABLED is false'};
  return withLock_(()=>{
    let synced=0,corrected=0;
    rows_(SHEETS.BOOKINGS).filter(b=>['PRESENT','NO_SHOW'].includes(String(b.Attendance_Status))).forEach(b=>{
      const result=syncCheckinToPrezencky_(b);
      if(result.synced) synced++;
      if(result.corrected) corrected++;
    });
    return {synced,corrected};
  });
}
