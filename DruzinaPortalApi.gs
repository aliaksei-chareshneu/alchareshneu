/* Additive APIs for the EXISTING booking portal. SOURCE STAGING ONLY.
 * No payment flag, trigger, deployment or provider configuration is changed. */
function createDruzinaBankQuote(payload){
  var terms=getDruzinaCheckoutTerms();
  if(!terms.ready||!payload||payload.termsAccepted!==true||String(payload.termsVersion)!==terms.version)
    throw Error('Current purchase terms must be available and accepted before payment instructions');
  return drufCreateQuoteWithVS_(payload);
}
function getDruzinaCheckoutTerms(){
  var p=PropertiesService.getScriptProperties(),version=String(p.getProperty('DRU_PAID_TERMS_VERSION')||''),
    url=String(p.getProperty('DRU_PAID_TERMS_URL')||''),seller=String(p.getProperty('DRU_LEGAL_SELLER_PUBLIC_NAME')||'');
  var ready=p.getProperty('DRU_PAID_TERMS_APPROVED')==='YES'&&/^[A-Za-z0-9_-]{3,100}$/.test(version)&&
    /^https:\/\/aliaksei-chareshneu\.github\.io\/alchareshneu\/druzina\/[A-Za-z0-9_./-]+$/.test(url)&&
    !!seller&&seller.length<=140;
  return ready?{ready:true,version:version,url:url,seller:seller}:{ready:false};
}
function dm14RequireOtp_(payload){
  if(!bookingVerifiedRequired_())throw Error('Email verification required');
  return authorizeBookingMember_(payload);
}
function getDruzinaOrderStatus(payload){
  var member=dm14RequireOtp_(payload),id=String(payload&&payload.orderId||'');
  var q=findOne_(SHEETS.QUOTES,function(r){return String(r.Quote_ID)===id&&
    String(r.Member_ID)===String(member.Member_ID);});
  if(!q)throw Error('Order unavailable');
  var payments=findAll_(SHEETS.PAYMENTS,function(p){return String(p.Source_Request_ID)===id&&
    String(p.Member_ID)===String(member.Member_ID);});
  var bookings=findAll_(SHEETS.BOOKINGS,function(b){return String(b.Member_ID)===String(member.Member_ID)&&
    payments.some(function(p){return String(b.Payment_ID)===String(p.Payment_ID);});});
  var cancelled=bookings.some(function(b){var s=sessionById_(b.Session_ID);return /CANCELLED/.test(String(b.Status))||
    (String(b.Status)==='VERIFIED'&&s&&(String(s.Status)==='CANCELLED'||/CANCELLED/i.test(String(s.Notes||''))));});
  var status='PENDING_PAYMENT';
  if(payments.length>1||String(q.Status)==='COMMITTING')status='MANUAL_REVIEW';
  else if(['CANCELLED','EXPIRED'].includes(String(q.Status)))status=String(q.Status);
  else if(payments.length===1){
    if(druaBankVerified_(payments[0]))status='PAID_BANK_VERIFIED';
    else if(/EXCEPTION|REVERSED|REFUND/.test(String(payments[0].Verification_Status)))status='MANUAL_REVIEW';
  }else if(!Number.isFinite(new Date(q.Expires_At).getTime())||new Date(q.Expires_At).getTime()<=Date.now())status='EXPIRED';
  return {ok:true,orderId:id,paymentState:status,
    bookingState:cancelled?'CANCELLED':status==='PAID_BANK_VERIFIED'&&bookings.length>0&&
      bookings.every(function(b){return ['VERIFIED','ATTENDED','NO_SHOW'].includes(String(b.Status));})?'BOOKED':
      bookings.some(function(b){return /CANCELLED/.test(String(b.Status));})?'CANCELLED':'PENDING_PAYMENT',
    expectedCZK:money_(q.Expected_Amount_CZK),bookingCount:bookings.length};
}
function rescheduleDruzinaBooking(payload){
  var member=dm14RequireOtp_(payload);
  drusRequireMemberConsent_(member);
  // Existing rescheduler still enforces debt, two T-48 windows, ownership,
  // capacity and package validity. Its private bearer never leaves the server.
  return rescheduleBooking({token:String(member.Manage_Token||''),
    bookingId:String(payload.bookingId||''),newSessionId:String(payload.newSessionId||'')});
}
function requestDruzinaCancellation(payload){
  return withLock_(function(){
    var member=dm14RequireOtp_(payload),bid=String(payload&&payload.bookingId||'');
    var b=findOne_(SHEETS.BOOKINGS,function(r){return String(r.Booking_ID)===bid&&
      String(r.Member_ID)===String(member.Member_ID);});
    if(!b||!['VERIFIED','ATTENDED','NO_SHOW'].includes(String(b.Status)))throw Error('Booking unavailable');
    var key='CXL-'+bookingHash_(String(member.Member_ID)+'|'+bid);
    if(!findOne_(SHEETS.REQUESTS,function(r){return String(r.Request_ID)===key;})){
      appendObj_(SHEETS.REQUESTS,{Request_ID:key,Member_ID:member.Member_ID,Status:'OPEN',
        Notes:JSON.stringify({kind:'CANCELLATION_REQUEST',bookingId:bid,createdAt:nowIso_()})});
      audit_('member','Booking',bid,'CANCELLATION_REQUESTED','','OPEN','Organizer decision required');
    }
    // No cancellation, refund, restored entitlement or class change is implied.
    return {ok:true,status:'REQUESTED',bookingChanged:false};
  });
}
function getDruzinaBookingOperations(adminToken){
  requireAdmin_(adminToken);
  var bs=rows_(SHEETS.BOOKINGS),ps=rows_(SHEETS.PAYMENTS),qs=rows_(SHEETS.QUOTES),
    plans=rows_(SHEETS.PLANS),requests=rows_(SHEETS.REQUESTS),now=Date.now();
  var importReceipts=rows_(SHEETS.AUDIT).filter(function(a){return String(a.Entity_ID)==='FIO_BOOKING_IMPORT'&&String(a.Action)==='IMPORT_READBACK';}),bankReadback=null;
  if(importReceipts.length){try{bankReadback=JSON.parse(String(importReceipts[importReceipts.length-1].Notes));}catch(_){bankReadback={ok:false,code:'READBACK_REQUIRES_REVIEW'};}}
  var paid=ps.filter(druaBankVerified_);
  var sessions=rows_(SHEETS.SESSIONS).filter(function(s){return new Date(s.Start_DateTime).getTime()>now;})
    .map(function(s){var safe=drusSafeCapacity_(s),booked=bookedCount_(s.Session_ID);
      return {sessionId:String(s.Session_ID),starts:String(s.Start_DateTime),approvedCapacity:safe,
        booked:booked,available:safe?availableCapacity_(s):0,minimumGroupMet:booked>=2,
        organizerDecisionRequired:booked<2};});
  return {ok:true,generatedAt:nowIso_(),paidCheckoutLive:drusPaidRelease_().ok,
    counts:{registeredMembers:rows_(SHEETS.MEMBERS).length,
      booked:bs.filter(function(b){return String(b.Status)==='VERIFIED';}).length,
      attended:bs.filter(function(b){return String(b.Status)==='ATTENDED';}).length,
      bankVerifiedPayments:paid.length,
      pendingOrders:qs.filter(function(q){return String(q.Status)==='OPEN'&&new Date(q.Expires_At).getTime()>now;}).length,
      activePackages:plans.filter(function(p){return String(p.Status)==='ACTIVE';}).length,
      exceptions:qs.filter(function(q){return String(q.Status)==='COMMITTING';}).length+
        requests.filter(function(r){return ['PROCESSING','OPEN'].includes(String(r.Status));}).length+
        rows_(SHEETS.NOTIFICATIONS).filter(function(n){return ['MANUAL_REVIEW','CLAIMED'].includes(String(n.Status));}).length},
    sessions:sessions,bankReadback:bankReadback,containsParticipantPII:false};
}
