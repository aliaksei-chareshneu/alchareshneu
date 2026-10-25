/*
 * Druzina/Fio bridge: SOURCE-STAGED, NOT INSTALLED.
 *
 * Fio banka REST JSON documented 16 Oct 2025. Only GET /periods/ is used,
 * with an *account-watch only* token. We never send bank payment instructions.
 * All account information and token stays in owner Script Properties.
 *
 * Important: a numeric variabilni symbol (VS) is required for automatic bank
 * matching. Older quotes used a non-numeric DRU... reference and cannot be
 * auto-reconciled. Never mutate historical paid quotes; reissue with consent.
 */
var DRUF_VERSION='DRUF-2026-10-25-v1';

function drufVS(x){
  var s=String(x==null?'':x).trim();
  return /^\d{1,10}$/.test(s) ? String(Number(s)) : '';
}
function drufNumericVS(existing,randomProvider){
  var used={};
  (existing||[]).forEach(function(v){var k=drufVS(v);if(k)used[k]=true;});
  var rand=randomProvider||Math.random;
  for(var i=0;i<40;i++){
    var f=Number(rand());if(!isFinite(f)||f<0||f>=1)throw Error('random source invalid');
    var n=String(1000000000+Math.floor(f*9000000000));
    if(!used[n])return n;
  }
  throw Error('Could not reserve unique numeric payment reference');
}
function drufMoneyHalers(value) {
  var s=String(value==null?'':value).trim().replace(',', '.');
  if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s))return null;
  var negative=s[0]==='-';if(negative||s[0]==='+')s=s.slice(1);
  var parts=s.split('.');
  var koruny=Number(parts[0]),hal=Number((parts[1]||'').padEnd(2,'0'));
  if(!Number.isSafeInteger(koruny)||!Number.isSafeInteger(hal)||hal>99)return null;
  var sum=koruny*100+hal;
  if(!Number.isSafeInteger(sum))return null;
  return negative?-sum:sum;
}
function drufV(v){return v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,'value')?v.value:v;}
function drufSafeBankAccount(v) {
  var s=String(v==null?'':v).trim().replace(/[\s]/g,'');
  return /^\d{1,16}$/.test(s)?s:'';
}
function drufParseFioJSON(json,expected){
  if(!json||!json.accountStatement||!expected)return {ok:false,code:'BAD_FIO_FORMAT'};
  var root=json.accountStatement,info=root.info||{},list=root.transactionList||{};
  var account=drufSafeBankAccount(info.accountId),bank=String(info.bankId||'').trim();
  var expectedAccount=drufSafeBankAccount(expected.accountId);
  var expectedBank=String(expected.bankId||'').trim();
  if(!account||!expectedAccount||account!==expectedAccount||!/^\d{4}$/.test(bank)
      ||bank!==expectedBank||String(info.currency||'')!=='CZK')
    return {ok:false,code:'WRONG_FIO_SETTLEMENT_ACCOUNT'};
  var txs=list.transaction||[];
  if(!Array.isArray(txs))txs=[txs];
  if(txs.length>2000)return {ok:false,code:'BANK_BATCH_TOO_LARGE'};
  var result=[],seen={};
  for(var i=0;i<txs.length;i++){
    var t=txs[i]||{};
    var id=String(drufV(t.column22)||'').trim(),
        amountHal=drufMoneyHalers(drufV(t.column1)),
        currency=String(drufV(t.column14)||'').trim(),
        vs=drufVS(drufV(t.column5)),
        kind=String(drufV(t.column8)||'').trim().toLowerCase();
    if(!/^\d{6,18}$/.test(id)||seen[id]||amountHal===null)continue;
    seen[id]=true;
    // Exclude corrections, outgoing transfers and non-CZK entries.
    if(amountHal<=0||currency!=='CZK'||!vs||/opravn|storno|reversal/.test(kind))continue;
    result.push({
      transactionId:id,amountCZK:amountHal/100,amountHalers:amountHal,
      variableSymbol:vs,currency:'CZK',direction:'CREDIT',isReversal:false,
      accountKey:account+'/'+bank,tokenAccountVerified:true
    });
  }
  return {ok:true,count:result.length,transactions:result,
    accountKey:account+'/'+bank};
}
function drufBankMatch(transfer,quote,expectedAccountKey,alreadyUsedIds){
  if(!transfer||!quote||!expectedAccountKey)return {ok:false,code:'BAD_MATCH_INPUT'};
  var reference=drufVS(quote.Payment_Reference);
  if(!reference)return {ok:false,code:'LEGACY_NONNUMERIC_REFERENCE'};
  if(transfer.accountKey!==expectedAccountKey)return {ok:false,code:'WRONG_PAYEE'};
  if(transfer.currency!=='CZK'||transfer.direction!=='CREDIT'||transfer.isReversal)
    return {ok:false,code:'NOT_SETTLED_CZK_CREDIT'};
  if(transfer.variableSymbol!==reference)return {ok:false,code:'VS_MISMATCH'};
  if(!Number.isSafeInteger(transfer.amountHalers)||transfer.amountHalers<1||
     transfer.amountHalers!==Number(quote.Expected_Amount_CZK)*100)
    return {ok:false,code:'AMOUNT_MISMATCH'};
  if(!transfer.transactionId||!/^\d{6,18}$/.test(String(transfer.transactionId)))
    return {ok:false,code:'BAD_BANK_TRANSACTION_ID'};
  if((alreadyUsedIds||[]).includes(String(transfer.transactionId)))
    return {ok:false,code:'ALREADY_USED'};
  if(String(quote.Status)!=='OPEN')return {ok:false,code:'QUOTE_NOT_OPEN'};
  if(!quote.Expires_At||new Date(quote.Expires_At).getTime()<=Date.now())
    return {ok:false,code:'QUOTE_EXPIRED'};
  return {ok:true,transactionId:String(transfer.transactionId),
    reference:reference,amountCZK:Number(quote.Expected_Amount_CZK),
    quoteId:String(quote.Quote_ID)};
}
/*
 * A bank transfer cannot force legal confirmation. All checks are server-side,
 * including exact paid seller and signed, per-session safe capacity. Unknown
 * venue/insurer/first aid/guardian availability => 0 sellable places.
 */
function drufPositiveGate(row){
  if(!row||String(row.Slot_State)!=='CONFIRMED')return false;
  var yes=function(x){return x===true||String(x||'').toUpperCase()==='VERIFIED';};
  if(!yes(row.Venue_Permission_Verified)||!yes(row.Instructor_Verified)||
    !yes(row.Activity_Insurance_Verified)||!yes(row.Equipment_Check)||
    !yes(row.Participant_Safety_Form_Valid)||!yes(row.Guardian_Gate_If_Minors))
    return false;
  var cap=Number(row.BOOKABLE_TRAINING_PAX_FAIL_CLOSED_FORMULA);
  return Number.isInteger(cap)&&cap>0&&cap<=100&&row.Publish_Confirmed_Only==='YES';
}
function drufCanLaunch(config,properties,gates){
  if(!config||!properties)return {ok:false,code:'CONFIG_MISSING'};
  if(String(properties.DRU_FIO_READONLY_CONFIRMED)!=='YES')
    return {ok:false,code:'FIO_TOKEN_TYPE_UNVERIFIED'};
  if(String(properties.DRU_FIO_SETTLEMENT_SELLER_CONFIRMED)!=='YES')
    return {ok:false,code:'BENEFICIARY_UNVERIFIED'};
  if(String(properties.DRU_PAID_BOOKING_APPROVED)!=='YES')
    return {ok:false,code:'PAID_BOOKING_NOT_APPROVED'};
  if(String(properties.DRU_LEGAL_SELLER_CONFIRMED)!=='YES')
    return {ok:false,code:'LEGAL_SELLER_UNVERIFIED'};
  if(String(config.SAFETY_FORM_VERSION||'').length===0||
     String(config.RULES_VERSION||'').length===0)
    return {ok:false,code:'SAFETY_CONSENTS_UNVERIFIED'};
  if(!Array.isArray(gates)||gates.length<1||!gates.every(drufPositiveGate))
    return {ok:false,code:'PER_DATE_SAFETY_GATE_UNVERIFIED'};
  return {ok:true,code:'DRU_FIO_RELEASE_GATES_OK'};
}
/* Only verified owner-side Apps Script can call this. No token, account or
 * payee PII is returned. No call is made when credentials/release are absent.
 */
function drufReadOnlyPreview(){
  requireOwner_();
  var p=PropertiesService.getScriptProperties();
  var token=String(p.getProperty('DRU_FIO_READONLY_TOKEN')||'');
  var account=String(p.getProperty('DRU_FIO_ACCOUNT_ID')||'');
  var bank=String(p.getProperty('DRU_FIO_BANK_ID')||'');
  if(!/^[a-zA-Z0-9]{64}$/.test(token)||!drufSafeBankAccount(account)||
      !/^\d{4}$/.test(bank))
    return {ok:false,code:'FIO_READ_ONLY_CREDENTIALS_NOT_CONFIGURED',version:DRUF_VERSION};
  // This read-only probe is intentionally disabled until the token's
  // permissions are independently confirmed by its account owner.
  if(p.getProperty('DRU_FIO_READONLY_CONFIRMED')!=='YES')
    return {ok:false,code:'FIO_READ_ONLY_PERMISSION_NOT_VERIFIED',version:DRUF_VERSION};
  var now=new Date(), from=new Date(now.getTime()-2*86400000);
  var dt=function(d){return Utilities.formatDate(d,'Europe/Prague','yyyy-MM-dd');};
  var url='https://fioapi.fio.cz/v1/rest/periods/'+encodeURIComponent(token)+'/'+dt(from)+'/'+dt(now)+'/transactions.json';
  var response=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,
      followRedirects:false,headers:{Accept:'application/json'}});
  if(response.getResponseCode()!==200)
    return {ok:false,code:'FIO_API_TEMPORARILY_UNAVAILABLE',version:DRUF_VERSION};
  var raw=JSON.parse(response.getContentText('UTF-8'));
  var parsed=drufParseFioJSON(raw,{accountId:account,bankId:bank});
  // Never log URLs, raw bank response, personal payer data or token.
  if(!parsed.ok)return {ok:false,code:parsed.code,version:DRUF_VERSION};
  var used={};
  rows_(SHEETS.PAYMENTS).forEach(function(p){
    var note=String(p.Reconciliation_Note||''),match=note.match(/FIO_SETTLED_ID=(\d{6,18})/);
    if(match)used[match[1]]=true;
  });
  var quotes=rows_(SHEETS.QUOTES),candidates=[];
  parsed.transactions.forEach(function(t){
    if(used[t.transactionId])return;
    quotes.forEach(function(q){
      var m=drufBankMatch(t,q,parsed.accountKey,Object.keys(used));
      if(m.ok)candidates.push({quoteId:m.quoteId,bankId:m.transactionId,
        amountCZK:m.amountCZK,reference:m.reference});
    });
  });
  // Private owner-only preview, NOT receipt confirmation.
  return {ok:true,previewOnly:true,version:DRUF_VERSION,
    incomingCount:parsed.count,candidateCount:candidates.length,
    candidates:candidates.slice(0,40)};
}
function drufUniqueVSForQuote_(){
  // Call *inside* createQuote's existing LockService critical section.
  var q=rows_(SHEETS.QUOTES).map(function(x){return x.Payment_Reference;});
  var p=rows_(SHEETS.PAYMENTS).map(function(x){return x.Payment_Reference;});
  return drufNumericVS(q.concat(p));
}

/* Czech QR payment string: no third-party QR API is called. Only server
 * provided and independently verified merchant IBAN/quote may enter this.
 * The frontend can render the SPD locally with an offline QR encoder.
 */
function drufCzIbanValid(value){
  var iban=String(value||'').replace(/\s+/g,'').toUpperCase();
  if(!/^CZ\d{22}$/.test(iban))return false;
  var shifted=iban.slice(4)+iban.slice(0,4).replace(/[A-Z]/g,function(c){
    return String(c.charCodeAt(0)-55);
  });
  var mod=0;
  for(var i=0;i<shifted.length;i++){
    var ch=shifted.charAt(i),n=Number(ch);
    if(!Number.isInteger(n))return false;
    mod=(mod*10+n)%97;
  }
  return mod===1;
}
function drufBankInstructions(quote,merchant){
  if(!quote||!merchant||merchant.verifiedLegalPayee!==true||
      merchant.verifiedReadOnlyBankAccount!==true||
      merchant.paidBookingLiveApproved!==true)
    return {ok:false,code:'PAYMENT_BENEFICIARY_OR_LAUNCH_UNVERIFIED'};
  var vs=drufVS(quote.Payment_Reference),iban=String(merchant.iban||'').replace(/\s+/g,'').toUpperCase();
  var amountHal=drufMoneyHalers(quote.Expected_Amount_CZK);
  if(!drufCzIbanValid(iban)||!vs||!amountHal||amountHal<=0||
      !Number.isInteger(amountHal)||amountHal>100000000)
    return {ok:false,code:'INVALID_BANK_INSTRUCTIONS'};
  if(String(quote.Status)!=='OPEN'||!quote.Expires_At||
      new Date(quote.Expires_At).getTime()<=Date.now())
    return {ok:false,code:'QUOTE_EXPIRED_OR_NOT_OPEN'};
  var amount=(amountHal/100).toFixed(2);
  return {ok:true,bankIban:iban,amountCZK:amountHal/100,
    variableSymbol:vs,expiresAt:String(quote.Expires_At),
    spd:'SPD*1.0*ACC:'+iban+'*AM:'+amount+'*CC:CZK*X-VS:'+vs,
    status:'PENDING_BANK_SETTLEMENT_NOT_PAID',confirmedBooking:false};
}
/* Upgrade adapter. Must be called ONLY by the existing authenticated portal
 * server code after its p10 OTP checks; underscore prevents google.script.run
 * public direct invocation. Never call legacy createQuote() directly from
 * public checkout UI after upgrading its payment reference format.
 */
function drufCreateQuoteWithVS_(payload){
  var p=PropertiesService.getScriptProperties();
  var cfg=configMap_(),flags={
    DRU_FIO_READONLY_CONFIRMED:p.getProperty('DRU_FIO_READONLY_CONFIRMED'),
    DRU_FIO_SETTLEMENT_SELLER_CONFIRMED:p.getProperty('DRU_FIO_SETTLEMENT_SELLER_CONFIRMED'),
    DRU_PAID_BOOKING_APPROVED:p.getProperty('DRU_PAID_BOOKING_APPROVED'),
    DRU_LEGAL_SELLER_CONFIRMED:p.getProperty('DRU_LEGAL_SELLER_CONFIRMED')
  };
  var items=(payload&&Array.isArray(payload.items))?payload.items:[];
  var ids=[];
  items.forEach(function(it){
    if(it.sessionId)ids.push(String(it.sessionId));
    if(Array.isArray(it.sessionIds))ids=ids.concat(it.sessionIds.map(String));
  });
  if(!ids.length)throw Error('No verified session dates');
  var gateRows=rows_('Druzina_Training_Capacity_Gate'),gates=ids.map(function(id){
    return gateRows.filter(function(r){return String(r.Session_ID)===id;})[0];
  });
  var release=drufCanLaunch(cfg,flags,gates);
  if(!release.ok)throw Error('Paid bookings are not yet enabled: '+release.code);
  if(!drufCzIbanValid(p.getProperty('DRU_FIO_IBAN')))
    throw Error('Verified Fio IBAN is not configured');
  // createQuote() is the existing p10 authenticated, locked, price-resolving
  // function. This adapter does not bypass its identity/price/capacity gates.
  var result=createQuote(payload);
  return withLock_(function(){
    var q=quoteById_(result.quoteId);
    if(!q||String(q.Status)!=='OPEN')throw Error('Quote unavailable');
    if(!drufVS(q.Payment_Reference)){
      var numeric=drufUniqueVSForQuote_();
      patchRow_(SHEETS.QUOTES,q._row,{Payment_Reference:numeric});
      q.Payment_Reference=numeric;
    }
    var payment=drufBankInstructions(q,{
      iban:p.getProperty('DRU_FIO_IBAN'),verifiedLegalPayee:true,
      verifiedReadOnlyBankAccount:true,paidBookingLiveApproved:true
    });
    if(!payment.ok)throw Error('Payment instructions not available');
    result.paymentReference=q.Payment_Reference;
    result.paymentUrl=''; // legacy generic Revolut link is not the verified payee.
    result.bankTransfer=payment;
    result.confirmedBooking=false;
    return result;
  });
}
