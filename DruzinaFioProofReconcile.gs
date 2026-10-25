/*
 * Fio read-only incoming credit -> verify an EXISTING portal payment proof.
 * STAGED only. No unverified seller, SMS or browser user may invoke this.
 *
 * Why distinct from fresh quote settlement? The canonical policy is that
 * timely proof SUBMISSION, not the bank's later clearing timestamp, controls
 * the 48-hour tariff. A quote whose hold has expired may already have
 * PROOF_SUBMITTED and provisional bookings. Do not charge twice, manufacture
 * a second booking, or demand a 25% surcharge after the bank clears.
 */
var DRUP_VERSION='DRUP-2026-10-25-v1';
function drupProofPreflight_(payment,quote,movement,payeeKey,usedBankIds,linkedBookings){
  if(!payment||!quote||!movement)return {ok:false,code:'NO_PAYMENT_RECORD'};
  if(String(payment.Verification_Status)==='VERIFIED')
    return {ok:false,code:'ALREADY_VERIFIED'};
  if(String(payment.Verification_Status)!=='PROOF_SUBMITTED')
    return {ok:false,code:'NOT_PROVISIONAL_PROOF'};
  if(String(quote.Status)!=='COMMITTED'||
     String(payment.Source_Request_ID)!==String(quote.Quote_ID)||
     String(payment.Member_ID)!==String(quote.Member_ID))
    return {ok:false,code:'PAYMENT_QUOTE_MISMATCH'};
  var vs=drufVS(payment.Payment_Reference);
  if(!vs||drufVS(quote.Payment_Reference)!==vs||
     drufVS(movement.variableSymbol)!==vs)
    return {ok:false,code:'BANK_REFERENCE_MISMATCH'};
  if(!payeeKey||String(movement.accountKey)!==payeeKey||
     movement.tokenAccountVerified!==true)
    return {ok:false,code:'UNVERIFIED_BANK_PAYEE'};
  if(movement.currency!=='CZK'||movement.direction!=='CREDIT'||
      movement.isReversal===true||!/^\d{6,18}$/.test(String(movement.transactionId||'')))
    return {ok:false,code:'NOT_VERIFIED_INCOMING_CREDIT'};
  if((usedBankIds||[]).includes(String(movement.transactionId)))
    return {ok:false,code:'DUPLICATE_BANK_TRANSACTION'};
  var due=Number(payment.Expected_Amount_CZK);
  if(!Number.isSafeInteger(due)||due<1||due!==Number(quote.Expected_Amount_CZK)||
     Number(payment.Amount_CZK)!==due ||
     movement.amountHalers!==due*100)
    return {ok:false,code:'BANK_AMOUNT_NOT_EXACT'};
  var submittedAt=new Date(payment.Declared_At);
  if(!isFinite(submittedAt.getTime())||submittedAt.getTime()>Date.now()||
     String(payment.Policy_Version||'').length<5)
    return {ok:false,code:'PROOF_TIMESTAMP_OR_POLICY_INVALID'};
  if(!Array.isArray(linkedBookings)||linkedBookings.length<1||
     linkedBookings.some(function(b){
       return String(b.Member_ID)!==String(payment.Member_ID)||
         String(b.Payment_ID)!==String(payment.Payment_ID)||
         ['CANCELLED','CLUB_CANCELLED','PAYMENT_EXCEPTION'].includes(String(b.Status));
     }))
    return {ok:false,code:'BOOKINGS_UNSAFE_OR_MISSING'};
  return {ok:true,code:'SETTLE_EXISTING_PROOF',paymentId:String(payment.Payment_ID),
    bankTransactionId:String(movement.transactionId),amountCZK:due,
    quoteId:String(quote.Quote_ID),proofSubmittedAt:submittedAt.toISOString()};
}
function drupReconcileExistingProof_(movement){
  return withLock_(function(){
    var p=PropertiesService.getScriptProperties(),props={
      DRU_FIO_READONLY_CONFIRMED:p.getProperty('DRU_FIO_READONLY_CONFIRMED'),
      DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:p.getProperty('DRU_FIO_SETTLEMENT_SELLER_CONFIRMED'),
      DRU_PAID_BOOKING_APPROVED:p.getProperty('DRU_PAID_BOOKING_APPROVED'),
      DRU_LEGAL_SELLER_CONFIRMED:p.getProperty('DRU_LEGAL_SELLER_CONFIRMED')
    };
    if(p.getProperty('DRU_FIO_AUTOMATION_ENABLED')!=='YES')
      return {ok:false,code:'RECONCILIATION_DISABLED'};
    var key=drufSafeBankAccount(p.getProperty('DRU_FIO_ACCOUNT_ID'))+
      '/'+String(p.getProperty('DRU_FIO_BANK_ID')||'');
    if(!movement||!drufVS(movement.variableSymbol)||
        !/^\d{1,16}\/\d{4}$/.test(key))
      return {ok:false,code:'UNVERIFIED_REFERENCE_OR_ACCOUNT'};
    var candidates=rows_(SHEETS.PAYMENTS).filter(function(r){
      return drufVS(r.Payment_Reference)===drufVS(movement.variableSymbol) &&
        ['PROOF_SUBMITTED','VERIFIED'].includes(String(r.Verification_Status));
    });
    if(candidates.length!==1)return {ok:false,code:'PAYMENT_NOT_UNIQUE_OR_MISSING'};
    var payment=candidates[0],quote=findOne_(SHEETS.QUOTES,function(r){
      return String(r.Quote_ID)===String(payment.Source_Request_ID);
    });
    var bookings=findAll_(SHEETS.BOOKINGS,function(r){
      return String(r.Payment_ID)===String(payment.Payment_ID);
    });
    var used=rows_(SHEETS.PAYMENTS).map(function(r){
      var m=String(r.Reconciliation_Note||'').match(/FIO_SETTLED_ID=(\d{6,18})/);
      return m?m[1]:null;
    }).filter(Boolean);
    var match=drupProofPreflight_(payment,quote,movement,key,used,bookings);
    if(!match.ok)return match;
    var gates=rows_('Druzina_Training_Capacity_Gate'),requested=[];
    bookings.forEach(function(b){
      if(!requested.includes(String(b.Session_ID)))requested.push(String(b.Session_ID));
    });
    var verified=requested.map(function(id){
      return gates.filter(function(g){return String(g.Session_ID)===id;})[0];
    });
    if(verified.some(function(g){return !g;}))
      return {ok:false,code:'SESSION_SAFETY_GATE_NOT_VERIFIED'};
    var active=drufCanLaunch(configMap_(),props,verified);
    if(!active.ok)return active;
    // Existing portal's canonical reconciliation updates payment and linked
    // bookings/plan/ledger idempotently. It must be executed under the same
    // script lock; do NOT create a second booking/payment.
    var ownerToken=p.getProperty('ADMIN_TOKEN');
    if(!ownerToken)return {ok:false,code:'ADMIN_RECONCILIATION_AUTH_MISSING'};
    var receipt='FIO_SETTLED_ID='+movement.transactionId+'; read-only Fio verification; '+
      'proof received '+match.proofSubmittedAt;
    var result=reconcilePayment({adminToken:ownerToken,
      paymentId:payment.Payment_ID,status:'VERIFIED',note:receipt});
    if(!result||result.ok!==true)throw Error('Canonical reconcilePayment failed');
    // Bank-clearing timestamp NEVER determines the original late-tier price.
    return {ok:true,code:'PAYMENT_VERIFIED_NO_DUPLICATE_BOOKING',
      paymentId:match.paymentId,bankTransactionId:match.bankTransactionId,
      existingBookingCount:bookings.length,bankAmountCZK:match.amountCZK};
  });
}
