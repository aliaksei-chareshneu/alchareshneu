/* Druzina training evidence layer for the existing /register/ form.
 * Quote values come exclusively from imperion-register, never from client arithmetic.
 * A PDF is evidence of a transfer, not verified money in the association's bank.
 */
(function(){
  'use strict';
  const TXT={
    cs:{heading:'Cena tréninku a doklad o platbě',pending:'Cena skupiny se ještě ověřuje. Příklad pro 2 hodiny: 3 potvrzení = 440 Kč/os., 5 = 328 Kč/os., 10 = 244 Kč/os. K přihlášení méně než 48 hodin před začátkem se u nových potvrzených cen připočítává 25 %. Neposílejte zatím peníze; dříve domluvené ceny platí.',ready:'Ověřených účastníků: {n}. Základ: {base} Kč. Příplatek za méně než 48 h: {fee} Kč. Celkem: {total} Kč.',pay:'Příjemce: {recipient}. Účet: {account}. Platbu proveďte pouze po osobním písemném potvrzení termínu, místa a podmínek pořadatelem. Pak přiložte doklad PDF do stejného formuláře. Doklad není potvrzením připsání peněz.',label:'Doklad o bankovním převodu (PDF, max. 2 MB) *',help:'V PDF mohou být osobní údaje. Před nahráním skryjte nesouvisející transakce. Doklad uvidí jen oprávněný pořadatel.',changed:'Cena se mezitím změnila (nebo uplynula lhůta 48 h). Zkontrolujte aktualizovanou cenu a odešlete znovu.',receipt:'PDF doklad byl přijat ke kontrole. Platba ani účast zatím nejsou potvrzeny.',pricePending:'Cena skupiny čeká na potvrzení'},
    en:{heading:'Training price and payment evidence',pending:'The verified group rate is not locked yet. Two-hour examples: 3 confirmed people = CZK 440 each; 5 = 328; 10 = 244. New bookings under 48 hours before a session have a 25% surcharge after the final rate is locked. Do not pay yet. Existing agreed prices remain unchanged.',ready:'Confirmed group size: {n}. Base: CZK {base}. Under-48-hour surcharge: CZK {fee}. Total: CZK {total}.',pay:'Recipient: {recipient}. Account: {account}. Transfer funds only after the organiser personally confirms the date, venue and your terms in writing. Then upload the PDF receipt in this same form. A receipt does not prove bank settlement.',label:'Bank transfer receipt (PDF, max 2 MB) *',help:'Bank receipts can contain personal data. Redact unrelated transactions before uploading. Only authorised organisers can access the document.',changed:'The rate changed or the 48-hour deadline passed. Please check the updated total before resubmitting.',receipt:'Payment PDF received for review. Neither funds nor attendance have been verified.',pricePending:'Group rate awaits confirmation'},
    ru:{heading:'Стоимость тренировки и подтверждение платежа',pending:'Групповая цена ещё не зафиксирована. Примеры на 2 часа: 3 подтверждённых участника — 440 Kč, 5 — 328 Kč, 10 — 244 Kč. Для новых заявок менее чем за 48 часов добавляется 25% после фиксации цены. Пока ничего не переводите. Прежние согласованные цены сохраняются.',ready:'Подтверждено участников: {n}. Базовая цена: {base} Kč. Доплата за срок менее 48 часов: {fee} Kč. Итого: {total} Kč.',pay:'Получатель: {recipient}. Счёт: {account}. Переводите деньги только после личного письменного подтверждения даты, площадки и условий. Затем прикрепите PDF перевода в эту же форму. Документ ещё не подтверждает поступление денег.',label:'PDF подтверждения перевода (максимум 2 МБ) *',help:'На квитанции могут быть личные данные. Скройте посторонние операции перед загрузкой. Документ доступен только уполномоченным организаторам.',changed:'Цена изменилась или наступил срок менее 48 часов. Проверьте новую сумму и отправьте форму заново.',receipt:'PDF получен для проверки. Поступление денег и участие ещё не подтверждены.',pricePending:'Групповая цена ожидает подтверждения'},
    uk:{heading:'Вартість тренування і підтвердження оплати',pending:'Групова ціна ще не зафіксована. Приклади на 2 години: 3 підтверджених учасники — 440 Kč, 5 — 328 Kč, 10 — 244 Kč. Для нових заявок менш ніж за 48 годин додається 25% після фіксації ціни. Поки не платіть. Попередні узгоджені ціни зберігаються.',ready:'Підтверджено учасників: {n}. Базова ціна: {base} Kč. Доплата менш ніж за 48 годин: {fee} Kč. Разом: {total} Kč.',pay:'Одержувач: {recipient}. Рахунок: {account}. Платіть лише після особистого письмового підтвердження дати, місця і умов. Потім додайте PDF переказу в цій самій формі. Квитанція не підтверджує надходження коштів.',label:'PDF підтвердження переказу (до 2 МБ) *',help:'Квитанції можуть містити персональні дані. Приберіть зайві операції перед завантаженням. Документ доступний лише уповноваженим організаторам.',changed:'Ціна змінилася або настав термін менш ніж за 48 годин. Перевірте нову суму і надішліть форму повторно.',receipt:'PDF отримано на перевірку. Надходження коштів та участь ще не підтверджені.',pricePending:'Групова ціна очікує підтвердження'}
  };
  const $=id=>document.getElementById(id);
  let latestEvent=null,latestLang='cs',latestMode='PLANNED';
  function copy(){return TXT[latestLang]||TXT.cs;}
  function fmt(template,values){return template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));}
  function isPaymentRequired(event){return !!(event?.trainingPayment?.proofRequired&&event.trainingPayment.status==='PAYMENT_OPEN'&&document.querySelector('input[name=rsvp]:checked')?.value==='YES');}
  function render(event,lang,mode){
    latestEvent=event;latestLang=lang;latestMode=mode;
    const box=$('trainingPayment'),proof=$('paymentProof');
    if(!box||!proof)return;
    const q=event?.trainingPayment;box.hidden=!q||mode!=='FORM';
    if(box.hidden){proof.required=false;proof.value='';$('paymentProofField').hidden=true;return;}
    const d=copy();$('trainingPaymentHeading').textContent=d.heading;
    if(q.status==='PAYMENT_OPEN'){
      $('trainingPaymentAmount').textContent=fmt(d.ready,{n:q.confirmedCount,base:q.baseCzk,fee:q.surchargeCzk,total:q.totalCzk});
      $('trainingPaymentInstructions').textContent=fmt(d.pay,{recipient:q.recipient,account:q.account});
    }else{
      $('trainingPaymentAmount').textContent=d.pending;
      $('trainingPaymentInstructions').textContent='';
    }
    const needed=isPaymentRequired(event);
    $('paymentProofField').hidden=!needed;
    proof.required=needed;
    if(!needed)proof.value='';
    $('paymentProofLabel').textContent=d.label;
    $('paymentProofHelp').textContent=d.help;
  }
  function catalogPrice(event,lang){
    const q=event?.trainingPayment;
    if(!q)return null;
    const d=TXT[lang]||TXT.cs;
    return q.status==='PAYMENT_OPEN'?String(q.totalCzk)+' Kč (group quote; surcharge included)':d.pricePending;
  }
  function requestOptions(event,body){
    if(!isPaymentRequired(event))return {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    const q=event.trainingPayment,proof=$('paymentProof').files?.[0];
    if(!proof||proof.size<100||proof.size>2*1024*1024||!proof.name.toLowerCase().endsWith('.pdf'))throw Error('invalid_pdf');
    const data=new FormData();
    data.append('payload',JSON.stringify({...body,quotedTotalCzk:q.totalCzk,
      quoteLockedAt:q.quoteLockedAt,quotedConfirmedCount:q.confirmedCount}));
    data.append('paymentProof',proof,proof.name);
    return {body:data};
  }
  function changedMessage(lang){return (TXT[lang]||TXT.cs).changed;}
  function receiptMessage(lang){return (TXT[lang]||TXT.cs).receipt;}
  document.querySelectorAll('input[name=rsvp]').forEach(el=>el.addEventListener('change',()=>render(latestEvent,latestLang,latestMode)));
  window.ImperionTrainingPayment={render,catalogPrice,requestOptions,changedMessage,receiptMessage};
})();
