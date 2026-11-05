/* Consumes signed rows from the existing private Fio import tabs. It NEVER
 * calls Fio or duplicates the Hub's bank token. Existing paid gates stay in
 * force. Source only; actual bank reconciliation remains subject to owner GO. */
function drufReconcileImportedBank(){requireOwner_();return drufReconcileImportedBank_();}
function drufInstallBankPolling(){
  requireOwner_();var p=PropertiesService.getScriptProperties();
  if(!drufCanonicalPaidReady_()||p.getProperty('DRU_BANK_POLLING_APPROVED')!=='YES'||
      p.getProperty('DRU_BOOKING_SIGNED_IMPORT_CONFIRMED')!=='YES')return {ok:false,disabled:true,created:0};
  var existing=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='druzinaBankPolling_';});
  if(existing.length>1)throw Error('Duplicate bank polling triggers require owner review');
  if(existing.length)return {ok:true,created:0};
  ScriptApp.newTrigger('druzinaBankPolling_').timeBased().everyMinutes(5).create();
  return {ok:true,created:1};
}
function druzinaBankPolling_(){
  return {bank:drufReconcileImportedBank_(),notifications:drunQueueBookingNotifications_(),delivery:drunDeliverNotifications_()};
}
function drufReconcileImportedBank_(){
  var p=PropertiesService.getScriptProperties();
  if(p.getProperty('DRU_FIO_AUTOMATION_ENABLED')!=='YES'||!drufCanonicalPaidReady_())
    return {ok:true,disabled:true,settled:0};
  return withLock_(function(){
    var profile=String(p.getProperty('DRU_BOOKING_BANK_PROFILE')||''),
      seller=String(p.getProperty('DRU_BOOKING_SELLER_ID')||''),key=String(p.getProperty('DRU_BOOKING_IMPORT_SIGNING_KEY')||''),
      account=drufSafeBankAccount(p.getProperty('DRU_FIO_ACCOUNT_ID'))+'/'+String(p.getProperty('DRU_FIO_BANK_ID')||'');
    if(!['OSVC','DRUZINA'].includes(profile)||!seller||!/^\d{1,16}\/2010$/.test(account)||!/^[a-fA-F0-9]{64}$/.test(key))
      return {ok:false,code:'BANK_IMPORT_TRUST_NOT_CONFIGURED',settled:0};
    var tab=profile==='OSVC'?'OSVC_Fio_Transactions':'Druzina_Fio_Transactions';
    if(!ss_().getSheetByName(tab))return {ok:false,code:'EXISTING_BANK_IMPORT_MISSING',settled:0};
    var source=rows_(tab);if(source.length>2000)return {ok:false,code:'BANK_IMPORT_REVIEW_BATCH_REQUIRED',settled:0};
    var valid=[],review=0,replay=0,settled=0,seen={},used={};
    rows_(SHEETS.PAYMENTS).forEach(function(r){var m=String(r.Reconciliation_Note||'').match(/FIO_SETTLED_ID=(\d{6,18})/);if(m)used[m[1]]=true;});
    source.forEach(function(row){
      var check=drurVerifyImport_(row,profile,seller,account,key);
      if(!check.ok){review++;return;}
      var tx=check.movement;
      if(used[tx.transactionId]){replay++;return;}
      if(seen[tx.transactionId]){review++;seen[tx.transactionId]='DUPLICATE';return;}
      seen[tx.transactionId]='UNIQUE';valid.push(tx);
    });
    valid.forEach(function(tx){
      if(seen[tx.transactionId]!=='UNIQUE'||!tx.variableSymbol||tx.direction!=='CREDIT'||tx.isReversal){review++;return;}
      if(valid.filter(function(other){return other.variableSymbol===tx.variableSymbol;}).length!==1){review++;return;}
      var result;
      var existing=rows_(SHEETS.PAYMENTS).filter(function(r){return drufVS(r.Payment_Reference)===tx.variableSymbol&&
        String(r.Verification_Status)==='PROOF_SUBMITTED';});
      if(existing.length===1)result=drupReconcileExistingProof_(tx);
      else if(existing.length>1){review++;return;}
      else result=drufCommitVerifiedBankTransaction_(tx);
      if(result&&result.ok)settled++;else review++;
    });
    var receipt={ok:true,sourceProfile:profile,settled:settled,manualReview:review,replayed:replay,
      bankApiRequests:0,providerPaymentsCreated:0};
    audit_('bank_import','Integration','FIO_BOOKING_IMPORT','IMPORT_READBACK','','',JSON.stringify(receipt));
    return receipt;
  });
}
