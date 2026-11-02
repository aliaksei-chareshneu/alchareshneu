function decodeProof_(proof, paymentId) {
  if(!proof || !proof.dataUrl) throw new Error('Payment proof is required');
  const m=String(proof.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if(!m) throw new Error('Invalid proof upload');
  if(m[2].length>Math.ceil(APP.MAX_PROOF_BYTES/3)*4) throw new Error('Proof file is too large (max 5 MB)');
  const mime=m[1]; if(APP.ALLOWED_PROOF_MIME.indexOf(mime)<0) throw new Error('Proof must be JPG, PNG or PDF');
  const bytes=Utilities.base64Decode(m[2]); if(bytes.length>APP.MAX_PROOF_BYTES) throw new Error('Proof file is too large (max 5 MB)');
  const ext=mime==='application/pdf'?'.pdf':mime==='image/png'?'.png':'.jpg';
  const blob=Utilities.newBlob(bytes,mime,paymentId+ext);
  const folder=DriveApp.getFolderById(APP.RECEIPT_FOLDER_ID);
  const file=folder.createFile(blob);
  return {url:file.getUrl(),name:file.getName(),fileId:file.getId()};
}

function submitQuotePayment(payload){
  // Payment proof is never a settled bank credit. No provisional booking,
  // package consumption, ledger clearing or customer 'paid' status is allowed.
  return drusNeverProofAsPayment_();
}
function createBooking_(member,sessionId,planId,paymentId,productCode,cutoff,policyVersion,appliedOverride){
  const ses=sessionById_(sessionId); const pkg=packageInfo_(productCode);
  const base=planId ? normalFlexPriceFor_(member,ses.Start_DateTime) : effectivePrice_(productCode);
  const applied=appliedOverride!==undefined ? appliedOverride : (planId && pkg ? pkg.price/pkg.sessions : effectivePrice_(productCode));
  const pol=policyVersion||policyVersionForDate_(ses.Start_DateTime);
  const bid=id_('BKG');
  appendObj_(SHEETS.BOOKINGS,{Booking_ID:bid,Session_ID:sessionId,Member_ID:member.Member_ID,Plan_ID:planId||'',Payment_ID:paymentId,Booking_Type:planId?'PLAN':'FLEX',Status:'PROVISIONAL_CONFIRMED',Booked_At:nowIso_(),Reschedule_Deadline:new Date(new Date(ses.Start_DateTime).getTime()-48*3600000).toISOString(),Rescheduled_From:'',Attendance_Checked:false,Attendance_Status:'',Equipment_Note:'',Proof_Required:true,Notes:'Portal',Policy_Version:pol,Base_Price_CZK:base,Applied_Price_CZK:applied,Cutoff_Class:cutoff||windowFor_(ses.Start_DateTime),Price_Reason:planId?'package allocated rate':cutoff==='STANDARD'?'standard':cutoff==='LATE'?'late booking':cutoff==='EMERGENCY'?'emergency booking':'standard',Rule_Snapshot:'Portal policy '+pol});
  refreshSessionCounts_(sessionId);
  return bid;
}

function activatePackage_(member,item,paymentId){
  const pkg=packageInfo_(item.productCode);
  const future=item.sessionIds.map(id=>new Date(sessionById_(id).Start_DateTime)).sort((a,b)=>a-b);
  let start=future[0], used=0, trialBooking=null;
  if(item.kind==='PACKAGE_UPGRADE'){
    const up=starterUpgradeEligibility_(member);
    if(!up || up.bookingId!==String(item.trialUpgradeBookingId)) throw new Error('Trial-to-Starter upgrade expired');
    start=new Date(up.start); used=1; trialBooking=findOne_(SHEETS.BOOKINGS,r=>String(r.Booking_ID)===String(up.bookingId));
  }
  const pid=id_('PLN'); const end=new Date(start.getTime()+30*86400000); const pol=item.policyVersion||policyVersionForDate_(start);
  appendObj_(SHEETS.PLANS,{Plan_ID:pid,Member_ID:member.Member_ID,Product_Code:item.productCode,Start_Date:start.toISOString(),End_Date:end.toISOString(),Recurring_Days:'',Payment_ID:paymentId,Status:'ACTIVE',Auto_Renew:false,Sessions_Scheduled:pkg.sessions,Sessions_Used:used,Sessions_NoShow:0,Next_Renewal:new Date(end.getTime()-7*86400000).toISOString(),Created_At:nowIso_(),Notes:item.kind==='PACKAGE_UPGRADE'?'Trial credited as session #1':'All dates selected at purchase',Policy_Version:pol,Package_Sessions:pkg.sessions,Validity_Days:30,First_Eligible_Session:start.toISOString(),Purchase_Cutoff_Status:'VALID',Price_Snapshot_CZK:pkg.price});
  if(trialBooking) patchRow_(SHEETS.BOOKINGS,trialBooking._row,{Plan_ID:pid,Booking_Type:'PLAN_TRIAL_CREDIT',Price_Reason:'paid Trial credited into Starter 4',Policy_Version:pol,Rule_Snapshot:'Trial-to-Starter credit; total package 800 Kč'});
  patchRow_(SHEETS.MEMBERS,member._row,{Current_Plan_ID:pid,Plan_End:end.toISOString()});
  const perSession=pkg.price/pkg.sessions;
  const bookingIds=item.sessionIds.map(sid=>createBooking_(member,sid,pid,paymentId,item.productCode,'STANDARD',pol,perSession));
  return {planId:pid,bookingIds};
}

function refreshSessionCounts_(sessionId){
  const s=sessionById_(sessionId); if(!s) return;
  const booked=bookedCount_(sessionId); const attended=findAll_(SHEETS.BOOKINGS,r=>String(r.Session_ID)===String(sessionId)&&String(r.Attendance_Status)==='PRESENT').length;
  patchRow_(SHEETS.SESSIONS,s._row,{Booked_Count:booked,Attended_Count:attended,Booking_Window:windowFor_(s.Start_DateTime)});
}

function payOutstanding(payload){
  // Preserve existing debts and all old contractual rights; owner reconciles
  // verified Fio bank receipts separately. A screenshot cannot clear debt.
  return drusNeverProofAsPayment_();
}
