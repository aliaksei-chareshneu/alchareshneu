/* Fio account-watch JSON -> Družina incoming-bank-credit matching.
 * Adapted from existing staged DruzinaFioBridge.gs (PR #197).
 * PURE; bank data is untrusted until fetched by the protected server.
 * Never confirm a booking or mark a PDF as a bank transaction.
 */
const MAX_TRANSACTIONS=2000;
const MONEY_LIMIT=999999900; // integer halers; no exponential notation / silent rounding
function value(column){
  return column && typeof column==='object' && Object.hasOwn(column,'value') ? column.value : column;
}
export function moneyHalers(amount){
  const str=String(amount??'').trim();
  if(!/^[+-]?\d{1,8}(?:\.\d{1,2})?$/.test(str))return null;
  const negative=str.startsWith('-'),s=str.replace(/^[+-]/,'');
  const [whole,frac='']=s.split('.');
  const result=Number(whole)*100+Number(frac.padEnd(2,'0'));
  return Number.isSafeInteger(result)&&result<=MONEY_LIMIT?(negative?-result:result):null;
}
export function variableSymbol(v){
  const s=String(v??'').trim();
  if(!/^\d{1,10}$/.test(s))return null;
  // Fio may return an unsigned integer for VS, never a decimal/scientific string.
  return s.replace(/^0+(?=\d)/,'');
}
function isoDate(v){
  if(typeof v==='number' && Number.isFinite(v)&&v>100000000000){
    const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;
  }
  if(typeof v!=='string'||! /^\d{4}-\d\d-\d\d(?:[T +].*)?$/.test(v))return null;
  const d=new Date(v.slice(0,10)+'T12:00:00.000Z'); // Fio day, no invented settlement hour
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v.slice(0,10)
    ? d.toISOString():null;
}
function cleanIban(v){return typeof v==='string'?v.replace(/\s/g,'').toUpperCase():'';}
export function parseFioStatement(json,expected){
  if(!json || typeof json!=='object' || !expected ||
     !json.accountStatement?.info)throw Error('FIO_BAD_FORMAT');
  const root=json.accountStatement,info=root.info;
  if(cleanIban(info.iban)!==cleanIban(expected.iban)||
     !/^CZ\d{22}$/.test(cleanIban(expected.iban))||
     String(info.bankId)!==String(expected.bankId)||
     String(info.accountId)!==String(expected.accountId)||
     String(info.currency)!=='CZK')throw Error('FIO_WRONG_RECEIVER');
  let txs=root.transactionList?.transaction??[];
  if(!Array.isArray(txs))txs=[txs];
  if(txs.length>MAX_TRANSACTIONS)throw Error('FIO_BATCH_TOO_LARGE');
  const byId=new Map();
  for(const t of txs){
    const id=String(value(t?.column22)??'').trim();
    if(!/^\d{6,18}$/.test(id))continue;
    const amount=moneyHalers(value(t.column1)),vs=variableSymbol(value(t.column5));
    const currency=String(value(t.column14)??'').trim(),
      kind=String(value(t.column8)??'').trim().toLowerCase(),
      movementAt=isoDate(value(t.column0));
    const row={movementId:id,amountHalers:amount,vs,currency,
      movementAt,blocked:amount===null||amount<=0||currency!=='CZK'||
       !movementAt||/opravn|storno|refund|reversal|vratk/.test(kind)};
    if(byId.has(id)){
      if(JSON.stringify(byId.get(id))!==JSON.stringify(row))
        throw Error('FIO_CONFLICTING_MOVEMENT');
      continue;
    }
    byId.set(id,row);
  }
  return [...byId.values()];
}
/* Fail closed: 0 or >1 movements for a VS, amounts/currencies inconsistent,
 * duplicate quotes/transactions, reversals -> never auto-apply.
 * The DB RPC makes the final update atomic and replay-resistant. */
export function planExactCredits(movements,pending){
  if(!Array.isArray(movements)||!Array.isArray(pending))throw Error('BAD_INPUT');
  const grouped=new Map(),quotes=new Map(),matches=[],manual=[];
  for(const m of movements){
    if(m.vs)grouped.set(m.vs,[...(grouped.get(m.vs)||[]),m]);
  }
  for(const q of pending){
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(q.id||'')||
       !/^[1-9]\d{9}$/.test(q.payment_variable_symbol||'')||
       !Number.isSafeInteger(q.quoted_total_czk)||q.quoted_total_czk<=0)
      {manual.push({id:q.id||null,reason:'INVALID_QUOTE'});continue;}
    const vs=variableSymbol(q.payment_variable_symbol);
    quotes.set(vs,(quotes.get(vs)||0)+1);
  }
  for(const q of pending){
    const vs=variableSymbol(q.payment_variable_symbol);
    if(!vs || !/^[1-9]\d{9}$/.test(q.payment_variable_symbol||'') ||
       (quotes.get(vs)||0)!==1)continue;
    const txs=grouped.get(vs)||[];
    if(!txs.length)continue;
    if(txs.length!==1){manual.push({id:q.id,reason:'AMBIGUOUS_VS'});continue;}
    const tx=txs[0];
    if(tx.blocked){manual.push({id:q.id,reason:'INVALID_CREDIT'});continue;}
    if(tx.amountHalers!==q.quoted_total_czk*100)
      {manual.push({id:q.id,reason:'AMOUNT_MISMATCH'});continue;}
    const created=Date.parse(q.created_at||'');
    const settled=Date.parse(tx.movementAt||'');
    if(!Number.isFinite(created)||!Number.isFinite(settled)||
       new Date(settled).toISOString().slice(0,10)<new Date(created).toISOString().slice(0,10) ||
       settled > Date.now()+86400000){
      manual.push({id:q.id,reason:'CREDIT_DATE_MISMATCH'});continue;
    }
    matches.push({
      id:q.id,variableSymbol:q.payment_variable_symbol,
      movementId:tx.movementId,amountCzk:q.quoted_total_czk,
      movementAt:tx.movementAt
    });
  }
  return {matches,manual,unmatched:movements.filter(m=>m.vs&&!quotes.has(m.vs)).length};
}