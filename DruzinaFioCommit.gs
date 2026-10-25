/*
 * Owner-side Fio VERIFIED-CREDIT -> existing Druzina CRM -> bookings adapter.
 * SOURCE-STAGED. No function here is exposed to google.script.run (suffix _).
 * DO NOT install from superseded p1 bundle. Integrate with p10 only after its
 * authenticated quote API and identity gates have been verified in live smoke.
 *
 * The only supported initial live products are: November First Visit 240,
 * Starter4 800/paid verified first-visit top-up 560, and individual Flex.
 * Other packages require their own approved validity and test matrix first.
 */
var DRUC_VERSION='DRUC-2026-10-25-v1';
function drufCartSessionIds_(items) {
  var ids=[],seen={};
  (items||[]).forEach(function(it){
    var list=(it.kind==='PACKAGE'||it.kind==='PACKAGE_UPGRADE')?it.sessionIds:[it.sessionId];
    if(!Array.isArray(list))return;
    list.forEach(function(v){
      var id=String(v||'');
      if(!id||seen[id])throw Error('Duplicate or invalid session in cart');
      seen[id]=true;ids.push(id);
    });
  });
  return ids;
}
function drufVerifiedFirstVisit_(member,bookingId) {
  var b=findOne_(SHEETS.BOOKINGS,function(x){
    return String(x.Booking_ID)===String(bookingId)&&
      String(x.Member_ID)===String(member.Member_ID);
  });
  if(!b||String(b.Status)!=='ATTENDED'||
      String(b.Attendance_Status)!=='PRESENT'||
      !(b.Attendance_Checked===true||String(b.Attendance_Checked).toUpperCase()==='TRUE')||
      !!b.Plan_ID)throw Error('First visit was not instructor-verified or already credited');
  var p=findOne_(SHEETS.PAYMENTS,function(x){
    return String(x.Payment_ID)===String(b.Payment_ID)&&
      String(x.Member_ID)===String(member.Member_ID);
  });
  if(!p||String(p.Verification_Status)!=='VERIFIED'||
      Number(p.Received_Amount_CZK)!==240)
    throw Error('First visit 240 Kč not bank verified');
  var s=sessionById_(b.Session_ID);
  if(!s||!s.End_DateTime)throw Error('Verified session end is missing');
  return {verified:true,paymentVerified:true,creditAlreadyUsed:false,
    sessionId:String(b.Session_ID),attendedAt:new Date(s.End_DateTime).toISOString(),
    amountReceivedCZK:240};
}
function drufVerifyCartPricing_(quote,items,member) {
  var now=new Date().toISOString();
  var sum=0;
  (items||[]).forEach(function(it){
    var id=it.sessionId||((it.sessionIds||[])[0]),s=sessionById_(id);
    if(!s||String(s.Status)!=='OPEN')throw Error('Session is closed');
    if(new Date(s.Start_DateTime)<new Date('2026-11-01T00:00:00+01:00'))
      throw Error('Historic session is not eligible for new bank checkout');
    var name=String(it.productCode||''),kind=String(it.kind||''),type,tier='JUNIOR',input;
    if(kind==='SESSION'){
      if(name==='DRU-FIRSTVISIT-202611') {
        type='FIRST_VISIT'; input={firstVisitEligible:isTrialEligible_(member)};
      }else if(/^(DRU-(JUNIOR|SENIOR)-(DROPIN|FLEX|LATE|EMERGENCY)(-2026(10|11))?)$/.test(name)) {
        type='FLEX'; tier=String(member.Tier||'Junior').toUpperCase()==='SENIOR'?'SENIOR':'JUNIOR';
        input={existingMemberVerified:true,firstVisitEligible:false};
      }else throw Error('Product not supported for Fio checkout');
      input.type=type;input.tier=tier;input.nowISO=now;input.sessionStartsAt=new Date(s.Start_DateTime).toISOString();
    }else if(kind==='PACKAGE'&&name==='DRU-STARTER4-202611'){
      type='STARTER4';
      input={type:type,tier:'JUNIOR',nowISO:now,
        sessionStartsAt:new Date(s.Start_DateTime).toISOString(),
        selectedSessions:(it.sessionIds||[]).map(function(x){
          return new Date(sessionById_(x).Start_DateTime).toISOString();
        })};
    }else if(kind==='PACKAGE_UPGRADE'&&name==='DRU-STARTER4-202611'){
      type='STARTER4_UPGRADE';
      input={type:type,tier:'JUNIOR',nowISO:now,
        sessionStartsAt:new Date(s.Start_DateTime).toISOString(),
        selectedSessions:(it.sessionIds||[]).map(function(x){
          return new Date(sessionById_(x).Start_DateTime).toISOString();
        }),
        verifiedFirstAttendance:drufVerifiedFirstVisit_(member,it.trialUpgradeBookingId)};
    }else throw Error('Package not released for Fio checkout');
    var computed=drubQuoteItem(input);
    if(!computed.ok||Number(computed.amountCZK)!==Number(it.lineTotal))
      throw Error('Stale or incorrect checkout price, recompute before paying');
    if(kind==='PACKAGE_UPGRADE'&&Number(it.trialCredit)!==240)
      throw Error('Old 120 Kč trial credit is not a valid November upgrade');
    if(type==='FIRST_VISIT'&&Number(it.lineTotal)!==240)
      throw Error('November First Visit must be 240 Kč');
    sum+=Number(it.lineTotal);
  });
  if(!items||!items.length||sum!==Number(quote.Expected_Amount_CZK))
    throw Error('Checkout total does not equal authoritative cart');
  return {ok:true,amountCZK:sum,items:items};
}
function drufGuardBankCommit_(tx,quote,items,member) {
  var p=PropertiesService.getScriptProperties(),cfg=configMap_();
  var flags={
    DRU_FIO_READONLY_CONFIRMED:p.getProperty('DRU_FIO_READONLY_CONFIRMED'),
    DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:p.getProperty('DRU_FIO_SETTLEMENT_SELLER_CONFIRMED'),
    DRU_PAID_BOOKING_APPROVED:p.getProperty('DRU_PAID_BOOKING_APPROVED'),
    DRU_LEGAL_SELLER_CONFIRMED:p.getProperty('DRU_LEGAL_SELLER_CONFIRMED')
  };
  if(p.getProperty('DRU_FIO_AUTOMATION_ENABLED')!=='YES')
    return {ok:false,code:'AUTOMATIC_SETTLEMENT_DISABLED'};
  var ids=drufCartSessionIds_(items),gates=rows_('Druzina_Training_Capacity_Gate')
    .filter(function(r){return ids.includes(String(r.Session_ID));});
  if(gates.length!==ids.length)return {ok:false,code:'SESSION_SAFETY_GATE_MISSING'};
  var gate=drufCanLaunch(cfg,flags,gates);
  if(!gate.ok)return gate;
  var account=drufSafeBankAccount(p.getProperty('DRU_FIO_ACCOUNT_ID')),
      bank=String(p.getProperty('DRU_FIO_BANK_ID')||'');
  if(!account||!/^\d{4}$/.test(bank))return {ok:false,code:'PAYEE_ACCOUNT_MISSING'};
  var used=rows_(SHEETS.PAYMENTS)
    .map(function(r){var m=String(r.Reconciliation_Note||'').match(/FIO_SETTLED_ID=(\d{6,18})/);
      return m?m[1]:null;}).filter(Boolean);
  var match=drufBankMatch(tx,quote,account+'/'+bank,used);
  if(!match.ok)return match;
  if(findOne_(SHEETS.PAYMENTS,function(r){
    return String(r.Source_Request_ID)===String(quote.Quote_ID);
  }))return {ok:false,code:'QUOTE_ALREADY_HAS_PAYMENT'};
  try {
    // Recheck same rules at bank settlement time; T-48 is not frozen by quote.
    revalidateQuote_(quote,member);
    drufVerifyCartPricing_(quote,items,member);
  }catch(error){return {ok:false,code:'QUOTE_CHANGED_OR_CUTOFF',reason:String(error.message||'').slice(0,160)};}
  return {ok:true,code:'BANK_PAID_AND_ALL_BOOKING_GATES_PASSED'};
}
/* This side-effecting function is available only to an authorized owner-side
 * scheduled Apps Script worker, NEVER to a web user. It records a bank-settled
 * payment and the booked dates with existing canonical CRM field names.
 * No new separate finance system, no screenshots, no speculative payment.
 */
function drufCommitVerifiedBankTransaction_(movement) {
  return withLock_(function(){
    if(!movement||!/^\d{6,18}$/.test(String(movement.transactionId||'')))
      return {ok:false,code:'INVALID_BANK_RECORD'};
    var reference=drufVS(movement.variableSymbol);
    if(!reference)return {ok:false,code:'BANK_REFERENCE_UNMATCHED'};
    var quotes=findAll_(SHEETS.QUOTES,function(q){
      return drufVS(q.Payment_Reference)===reference;
    });
    if(quotes.length!==1)return {ok:false,code:'QUOTE_MATCH_NOT_UNIQUE'};
    var quote=quotes[0],member=findOne_(SHEETS.MEMBERS,function(m){
      return String(m.Member_ID)===String(quote.Member_ID);
    });
    if(!member)return {ok:false,code:'QUOTE_MEMBER_MISSING'};
    var items;
    try {items=JSON.parse(String(quote.Cart_JSON||'[]'));}
    catch(_){return {ok:false,code:'INVALID_CART_SNAPSHOT'};}
    var gate=drufGuardBankCommit_(movement,quote,items,member);
    if(!gate.ok)return gate;
    // Stop retries early. An interrupted commit is an OWNER EXCEPTION and
    // must never create another payment for the same bank credit.
    patchRow_(SHEETS.QUOTES,quote._row,{Status:'COMMITTING'});
    var id=id_('PAY'),now=nowIso_(),ids=[];
    appendObj_(SHEETS.PAYMENTS,{
      Payment_ID:id,Member_ID:member.Member_ID,Product_Code:items.length===1?items[0].productCode:'MULTI_CART',
      Amount_CZK:movement.amountCZK,Declared_At:now,Proof_File_URL:'',Proof_Filename:'',
      Verification_Status:'VERIFIED',Verified_At:now,Payment_Reference:reference,
      Source_Request_ID:quote.Quote_ID,Method:'fio_api_read_only',
      Notes:'Incoming bank credit matched by VS and unique bank transaction ID',
      Expected_Amount_CZK:quote.Expected_Amount_CZK,Received_Amount_CZK:movement.amountCZK,
      Outstanding_CZK:0,Cutoff_Class:items.map(function(x){return x.cutoff||x.kind;}).join('+'),
      Policy_Version:String(quote.Policy_Version||DRUC_VERSION),
      Reconciled_At:now,Reconciliation_Note:'FIO_SETTLED_ID='+movement.transactionId
    });
    items.forEach(function(it){
      if(it.kind==='PACKAGE'||it.kind==='PACKAGE_UPGRADE'){
        var r=activatePackage_(member,it,id);ids=ids.concat(r.bookingIds);
        appendObj_(SHEETS.PAYMENT_ITEMS,{
          Payment_Item_ID:id_('PI'),Payment_ID:id,Product_Code:it.productCode,
          Description:String(it.name||''),Qty:1,Unit_Amount_CZK:it.unitAmount,
          Line_Total_CZK:it.lineTotal,Related_Session_ID:'',Related_Plan_ID:r.planId,
          Status:'VERIFIED',Notes:'Fio bank verified '+DRUC_VERSION
        });
      }else{
        var bid=createBooking_(member,it.sessionId,'',id,it.productCode,it.cutoff,it.policyVersion);
        ids.push(bid);
        appendObj_(SHEETS.PAYMENT_ITEMS,{
          Payment_Item_ID:id_('PI'),Payment_ID:id,Product_Code:it.productCode,
          Description:String(it.name||''),Qty:1,Unit_Amount_CZK:it.unitAmount,
          Line_Total_CZK:it.lineTotal,Related_Session_ID:it.sessionId,
          Related_Plan_ID:'',Status:'VERIFIED',Notes:'Fio bank verified '+DRUC_VERSION
        });
      }
    });
    ids.forEach(function(bid){
      var b=findOne_(SHEETS.BOOKINGS,function(x){return String(x.Booking_ID)===String(bid);});
      if(b)patchRow_(SHEETS.BOOKINGS,b._row,{Status:'VERIFIED',Proof_Required:false});
    });
    findAll_(SHEETS.HOLDS,function(h){
      return String(h.Request_ID)===String(quote.Quote_ID)&&String(h.Status)==='ACTIVE';
    }).forEach(function(h){patchRow_(SHEETS.HOLDS,h._row,{Status:'COMMITTED'});});
    patchRow_(SHEETS.QUOTES,quote._row,{Status:'COMMITTED'});
    audit_('fio_readonly','Payment',id,'BANK_VERIFIED','','VERIFIED',
      'Unique bank ID matched, no user-uploaded proof');
    return {ok:true,status:'PAID_VERIFIED',paymentId:id,bookingIds:ids,amountCZK:movement.amountCZK};
  });
}
