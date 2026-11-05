/* Shared by the EXISTING Hub bank importer and booking portal. This contains
 * no bank client, token, payment instruction or new financial datastore.
 * The owner must separately configure a private signing key in both existing
 * projects before reviewed activation. Nothing here creates a credential. */
function drurMac_(body,key){
  return Utilities.computeHmacSha256Signature(body,key,Utilities.Charset.UTF_8)
    .map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}
function drurSignImport_(tx,profile){
  var p=PropertiesService.getScriptProperties();
  if(p.getProperty('DRU_BOOKING_ATTESTATION_ENABLED')!=='YES')return '';
  if(!['OSVC','DRUZINA'].includes(profile))throw Error('Bank profile unavailable');
  var key=String(p.getProperty('DRU_BOOKING_IMPORT_SIGNING_KEY')||''),
    seller=String(p.getProperty('DRU_BOOKING_'+profile+'_SELLER_ID')||''),
    account=String(p.getProperty('FIO_'+profile+'_EXPECTED_ACCOUNT_ID')||'');
  if(!/^[a-fA-F0-9]{64}$/.test(key)||!seller||!/^\d{1,16}$/.test(account))return '';
  if(!tx||!/^\d{6,18}$/.test(String(tx.id))||!Number.isSafeInteger(tx.cents)||tx.currency!=='CZK')
    throw Error('Invalid bank import receipt');
  var payload={version:1,legalEntity:profile,sellerId:seller,accountKey:account+'/2010',
    transactionId:String(tx.id),amountHalers:tx.cents,currency:'CZK',
    variableSymbol:String(tx.vs||'').replace(/^0+(?=\d)/,''),bankDate:String(tx.date||''),
    isReversal:/opravn|storno|reversal/i.test(String(tx.type||'')),issuedAt:new Date().toISOString()};
  var body=JSON.stringify(payload);
  return 'BANK_RECEIPT_V1:'+JSON.stringify({body:body,mac:drurMac_(body,key)});
}
function drurVerifyImport_(row,profile,seller,accountKey,key){
  if(!row||!['OSVC','DRUZINA'].includes(profile)||!seller||!accountKey||!/^[a-fA-F0-9]{64}$/.test(String(key||'')))
    return {ok:false,code:'BANK_IMPORT_TRUST_NOT_CONFIGURED'};
  var raw=String(row.Review_Notes||'');
  if(!raw.startsWith('BANK_RECEIPT_V1:'))return {ok:false,code:'UNSIGNED_BANK_IMPORT'};
  try{
    var envelope=JSON.parse(raw.slice('BANK_RECEIPT_V1:'.length)),expected=drurMac_(String(envelope.body),key),mac=String(envelope.mac||'');
    var diff=expected.length^mac.length;
    for(var i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(mac.charCodeAt(i)||0);
    if(diff!==0)return {ok:false,code:'BANK_IMPORT_SIGNATURE_INVALID'};
    var data=JSON.parse(envelope.body),issued=new Date(data.issuedAt).getTime();
    if(data.version!==1||data.legalEntity!==profile||data.sellerId!==seller||data.accountKey!==accountKey)
      return {ok:false,code:'BANK_IMPORT_ENTITY_OR_PAYEE_MISMATCH'};
    if(!Number.isFinite(issued)||issued>Date.now()||Date.now()-issued>36*3600000)
      return {ok:false,code:'BANK_IMPORT_RECEIPT_NOT_FRESH'};
    if(String(row.Bank_Transaction_ID)!==data.transactionId||drufMoneyHalers(row.Amount_CZK)!==data.amountHalers||
        String(row.Currency)!==data.currency||drufVS(row.VS)!==drufVS(data.variableSymbol))
      return {ok:false,code:'BANK_IMPORT_ROW_CHANGED'};
    return {ok:true,movement:{transactionId:data.transactionId,amountHalers:data.amountHalers,
      amountCZK:data.amountHalers/100,currency:data.currency,variableSymbol:drufVS(data.variableSymbol),
      direction:data.amountHalers>0?'CREDIT':'DEBIT',isReversal:data.isReversal===true,
      accountKey:data.accountKey,tokenAccountVerified:true}};
  }catch(_){return {ok:false,code:'INVALID_BANK_IMPORT_RECEIPT'};}
}
