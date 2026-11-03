/* Existing dedicated OTP portal API extension. SOURCE-STAGED, not installed.
 * No new CRM, mailer, trigger, deployment or payment-release switch.
 * Bind the existing portal's checkout to this method only after owner review.
 */
function createDruzinaBankOrder(payload){
  drusRequirePaid_(); // Default p13 adapter remains FALSE: no writes when paused.
  if(!bookingVerifiedRequired_())throw Error('Verified email OTP is required');
  return drufCreateQuoteWithVS_(payload);
}

/* Private operator read model. Bank markers are recorded evidence, not a new
 * bank/provider readback. No contact, child, token or counterparty data leaves
 * the server. Minimum group size is a review flag, never an auto-cancellation.
 */
function getDruzinaBookingOperations(payload){
  requireAdmin_(payload&&payload.adminToken);
  return withLock_(function(){
    var bookings=rows_(SHEETS.BOOKINGS),payments=rows_(SHEETS.PAYMENTS),
      quotes=rows_(SHEETS.QUOTES),plans=rows_(SHEETS.PLANS),holds=rows_(SHEETS.HOLDS);
    var bank=druaVerifiedPaymentIndex_(payments),gates=drusCapacityGateMap_();
    var occupied=['PROVISIONAL_CONFIRMED','CONFIRMED','VERIFIED'];
    var sessions=rows_(SHEETS.SESSIONS).filter(function(s){
      return new Date(s.Start_DateTime).getTime()>Date.now();
    }).map(function(s){
      var rows=bookings.filter(function(b){return String(b.Session_ID)===String(s.Session_ID);});
      var booked=rows.filter(function(b){return occupied.includes(String(b.Status));}).length;
      var confirmed=rows.filter(function(b){
        var p=bank[String(b.Payment_ID)];
        return String(b.Status)==='VERIFIED'&&p&&String(p.Member_ID)===String(b.Member_ID);
      }).length;
      var held=holds.filter(function(h){
        return String(h.Session_ID)===String(s.Session_ID)&&String(h.Status)==='ACTIVE'&&
          new Date(h.Expires_At).getTime()>Date.now();
      }).length;
      var capacity=drusSafeCapacity_(s,gates);
      return {sessionId:String(s.Session_ID),status:String(s.Status),
        capacity:capacity,occupied:booked,held:held,available:Math.max(0,capacity-booked-held),
        confirmedBankRecorded:confirmed,minimumGroupReview:confirmed<2,
        attendanceRecorded:rows.filter(function(b){return b.Attendance_Checked===true&&String(b.Attendance_Status)==='PRESENT';}).length};
    });
    return {ok:true,mode:'PRIVATE_RECORDED_CRM_STATE',bankReadback:'NOT_PERFORMED',
      paidCheckoutEnabled:drusPaidRelease_().ok,
      unpaidOrders:quotes.filter(function(q){return String(q.Status)==='OPEN';}).length,
      expiredUnpaidOrders:quotes.filter(function(q){return String(q.Status)==='EXPIRED'||
        (String(q.Status)==='OPEN'&&new Date(q.Expires_At).getTime()<=Date.now());}).length,
      bankRecordedPayments:Object.keys(bank).length,
      activePackages:plans.filter(function(p){return String(p.Status)==='ACTIVE';}).length,
      reviewRequired:payments.filter(function(p){return !bank[String(p.Payment_ID)];}).length+
        quotes.filter(function(q){return ['COMMITTING','PAYMENT_EXCEPTION'].includes(String(q.Status));}).length,
      sessions:sessions,automaticCancellations:0};
  });
}
