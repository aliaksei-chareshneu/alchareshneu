/* Current approved 9 November individual tariffs; NEVER trust browser price as authoritative.
 * One-time code ties PDF evidence to existing RSVP, not a new participant or proof of paid status.
 */
(function(){
'use strict';
const TXT={"cs":{"heading":"Cena tréninku a doklad o platbě","standard":"První / běžná lekce — 240 Kč","senior":"Senior (ověřený nárok) — 120 Kč","starter":"Starter 4 (4 lekce / 30 dní) — 800 Kč","pending":"Orientační výpočet. Termín, podmínky, platbu a oprávnění Senior/Starter musí organizátor nejprve písemně potvrdit. Zatím neplaťte.","ready":"Základ {base} Kč + příplatek do 48 h {fee} Kč = celkem {total} Kč. Cena je vypočítána podle aktuálního tarifu {version}.","latePass":"Balíček Starter 4 nelze použít pro přihlášení méně než 48 hodin před touto lekcí. Zvolte jednorázovou lekci nebo požádejte o budoucí termín.","review":"Senior a Starter 4 vyžadují osobní ověření nároku; výběr tarifu v tomto formuláři neznamená jeho schválení.","pay":"Příjemce: {recipient}. Účet: {account}. Převod proveďte až po individuálním písemném potvrzení termínu, bezpečných podmínek a tarifu; pak doložte PDF ve stejném formuláři.","label":"Potvrzení bankovního převodu (PDF do 2 MB) *","help":"Zakryjte nesouvisející transakce; nahrání PDF neprokazuje připsání platby a nepotvrzuje účast.","resumeLabel":"Kód stávající přihlášky (pouze pro doložení platby)","resumeHelp":"Nový účastník nejprve odešle přihlášku bez kódu a uloží si jednorázový kód. Po písemném potvrzení a převodu se vrátí do stejného formuláře a nahraje PDF.","resumeReceipt":"Uschovejte si tento jednorázový kód. K doložení platby použijte stejný formulář; přihláška není rezervace.","receipt":"PDF bylo přijato ke kontrole. Připsání peněz ani účast nebyly ověřeny.","changed":"Cena nebo 48hodinové okno se změnily; obnovte nabídku a zkontrolujte částku.","eligibility":"Tento tarif ještě nebyl organizátorem ověřen, nebo se liší od původní přihlášky. Neposílejte další peníze a vyžádejte si potvrzení.","pricePending":"240 Kč základ; pozdní přihláška 300 Kč (pouze orientačně)"},"en":{"heading":"Training price and transfer receipt","standard":"First / standard session — CZK 240","senior":"Senior (verified eligibility) — CZK 120","starter":"Starter 4 (4 sessions / 30 days) — CZK 800","pending":"Indicative calculation only. The organiser must first confirm the session, safety, payment instructions and Senior/Starter eligibility in writing. Do not pay yet.","ready":"Base CZK {base} + under-48-hour surcharge CZK {fee} = total CZK {total}. Calculated under tariff {version}.","latePass":"Starter 4 cannot cover a booking made under 48 hours before this session. Choose a single session or enquire about a future date.","review":"Senior and Starter 4 require verified eligibility. Choosing a tier here is not approval.","pay":"Recipient: {recipient}. Account: {account}. Transfer only after individual written confirmation of date, safety and tariff. Then upload the PDF in this same form.","label":"Bank transfer receipt (PDF, max 2 MB) *","help":"Redact unrelated transactions. A PDF does not prove cleared funds or confirmed attendance.","resumeLabel":"Existing application code (for payment evidence only)","resumeHelp":"New attendee? Submit the form once without a code and save the one-time code. After written confirmation and transfer, return to the same form and upload the PDF.","resumeReceipt":"Save this one-time code. Use the same registration form for payment evidence; no seat is confirmed yet.","receipt":"PDF received for review. Neither cleared funds nor attendance have been verified.","changed":"The rate or 48-hour window changed. Refresh the quote and check the total.","eligibility":"The selected tier has not been verified by the organiser or differs from the original application. Do not send more money; seek written confirmation.","pricePending":"CZK 240 base; CZK 300 late (indicative only)"},"ru":{"heading":"Стоимость занятия и PDF подтверждения перевода","standard":"Первая / обычная тренировка — 240 Kč","senior":"Senior (после проверки права) — 120 Kč","starter":"Starter 4 (4 занятия / 30 дней) — 800 Kč","pending":"Это предварительный расчёт. Организатор должен письменно подтвердить занятие, безопасность, реквизиты и право на Senior/Starter. Пока не переводите деньги.","ready":"Базовая цена {base} Kč + доплата за срок менее 48 ч {fee} Kč = {total} Kč. Версия тарифов {version}.","latePass":"Starter 4 нельзя использовать для записи менее чем за 48 часов до этого занятия. Выберите разовую тренировку либо будущую дату.","review":"Senior и Starter 4 требуют индивидуальной проверки права на тариф. Выбор в форме ещё не означает одобрение.","pay":"Получатель: {recipient}. Счёт: {account}. Переводите только после личного письменного подтверждения даты, безопасности и тарифа. Затем загрузите PDF в эту же форму.","label":"Подтверждение банковского перевода (PDF до 2 МБ) *","help":"Скройте посторонние операции. PDF не доказывает поступление денег и не подтверждает участие.","resumeLabel":"Код существующей заявки (для загрузки PDF)","resumeHelp":"Первую заявку отправьте без кода и сохраните одноразовый код. После письменного подтверждения и перевода вернитесь в эту же форму, введите код и приложите PDF.","resumeReceipt":"Сохраните этот одноразовый код. Для подтверждения платежа используйте ту же форму; место пока не забронировано.","receipt":"PDF получен на проверку. Поступление денег и участие ещё не подтверждены.","changed":"Цена или 48-часовой период изменились. Обновите расчёт и проверьте сумму.","eligibility":"Выбранный тариф ещё не проверен организатором либо отличается от прежней заявки. Не переводите дополнительные деньги; запросите письменное подтверждение.","pricePending":"Базовая цена 240 Kč; поздняя запись 300 Kč (предварительно)"},"uk":{"heading":"Вартість тренування та PDF підтвердження переказу","standard":"Перше / звичайне тренування — 240 Kč","senior":"Senior (після перевірки права) — 120 Kč","starter":"Starter 4 (4 заняття / 30 днів) — 800 Kč","pending":"Це попередній розрахунок. Організатор має письмово підтвердити тренування, безпеку, реквізити та право на Senior/Starter. Поки не платіть.","ready":"Базова ціна {base} Kč + доплата менш ніж за 48 год {fee} Kč = {total} Kč. Версія тарифів {version}.","latePass":"Starter 4 не можна використати для реєстрації менш ніж за 48 годин до цього заняття. Оберіть разове тренування або майбутню дату.","review":"Senior та Starter 4 потребують особистої перевірки права на тариф. Вибір у формі ще не є підтвердженням.","pay":"Одержувач: {recipient}. Рахунок: {account}. Сплачуйте лише після особистого письмового підтвердження дати, безпеки й тарифу. Потім завантажте PDF у цій самій формі.","label":"Підтвердження банківського переказу (PDF до 2 МБ) *","help":"Приховайте сторонні операції. PDF не доводить надходження коштів та не підтверджує участь.","resumeLabel":"Код наявної заявки (для PDF)","resumeHelp":"Нову заявку надішліть без коду та збережіть одноразовий код. Після письмового підтвердження й переказу поверніться до цієї самої форми, введіть код і додайте PDF.","resumeReceipt":"Збережіть одноразовий код. Для підтвердження переказу використовуйте ту саму форму; місце ще не заброньовано.","receipt":"PDF отримано для перевірки. Надходження коштів та участь ще не підтверджені.","changed":"Ціна або 48-годинний термін змінилися. Оновіть розрахунок і перевірте суму.","eligibility":"Обраний тариф ще не перевірено організатором або він відрізняється від попередньої заявки. Не платіть додатково; отримайте письмове підтвердження.","pricePending":"Базова ціна 240 Kč; пізня реєстрація 300 Kč (орієнтовно)"}};
const $=id=>document.getElementById(id);
let latestEvent=null,latestLang='cs',latestMode='PLANNED';
function copy(){return TXT[latestLang]||TXT.cs}
function fmt(template,values){return template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''))}
function tier(){return $('trainingTier')?.value||'STANDARD'}
function quote(event){
  const q=event?.trainingPayment,selected=tier(),rate=q?.rates?.[selected];
  if(!q||!rate)return null;
  return {...q,tier:selected,...rate,
    status:q.status==='PAYMENT_OPEN'&&rate.available?'PAYMENT_OPEN':
      q.status==='PAYMENT_OPEN'?'TIER_UNAVAILABLE':q.status,
    proofRequired:q.status==='PAYMENT_OPEN'&&rate.available,
    totalCzk:q.status==='PAYMENT_OPEN'&&rate.available?rate.totalCzk:null};
}
function isPaymentRequired(event){
  return !!(quote(event)?.proofRequired&&document.querySelector('input[name=rsvp]:checked')?.value==='YES'
  &&$('paymentResumeToken')?.value?.trim());
}
function render(event,lang,mode){
 latestEvent=event;latestLang=lang;latestMode=mode;
 const box=$('trainingPayment'),proof=$('paymentProof'),resume=$('paymentResumeToken'),selector=$('trainingTier');
 if(!box||!proof||!resume||!selector)return;
 const q=event?.trainingPayment;box.hidden=!q||mode!=='FORM';
 if(box.hidden){proof.required=false;proof.value='';resume.value='';selector.value='STANDARD';
   $('paymentResumeField').hidden=true;$('paymentProofField').hidden=true;return}
 const d=copy();
 $('trainingPaymentHeading').textContent=d.heading;
 for(const [name,label] of [['STANDARD',d.standard],['SENIOR',d.senior],['STARTER4',d.starter]]){
   const opt=selector.querySelector('option[value="'+name+'"]');if(opt)opt.textContent=label;
 }
 const selected=quote(event);
 const payReady=selected?.status==='PAYMENT_OPEN';
 $('trainingPaymentAmount').textContent=selected?.available?
   fmt(d.ready,{base:selected.baseCzk,fee:selected.surchargeCzk,
     total:selected.baseCzk+selected.surchargeCzk,version:selected.tariffVersion})
   :d.latePass;
 const advisory=$('trainingPaymentAdvisory');
 advisory.textContent=(payReady?'':d.pending)+(selected?.eligibilityReviewRequired?' '+d.review:'');
 $('trainingPaymentInstructions').textContent=payReady?
   fmt(d.pay,{recipient:selected.recipient,account:selected.account}):'';
 $('paymentResumeField').hidden=!payReady;
 if(!payReady)resume.value='';
 const needed=isPaymentRequired(event);
 $('paymentProofField').hidden=!needed;proof.required=needed;
 if(!needed)proof.value='';
 $('paymentResumeLabel').textContent=d.resumeLabel;$('paymentResumeHelp').textContent=d.resumeHelp;
 $('paymentProofLabel').textContent=d.label;$('paymentProofHelp').textContent=d.help;
}
function catalogPrice(event,lang){
 const q=event?.trainingPayment;if(!q)return null;
 const standard=q.rates?.STANDARD;const t=TXT[lang]||TXT.cs;
 return standard?(standard.baseCzk+standard.surchargeCzk)+' Kč (standard; Senior / Starter by approval)':t.pricePending;
}
function requestOptions(event,body){
 const q=event?.trainingPayment;
 if(q)body.trainingTier=tier();
 if(!isPaymentRequired(event))return {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
 const selected=quote(event),file=$('paymentProof').files?.[0];
 if(!selected||!file||file.size<100||file.size>2*1024*1024||!file.name.toLowerCase().endsWith('.pdf'))
   throw Error('invalid_pdf');
 const data=new FormData();
 data.append('payload',JSON.stringify({...body,paymentResumeToken:$('paymentResumeToken').value.trim(),
   quotedTotalCzk:selected.totalCzk,quoteLockedAt:selected.quoteLockedAt,
   quotedTier:tier(),tariffVersion:selected.tariffVersion}));
 data.append('paymentProof',file,file.name);
 return {body:data};
}
function changedMessage(lang){return (TXT[lang]||TXT.cs).changed}
function receiptMessage(lang){return (TXT[lang]||TXT.cs).receipt}
function resumeMessage(lang){return (TXT[lang]||TXT.cs).resumeReceipt}
function eligibilityMessage(lang){return (TXT[lang]||TXT.cs).eligibility}
document.querySelectorAll('input[name=rsvp]').forEach(el=>el.addEventListener('change',
 ()=>render(latestEvent,latestLang,latestMode)));
$('trainingTier')?.addEventListener('change',()=>render(latestEvent,latestLang,latestMode));
$('paymentResumeToken')?.addEventListener('input',()=>render(latestEvent,latestLang,latestMode));
window.ImperionTrainingPayment={render,catalogPrice,requestOptions,changedMessage,receiptMessage,
  resumeMessage,eligibilityMessage};
})();