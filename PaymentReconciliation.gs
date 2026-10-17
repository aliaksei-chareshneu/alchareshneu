/** Read-only reconciliation over existing NGO payment/import sheets. No settlement. */
function rcCents_(value) {
  if(value===null||value===undefined||!String(value).trim())throw Error('Missing amount');
  var n=Number(String(value).replace(',','.')),c=Math.round(n*100);
  if(!isFinite(n)||Math.abs(n*100-c)>0.00001||!Number.isSafeInteger(c))throw Error('Invalid amount');
  return c;
}
function rcReference_(value){var s=String(value==null?'':value).trim();return /^\d{1,10}$/.test(s)?s.replace(/^0+/,'')||'0':'';}
function rcPlan_(payments,transactions){
  var ids=Object.create(null),refs=Object.create(null),txids=Object.create(null);
  payments.forEach(function(p){
    var id=String(p.Payment_ID||'');if(!id||ids[id])throw Error('Missing or duplicate payment ID');ids[id]=true;
    var ref=rcReference_(p.Payment_Reference);if(ref)(refs[ref]||(refs[ref]=[])).push(p);
  });
  // Ambiguity includes closed records: re-used references must never select a newer order.
  var plans=transactions.map(function(t){
    var id=String(t.Bank_Transaction_ID||'');if(!/^\d+$/.test(id)||txids[id])throw Error('Missing or duplicate bank transaction ID');txids[id]=true;
    var result={transaction:id,payment:'',status:'REVIEW',amount:null};
    if(t.Currency!=='CZK'){result.status='CURRENCY_REVIEW';return result;}
    var cents;try{cents=rcCents_(t.Amount_CZK);}catch(_){result.status='INVALID_AMOUNT';return result;}
    result.amount=cents/100;if(cents<=0){result.status='DEBIT_OR_ZERO';return result;}
    var ref=rcReference_(t.VS),candidates=ref?refs[ref]||[]:[];
    if(!candidates.length){result.status='UNMATCHED';return result;}
    if(candidates.length!==1){result.status='AMBIGUOUS_REFERENCE';return result;}
    var p=candidates[0];result.payment=String(p.Payment_ID);
    if(/^(VERIFIED|PAID|SETTLED|CANCELLED|CANCELED|REJECTED|VOID)$/i.test(p.Verification_Status||'')){result.status='EXISTING_STATUS_REVIEW';return result;}
    var expected;try{expected=rcCents_(p.Expected_Amount_CZK!==''&&p.Expected_Amount_CZK!=null?p.Expected_Amount_CZK:p.Amount_CZK);}catch(_){result.status='INVALID_EXPECTED';return result;}
    if(expected<=0){result.status='INVALID_EXPECTED';return result;}
    result.status=cents===expected?'CANDIDATE_ONLY':cents<expected?'PARTIAL_REVIEW':'OVERPAYMENT_REVIEW';
    return result;
  });
  var counts=Object.create(null);plans.forEach(function(r){if(r.payment)counts[r.payment]=(counts[r.payment]||0)+1;});
  plans.forEach(function(r){if(r.payment&&counts[r.payment]>1)r.status='MULTIPLE_TRANSFERS_REVIEW';});
  return {mode:'READ_ONLY',entity:'DRUZINA',settled:0,rows:plans};
}
function paymentReconciliationPreview(){
  ocOwner_();var ss=SpreadsheetApp.openById(ocId_());
  var p=ocRows_(ss,'Druzina_Payments'),t=ocRows_(ss,'Druzina_Fio_Transactions');
  if(p.missing||t.missing)throw Error('Existing payment or bank import sheet missing');
  // Read only the verified NGO schema; OSVC Leads are not orders or payment records.
  var result=rcPlan_(p.rows.filter(function(r){return Object.keys(r).some(function(k){return r[k]!=='';});}),t.rows.filter(function(r){return Object.keys(r).some(function(k){return r[k]!=='';});}));
  result.bank=ocBankState_(PropertiesService.getScriptProperties(),'FIO_DRUZINA');
  result.total=result.rows.length;result.rows=result.rows.slice(0,100);result.truncated=result.total>100;
  return result;
}
