function installDruzinaBookingSystem(){
  requireOwner_();
  return withLock_(()=>{
  ensureQuotesSheet_();
  installDruzinaCheckinExtension();
  const members=sh_(SHEETS.MEMBERS); const hs=headers_(SHEETS.MEMBERS);
  if(hs.indexOf('Manage_Token')<0){ members.getRange(1,hs.length+1).setValue('Manage_Token'); }
  ensureSeniorTierColumn_();
  const sessions=sh_(SHEETS.SESSIONS); const shs=headers_(SHEETS.SESSIONS);
  if(shs.indexOf('Emergency_Booking_Closes')<0){ sessions.getRange(1,shs.length+1).setValue('Emergency_Booking_Closes'); }
  const sessionsAdded=ensureSessions_();
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty('ADMIN_TOKEN')) props.setProperty('ADMIN_TOKEN', id_('ADM')+id_('SEC'));
  ['hourlyMaintenance','dailyMaintenance','hourlyMaintenance_','dailyMaintenance_'].forEach(deleteTriggers_);
  ScriptApp.newTrigger('hourlyMaintenance_').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('dailyMaintenance_').timeBased().everyDays(1).atHour(6).create();
  return {ok:true,sessionsAdded,version:APP.VERSION};
  });
}

function installDruzinaCheckinExtension(){
  requireOwner_();
  return withLock_(()=>{
    ensureDruzinaConsentsSheet_();
    ensureSeniorTierColumn_();
    const props=PropertiesService.getScriptProperties();
    if(!props.getProperty('TRAINER_TOKEN')) props.setProperty('TRAINER_TOKEN',id_('TRN')+id_('SEC'));
    return {ok:true,version:APP.VERSION};
  });
}

function deleteTriggers_(handler){ ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler).forEach(t=>ScriptApp.deleteTrigger(t)); }
function hourlyMaintenance(){ requireOwner_(); return hourlyMaintenance_(); }
function dailyMaintenance(){ requireOwner_(); return dailyMaintenance_(); }
function hourlyMaintenance_(){ return withLock_(()=>{ cleanupExpiredHolds_(); ensureSessions_(); updateSessionWindows_(); }); }
function dailyMaintenance_(){ return withLock_(()=>{ ensureSessions_(); expirePlans_(); refreshAllMemberTiers_(); return syncSessionsToCalendar_(); }); }
function updateSessionWindows_(){ rows_(SHEETS.SESSIONS).forEach(s=>{ if(s.Start_DateTime) patchRow_(SHEETS.SESSIONS,s._row,{Booking_Window:windowFor_(s.Start_DateTime),Rules_Version:policyVersionForDate_(s.Start_DateTime)}); }); }
function expirePlans_(){ rows_(SHEETS.PLANS).forEach(p=>{ if(String(p.Status)==='ACTIVE'&&new Date(p.End_Date)<new Date()) patchRow_(SHEETS.PLANS,p._row,{Status:'EXPIRED'}); }); }

function requireOwner_(){
  const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  const effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  if(!active || !effective || active!==effective) throw new Error('Owner authorization required');
}
function requireAdmin_(token){
  const expected=String(PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN')||'');
  if(!expected || !token || String(token)!==expected) throw new Error('Unauthorized');
}
function requireTrainer_(token){
  const props=PropertiesService.getScriptProperties();
  const trainer=String(props.getProperty('TRAINER_TOKEN')||'');
  const admin=String(props.getProperty('ADMIN_TOKEN')||'');
  if(!token || (String(token)!==trainer && String(token)!==admin)) throw new Error('Unauthorized');
}
function getTrainerSessions(token){
  requireTrainer_(token); ensureSessions_();
  const today=Utilities.formatDate(new Date(),APP.TIMEZONE,'yyyy-MM-dd');
  const upcoming=rows_(SHEETS.SESSIONS).filter(s=>s.Start_DateTime&&Utilities.formatDate(new Date(s.Start_DateTime),APP.TIMEZONE,'yyyy-MM-dd')>=today).slice(0,12)
    .map(s=>({id:s.Session_ID,start:new Date(s.Start_DateTime).toISOString(),theme:s.Theme,booked:bookedCount_(s.Session_ID)}));
  return {upcoming};
}
function getAdminState(token){ requireAdmin_(token); ensureSessions_(); const today=Utilities.formatDate(new Date(),APP.TIMEZONE,'yyyy-MM-dd'); const upcoming=rows_(SHEETS.SESSIONS).filter(s=>Utilities.formatDate(new Date(s.Start_DateTime),APP.TIMEZONE,'yyyy-MM-dd')>=today).slice(0,12).map(s=>({id:s.Session_ID,start:new Date(s.Start_DateTime).toISOString(),theme:s.Theme,booked:bookedCount_(s.Session_ID),capacity:Number(s.Capacity||APP.DEFAULT_CAPACITY),window:windowFor_(s.Start_DateTime)})); const holds=rows_(SHEETS.MEMBERS).filter(m=>money_(m.Outstanding_CZK)>0).map(m=>({id:m.Member_ID,name:m.Full_Name,outstanding:money_(m.Outstanding_CZK)})); return {upcoming,holds}; }

function getRoster(token,sessionId){
  requireTrainer_(token);
  const s=sessionById_(sessionId); if(!s) throw new Error('Session not found');
  const members=rows_(SHEETS.MEMBERS), map={}; members.forEach(m=>map[m.Member_ID]=m);
  const bs=findAll_(SHEETS.BOOKINGS,b=>String(b.Session_ID)===String(sessionId)&&['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED','ATTENDED','NO_SHOW'].includes(String(b.Status)));
  const consents=consentMap_(), config=configMap_();
  return {session:{id:s.Session_ID,start:new Date(s.Start_DateTime).toISOString(),theme:s.Theme},roster:bs.map(b=>({bookingId:b.Booking_ID,memberId:b.Member_ID,name:map[b.Member_ID]?.Full_Name||b.Member_ID,status:b.Status,attendance:b.Attendance_Status||'',equipment:b.Equipment_Note||'',consent:consentStatus_(consents[b.Member_ID],config)}))};
}

function adjustPlanFinalization_(booking, oldAttendance, newAttendance){
  if(!booking.Plan_ID) return;
  const p=findOne_(SHEETS.PLANS,r=>String(r.Plan_ID)===String(booking.Plan_ID)); if(!p) return;
  const oldFinal=['PRESENT','NO_SHOW'].includes(oldAttendance), newFinal=['PRESENT','NO_SHOW'].includes(newAttendance);
  let used=Number(p.Sessions_Used||0), noShow=Number(p.Sessions_NoShow||0);
  if(!oldFinal && newFinal) used++;
  if(oldAttendance==='NO_SHOW' && newAttendance!=='NO_SHOW') noShow=Math.max(0,noShow-1);
  if(oldAttendance!=='NO_SHOW' && newAttendance==='NO_SHOW') noShow++;
  patchRow_(SHEETS.PLANS,p._row,{Sessions_Used:used,Sessions_NoShow:noShow});
}

function setAttendance(payload){
  requireTrainer_(payload.adminToken);
  return withLock_(()=>{
  const b=findOne_(SHEETS.BOOKINGS,r=>String(r.Booking_ID)===String(payload.bookingId)); if(!b) throw new Error('Booking not found');
  if(!['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED','ATTENDED','NO_SHOW'].includes(String(b.Status))) throw new Error('This booking cannot be marked for attendance');
  const val=String(payload.status||'').toUpperCase(); if(!['PRESENT','NO_SHOW'].includes(val)) throw new Error('Bad attendance status');
  const old=String(b.Attendance_Status||'').toUpperCase(); if(old===val) return {ok:true,idempotent:true};
  patchRow_(SHEETS.BOOKINGS,b._row,{Attendance_Checked:true,Attendance_Status:val,Status:val==='PRESENT'?'ATTENDED':'NO_SHOW'});
  adjustPlanFinalization_(b,old,val);
  refreshSessionCounts_(b.Session_ID);
  const m=findOne_(SHEETS.MEMBERS,r=>String(r.Member_ID)===String(b.Member_ID));
  if(m){
    let total=Number(m.Attendance_Total||0);
    if(old!=='PRESENT' && val==='PRESENT') total++;
    if(old==='PRESENT' && val!=='PRESENT') total=Math.max(0,total-1);
    patchRow_(SHEETS.MEMBERS,m._row,{Attendance_Total:total});
    m.Attendance_Total=total;
    refreshMemberAccount_(m);
  }
  const consent=consentStatus_(consentMap_()[b.Member_ID],configMap_());
  audit_('admin','Booking',b.Booking_ID,'ATTENDANCE',old,val, val==='PRESENT'&&!consent.ready?'Consent review required at check-in':'');
  let prezenckySyncError=false;
  if(configMap_().PREZENCKY_SYNC_ENABLED===true){
    try{ syncCheckinToPrezencky_(Object.assign({},b,{Attendance_Status:val})); }
    catch(error){ prezenckySyncError=true; audit_('system','Booking',b.Booking_ID,'PREZENCKY_SYNC_ERROR','','',String(error.message||error).slice(0,200)); }
  }
  return {ok:true,consentReviewRequired:val==='PRESENT'&&!consent.ready,prezenckySyncError};
  });
}

function reconcilePayment(payload){
  requireAdmin_(payload.adminToken);
  return withLock_(()=>{
    const status=String(payload.status||'');
    if(!['VERIFIED','PAYMENT_EXCEPTION'].includes(status)) throw new Error('Bad reconciliation status');
    const p=findOne_(SHEETS.PAYMENTS,r=>String(r.Payment_ID)===String(payload.paymentId)); if(!p) throw new Error('Payment not found');
    const ok=status==='VERIFIED', now=nowIso_();
    const idempotent=String(p.Verification_Status)===status && !!p.Reconciled_At;
    const ledgerPatch=ok ? {Status:'RESOLVED',Blocks_Booking:false,Resolved_At:now} : {Status:'OPEN',Blocks_Booking:true,Resolved_At:''};
    const paymentItems=findAll_(SHEETS.PAYMENT_ITEMS,r=>String(r.Payment_ID)===String(p.Payment_ID));
    paymentItems.forEach(x=>patchRow_(SHEETS.PAYMENT_ITEMS,x._row,{Status:status}));

    if(String(p.Product_Code)==='OUTSTANDING_BALANCE'){
      // Repeated reconciliation updates the same debts, never creates another.
      findAll_(SHEETS.LEDGER,r=>String(r.Payment_ID)===String(p.Payment_ID))
        .forEach(l=>patchRow_(SHEETS.LEDGER,l._row,ledgerPatch));
    }else{
      const bs=findAll_(SHEETS.BOOKINGS,r=>String(r.Payment_ID)===String(p.Payment_ID));
      bs.forEach(b=>{
        // Bank reconciliation must not erase attendance or revive cancellations.
        if(!['ATTENDED','NO_SHOW','CANCELLED','CLUB_CANCELLED'].includes(String(b.Status))) patchRow_(SHEETS.BOOKINGS,b._row,{Status:status});
      });
      const planIds=[...new Set(paymentItems.map(x=>String(x.Related_Plan_ID||'')).filter(Boolean))];
      findAll_(SHEETS.PLANS,r=>String(r.Payment_ID)===String(p.Payment_ID) || planIds.includes(String(r.Plan_ID))).forEach(pl=>{
        if(!['EXPIRED','COMPLETED','CANCELLED'].includes(String(pl.Status))) patchRow_(SHEETS.PLANS,pl._row,{Status:ok?'ACTIVE':'PAYMENT_EXCEPTION'});
      });
      const exceptions=findAll_(SHEETS.LEDGER,r=>String(r.Source_Type)==='PAYMENT' && String(r.Source_ID)===String(p.Payment_ID) && String(r.Entry_Type)==='PAYMENT_EXCEPTION');
      if(!ok && !exceptions.length){
        appendObj_(SHEETS.LEDGER,{Ledger_ID:id_('LED'),Member_ID:p.Member_ID,Member_Name:'',Created_At:now,Entry_Type:'PAYMENT_EXCEPTION',Source_Type:'PAYMENT',Source_ID:p.Payment_ID,Description:'Payment reconciliation exception',Amount_CZK:money_(p.Expected_Amount_CZK||p.Amount_CZK),Due_At:now,Status:'OPEN',Blocks_Booking:true,Payment_ID:p.Payment_ID,Resolved_At:'',Notes:String(payload.note||'')});
      }else{
        exceptions.forEach(l=>{
          // A later debt payment owns its own reconciliation decision.
          if(ok || String(l.Payment_ID)===String(p.Payment_ID)) patchRow_(SHEETS.LEDGER,l._row,ledgerPatch);
        });
      }
      [...new Set(bs.map(b=>String(b.Session_ID)))].forEach(refreshSessionCounts_);
    }
    patchRow_(SHEETS.PAYMENTS,p._row,{Verification_Status:status,Verified_At:ok?(p.Verified_At||now):'',Reconciled_At:idempotent?p.Reconciled_At:now,Reconciliation_Note:String(payload.note||'')});
    const m=findOne_(SHEETS.MEMBERS,r=>String(r.Member_ID)===String(p.Member_ID)); if(m) refreshMemberAccount_(m);
    if(!idempotent) audit_('admin','Payment',p.Payment_ID,'RECONCILE',p.Verification_Status,status,payload.note||'');
    return {ok:true,idempotent};
  });
}
