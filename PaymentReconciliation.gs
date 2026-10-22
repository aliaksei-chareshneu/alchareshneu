/** Read-only reconciliation over existing NGO payment/import sheets. No settlement. */
function rcCents_(value) {
  if(value===null||value===undefined)throw Error('Missing amount');
  if(typeof value!=='number'&&typeof value!=='string')throw Error('Invalid amount');
  var text=String(value).trim();if(!text)throw Error('Missing amount');
  function parse(text){
    var m=/^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
    return m?Number(m[1]+m[2]+((m[3]||'')+'00').slice(0,2)):NaN;
  }
  // Parse decimal digits directly; binary rounding must not hide sub-cent input.
  var c=parse(text);
  if(!Number.isSafeInteger(c)||parse(String(c/100))!==c)throw Error('Invalid amount');
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
    if(/^(VERIFIED|PAID|SETTLED|CANCELLED|CANCELED|REJECTED|VOID)$/i.test(String(p.Verification_Status||'').trim())){result.status='EXISTING_STATUS_REVIEW';return result;}
    var expected;try{expected=rcCents_(p.Expected_Amount_CZK!==''&&p.Expected_Amount_CZK!=null?p.Expected_Amount_CZK:p.Amount_CZK);}catch(_){result.status='INVALID_EXPECTED';return result;}
    if(expected<=0){result.status='INVALID_EXPECTED';return result;}
    result.status=cents===expected?'CANDIDATE_ONLY':cents<expected?'PARTIAL_REVIEW':'OVERPAYMENT_REVIEW';
    return result;
  });
  var counts=Object.create(null);plans.forEach(function(r){if(r.payment)counts[r.payment]=(counts[r.payment]||0)+1;});
  plans.forEach(function(r){if(r.payment&&counts[r.payment]>1)r.status='MULTIPLE_TRANSFERS_REVIEW';});
  return {mode:'READ_ONLY',entity:'DRUZINA',settled:0,rows:plans};
}
function rcPreviewQueue_(rows){
  if(!Array.isArray(rows))throw Error('Payment preview rows unavailable');
  var groups={CANDIDATE_ONLY:'candidates',REVIEW:'review',CURRENCY_REVIEW:'review',INVALID_AMOUNT:'review',AMBIGUOUS_REFERENCE:'review',EXISTING_STATUS_REVIEW:'review',INVALID_EXPECTED:'review',PARTIAL_REVIEW:'review',OVERPAYMENT_REVIEW:'review',MULTIPLE_TRANSFERS_REVIEW:'review',UNMATCHED:'unmatched',DEBIT_OR_ZERO:'excluded'};
  var rank={candidates:0,review:1,unmatched:2,excluded:3};
  var queue={total:rows.length,candidates:0,review:0,unmatched:0,excluded:0,shown:Math.min(rows.length,100),limit:100,truncated:rows.length>100};
  var ordered=rows.map(function(row,index){
    if(!row||!Object.prototype.hasOwnProperty.call(groups,row.status))throw Error('Unknown payment preview status');
    var group=groups[row.status];queue[group]++;
    return {row:row,index:index,rank:rank[group]};
  });
  ordered.sort(function(a,b){return a.rank-b.rank||a.index-b.index;});
  return {rows:ordered.slice(0,queue.limit).map(function(entry){return entry.row;}),queue:queue};
}
function paymentReconciliationPreview(){
  ocOwner_();var ss=SpreadsheetApp.openById(ocId_());
  var p=ocRows_(ss,'Druzina_Payments'),t=ocRows_(ss,'Druzina_Fio_Transactions');
  if(p.missing||t.missing)throw Error('Existing payment or bank import sheet missing');
  rcRequireHeaders_(p.headers,['Payment_ID','Payment_Reference','Amount_CZK','Verification_Status']);
  rcRequireHeaders_(t.headers,['Bank_Transaction_ID','VS','Amount_CZK','Currency']);
  // Read only the verified NGO schema; OSVC Leads are not orders or payment records.
  var result=rcPlan_(p.rows.filter(function(r){return Object.keys(r).some(function(k){return r[k]!=='';});}),t.rows.filter(function(r){return Object.keys(r).some(function(k){return r[k]!=='';});}));
  result.bank=ocBankState_(PropertiesService.getScriptProperties(),'FIO_DRUZINA');
  var preview=rcPreviewQueue_(result.rows);
  result.rows=preview.rows;result.queue=preview.queue;result.total=preview.queue.total;result.truncated=preview.queue.truncated;
  result.checkedAt=new Date().toISOString();
  return result;
}

function rcRequireHeaders_(actual,required){
  if(!Array.isArray(actual))throw Error('Payment schema unavailable');
  required.forEach(function(name){if(actual.filter(function(h){return h===name;}).length!==1)throw Error('Missing or duplicate required column: '+name);});
}

