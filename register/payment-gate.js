/* Proof upload and package submission client. The bank, never this JS, authorizes payment. */
(function(){
'use strict';
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-payment-proof';
const copy={
 cs:{title:'Ověření úhrady',help:'Placená akce: bez dokladu nebo ověřeného balíčku žádost neodešlete.',
  receipt:'Doklad o platbě',package:'Již zaplacený balíček',
  file:'Nahrát doklad (PDF/JPG/PNG/WEBP, max. 4 MB)',amount:'Uhrazená částka (Kč)',
  date:'Datum platby (volitelné)',ref:'Reference platby (volitelné)',
  code:'Kód ověřeného balíčku',codeHelp:'Pouze předem ověřené balíčky. Místo se neodečte jako návštěva, dokud organizátor nepotvrdí účast.',
  alert:'Nahrání dokladu ≠ ověřená platba. Ověření proběhne proti bankovním údajům. Pro soukromí skryjte jiné transakce, zůstatek a nepotřebné údaje.',
  pending:'Doklad jsme přijali, ale platbu ještě neověřili. Místo zatím není potvrzené.',
  balance:'Balíček: využito {used}, rezervováno {reserved}, zbývá {available}.',
  error:'Doklad nelze ověřit. Zkontrolujte částku a soubor nebo kontaktujte pořadatele.'},
 en:{title:'Payment check',help:'Paid event: attach payment evidence or use a previously bank-verified pass before submitting.',
  receipt:'Payment receipt',package:'Verified multi-visit pass',
  file:'Attach evidence (PDF/JPG/PNG/WEBP, max 4 MB)',amount:'Amount paid (CZK)',
  date:'Payment date (optional)',ref:'Payment reference (optional)',
  code:'Verified pass code',codeHelp:'Only passes already verified against the bank. A visit is consumed only after the organiser confirms attendance.',
  alert:'Uploading a receipt does NOT verify payment. We must reconcile it against bank records. Crop unrelated transactions, balances and personal details.',
  pending:'We received your evidence, but payment is not bank-verified. Your place is not confirmed.',
  balance:'Pass: consumed {used}, reserved {reserved}, available {available}.',
  error:'We could not check the evidence. Check the amount/file or contact the organiser.'},
 ru:{title:'Проверка оплаты',help:'Платное событие: для отправки требуется подтверждение перевода или ранее проверенный абонемент.',
  receipt:'Квитанция',package:'Оплаченный абонемент',
  file:'Прикрепить документ (PDF/JPG/PNG/WEBP, до 4 МБ)',amount:'Сумма платежа (Kč)',
  date:'Дата оплаты (необязательно)',ref:'Назначение / номер платежа (необязательно)',
  code:'Код проверенного абонемента',codeHelp:'Только абонемент, уже сверенный с банком. Посещение списывается после подтверждения фактического участия.',
  alert:'Загрузка чека НЕ означает, что деньги получены. Сверяем поступление с банком. Скройте посторонние операции, остатки и лишние личные данные.',
  pending:'Документ получен. Банковское поступление ещё не подтверждено, место не забронировано.',
  balance:'Абонемент: посещений {used}, зарезервировано {reserved}, осталось {available}.',
  error:'Не удалось проверить документ. Проверьте сумму, файл или свяжитесь с организатором.'},
 uk:{title:'Перевірка оплати',help:'Платна подія: додайте підтвердження оплати або раніше перевірений абонемент.',
  receipt:'Квитанція',package:'Оплачений абонемент',
  file:'Прикріпити документ (PDF/JPG/PNG/WEBP, до 4 МБ)',amount:'Сума оплати (Kč)',
  date:'Дата оплати (необов’язково)',ref:'Призначення / номер платежу (необов’язково)',
  code:'Код перевіреного абонемента',codeHelp:'Лише абонементи, звірені з банком. Відвідування списується після підтвердження участі.',
  alert:'Завантаження квитанції НЕ підтверджує надходження грошей. Приховайте сторонні операції та зайві персональні дані.',
  pending:'Документ отримано, але надходження грошей ще не перевірено. Місце не підтверджено.',
  balance:'Абонемент: використано {used}, зарезервовано {reserved}, доступно {available}.',
  error:'Не вдалося перевірити документ. Перевірте суму й файл або зверніться до організатора.'}
};
const id=k=>document.getElementById(k);
let activeEventId=null;
function langCopy(locale){return copy[locale]||copy.en}
function toggleMode(){
 const usingPass=id('paymentModePackage').checked;
 id('paymentReceiptFields').hidden=usingPass;
 id('paymentPackageFields').hidden=!usingPass;
 id('paymentProof').required=!usingPass&&!id('paymentGate').hidden;
 id('paymentAmount').required=!usingPass&&!id('paymentGate').hidden;
 id('packageCode').required=usingPass&&!id('paymentGate').hidden;
}
function update(event,mode,locale){
 const paid=Boolean(event&&mode==='FORM'&&event.price_verified===true&&Number(event.price_czk)>0);
 id('paymentGate').hidden=!paid;
 if(paid){
  if(activeEventId!==event.event_id){
   id('paymentProof').value='';id('paymentReference').value='';
   id('paymentDate').value='';id('packageCode').value='';
   id('paymentModeReceipt').checked=true;
   activeEventId=event.event_id;
  }
  id('paymentAmount').value=String(event.price_czk);
 }
 const lang=langCopy(locale);
 document.querySelectorAll('[data-payment-text]').forEach(el=>{
  el.textContent=lang[el.dataset.paymentText]||'';
 });
 document.querySelectorAll('input[name="rsvp"]').forEach(r=>{
  r.disabled=paid&&r.value!=='YES';
  if(paid&&r.value==='YES')r.checked=true;
 });
 toggleMode();
}
async function prepare(body,event,locale){
 if(!event||Number(event.price_czk)<=0)return;
 if(id('paymentGate').hidden)throw Error('payment_proof_required');
 if(id('paymentModePackage').checked){
  const code=id('packageCode').value.trim();
  if(!/^[A-Za-z0-9]{16,64}$/.test(code))throw Error('invalid_or_exhausted_package');
  body.packageCode=code;
  return;
 }
 const proof=id('paymentProof').files?.[0];
 if(!proof||proof.size<1024||proof.size>4194304||
  !['application/pdf','image/png','image/jpeg','image/webp'].includes(proof.type))
  throw Error('invalid_upload');
 const amount=Number(id('paymentAmount').value);
 if(!Number.isSafeInteger(amount)||amount!==Number(event.price_czk))
  throw Error('amount_does_not_match_event_price');
 const form=new FormData();
 form.set('eventId',body.eventId);form.set('email',body.email);
 form.set('declaredAmountCzk',String(amount));
 form.set('paymentReference',id('paymentReference').value.trim());
 form.set('transactionDate',id('paymentDate').value);
 form.set('proof',proof,proof.name);
 const response=await fetch(ENDPOINT,{method:'POST',body:form,
  cache:'no-store',signal:AbortSignal.timeout(25000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok||!data.evidenceId)
  throw Error(data.error||'upload_failed');
 body.paymentEvidenceId=data.evidenceId;
}
function receipt(payload,locale){
 const result=id('result');
 if(!result||!payload)return;
 if(payload.paymentGate==='PROOF_PENDING'){
  const p=document.createElement('p');p.className='payment-alert';
  p.textContent=langCopy(locale).pending;result.append(p);
 }else if(payload.packageBalance){
  const p=document.createElement('p');p.className='payment-alert';
  const b=payload.packageBalance;
  p.textContent=langCopy(locale).balance.replace('{used}',String(b.consumed||0))
   .replace('{reserved}',String(b.reserved||0)).replace('{available}',String(b.available||0));
  result.append(p);
 }
}
function errorText(err,locale){
 const code=String(err?.message||'');
 const t=langCopy(locale);
 if(code==='amount_does_not_match_event_price')return t.amount+': '+t.error;
 if(['invalid_upload','invalid_file_signature','payment_proof_required',
   'upload_failed','proof_already_used','payment_proof_already_used',
   'invalid_or_exhausted_package','duplicate_or_reused_proof'].includes(code))
  return t.error;
 return null;
}
function reset(){activeEventId=null;id('paymentProof').value='';id('packageCode').value='';}
id('paymentModeReceipt')?.addEventListener('change',toggleMode);
id('paymentModePackage')?.addEventListener('change',toggleMode);
window.ImperionPayment={update,prepare,receipt,errorText,reset};
})();
