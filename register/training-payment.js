/* Current 9 November 2026 Druzina individual tariffs.
 * Sole registration form: intake -> individually approved private quote -> PDF.
 * No cash is marked paid until a separate bank readback.
 */
(function(){
  'use strict';
  const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
  const PRICE_NAMES={STANDARD:{cs:'První / standardní',en:'First / standard',ru:'Первое / обычное',uk:'Перше / звичайне'},SENIOR:{cs:'Senior (po ověření)',en:'Senior (verified only)',ru:'Senior (после проверки)',uk:'Senior (після перевірки)'},STARTER4:{cs:'Starter 4 (4 tréninky)',en:'Starter 4 (4 sessions)',ru:'Starter 4 (4 занятия)',uk:'Starter 4 (4 заняття)'}};
  const T={
    cs:{heading:'Cena a doklad o platbě tréninku',choose:'Požadovaný tarif',intro:'Základní cena za 2 h: první návštěva 240 Kč, ověřený Senior 120 Kč; Starter 4 = 800 Kč za čtyři tréninky / 30 dnů. Po prvním zaplaceném a absolvovaném tréninku lze do 48 hodin doplatit 560 Kč na Starter 4. Toto navýšení balíčku vyžaduje zvláštní ověření.',late:'Nová žádost méně než 48 h před začátkem: jednorázový příplatek 25 %.',notReady:'Platba není otevřena. Zašlete nezávaznou žádost. Neplaťte ani necestujte bez osobního písemného potvrzení.',ready:'Příjemce a účet zobrazíme až po potvrzení účasti a kontrole vašeho osobního kódu.',codeLabel:'Osobní kód předchozí žádosti (jen pro již podané žádosti)',codeHelp:'Noví zájemci ponechají prázdné a odešlou první žádost. Uschovejte si jednorázový kód, který získáte.',check:'Ověřit schválenou částku a účet',checking:'Ověřuji…',checkFirst:'Nejdříve ověřte svou cenu a platební údaje.',approved:'Individuálně schválený tarif: {tier}. Základ {base} Kč + příplatek {fee} Kč = CELKEM {total} Kč. Příjemce: {recipient}. Účet: {account}. Peníze odešlete pouze po písemném potvrzení organizátorem.',pdf:'PDF potvrzení bankovního převodu (max. 2 MB) *',pdfHelp:'Před odesláním skryjte nesouvisející transakce. PDF je jen důkaz převodu ke kontrole, nikoli potvrzení připsání peněz.',pending:'Neplatný kód, nezaúčtovaná osobní nabídka nebo uzavřený termín; organizátor musí nejprve potvrdit účast.',changed:'Cena či 48hodinová hranice se změnila. Ověřte částku znovu.',receipt:'PDF přijato ke kontrole. Platba ani účast zatím nejsou potvrzeny.',codeReceipt:'Uložte tento soukromý jednorázový kód. Po písemném potvrzení organizátorem jej zadejte do stejného formuláře a ověřte nabídku. Kód není potvrzení místa.'},
    en:{heading:'Training price and bank transfer PDF',choose:'Requested training tariff',intro:'Two-hour base prices: first visit CZK 240, verified Senior CZK 120; Starter 4 is CZK 800 for four sessions within 30 days. After your first paid and attended session, a verified upgrade within 48 hours costs another CZK 560.',late:'New bookings less than 48 hours before the session carry a 25% surcharge.',notReady:'Payments are closed. Submit an enquiry. Do not pay or travel before individual written confirmation.',ready:'Recipient and bank account appear only after individual approval and private-code verification.',codeLabel:'Private code from an earlier request (existing applicants only)',codeHelp:'New applicants leave this blank and submit the form first. Save the one-time code you receive.',check:'Check approved total and bank account',checking:'Checking…',checkFirst:'Check your approved quote and bank account first.',approved:'Individually approved rate: {tier}. Base CZK {base} + surcharge CZK {fee} = TOTAL CZK {total}. Recipient: {recipient}. Account: {account}. Transfer only after written organiser confirmation.',pdf:'Bank transfer proof (PDF, max. 2 MB) *',pdfHelp:'Redact unrelated transactions. A PDF is evidence for review; it is not proof of cleared funds.',pending:'No approved personal quote for this code or session. Contact the organiser for individual confirmation.',changed:'The price or 48-hour window changed. Check your quote again.',receipt:'PDF received for review. Neither funds nor attendance are verified.',codeReceipt:'Save this private one-time code. Once the organiser confirms in writing, return to the same form, enter it and check your quote. This is not a booked seat.'},
    ru:{heading:'Цена тренировки и PDF подтверждения оплаты',choose:'Запрашиваемый тариф',intro:'За 2 часа: первое занятие 240 Kč, подтверждённый Senior 120 Kč; Starter 4 — 800 Kč за четыре занятия в течение 30 дней. После первого оплаченного и посещённого занятия можно в течение 48 часов перейти на Starter 4, доплатив 560 Kč после проверки.',late:'Для новой записи менее чем за 48 часов до занятия действует доплата 25%.',notReady:'Оплата закрыта. Отправьте предварительную заявку. Не переводите деньги и не приезжайте без личного письменного подтверждения.',ready:'Получатель и банковский счёт доступны только после персонального подтверждения и проверки кода.',codeLabel:'Личный код предыдущей заявки (для повторного входа)',codeHelp:'Если записываетесь впервые, оставьте код пустым и отправьте заявку, затем сохраните полученный одноразовый код.',check:'Проверить утверждённую сумму и банковский счёт',checking:'Проверяем…',checkFirst:'Сначала проверьте лично подтверждённую стоимость и реквизиты.',approved:'Подтверждённый тариф: {tier}. База {base} Kč + доплата {fee} Kč = ИТОГО {total} Kč. Получатель: {recipient}. Счёт: {account}. Переводить только после письменного подтверждения организатора.',pdf:'PDF подтверждения банковского перевода (макс. 2 МБ) *',pdfHelp:'Скройте сведения о посторонних операциях. PDF отправляется на проверку, но не доказывает поступление средств.',pending:'По этому коду ещё нет персонально утверждённой суммы или занятие не открыто. Требуется подтверждение организатора.',changed:'Сумма или 48-часовая граница изменились. Проверьте расчёт заново.',receipt:'PDF получен на проверку. Деньги и участие пока не подтверждены.',codeReceipt:'Сохраните этот личный одноразовый код. После письменного подтверждения организатора вернитесь в ту же форму, введите код и проверьте сумму. Код не является бронированием.'},
    uk:{heading:'Вартість тренування та PDF підтвердження оплати',choose:'Бажаний тариф',intro:'За 2 години: перше заняття 240 Kč, підтверджений Senior 120 Kč; Starter 4 — 800 Kč за чотири заняття протягом 30 днів. Після першого оплаченого та відвіданого заняття можна протягом 48 годин перейти на Starter 4, доплативши 560 Kč після перевірки.',late:'Для нової заявки менш ніж за 48 годин до тренування діє доплата 25%.',notReady:'Оплата закрита. Надішліть попередню заявку. Не сплачуйте і не приїжджайте без особистого письмового підтвердження.',ready:'Одержувач і рахунок доступні лише після персонального погодження та перевірки коду.',codeLabel:'Особистий код попередньої заявки (для повторного входу)',codeHelp:'Якщо записуєтеся вперше, залиште поле порожнім, надішліть заявку і збережіть одноразовий код.',check:'Перевірити погоджену суму й банківський рахунок',checking:'Перевіряємо…',checkFirst:'Спочатку перевірте персонально підтверджену суму та реквізити.',approved:'Підтверджений тариф: {tier}. База {base} Kč + доплата {fee} Kč = РАЗОМ {total} Kč. Одержувач: {recipient}. Рахунок: {account}. Переказуйте лише після письмового підтвердження організатора.',pdf:'PDF підтвердження банківського переказу (до 2 МБ) *',pdfHelp:'Приховайте дані про сторонні операції. PDF призначено для перевірки, він не доводить надходження коштів.',pending:'Для цього коду ще немає персонально погодженої суми або тренування не відкрите. Потрібне підтвердження організатора.',changed:'Сума або 48-годинна межа змінились. Перевірте розрахунок знову.',receipt:'PDF отримано на перевірку. Кошти та участь ще не підтверджені.',codeReceipt:'Збережіть цей особистий одноразовий код. Після письмового підтвердження організатора поверніться до тієї самої форми, введіть код і перевірте суму. Код не є бронюванням.'}
  };
  const $=id=>document.getElementById(id);
  let latestEvent=null,latestLang='cs',latestMode='PLANNED',privateQuote=null;
  const copy=()=>T[latestLang]||T.cs;
  const fill=(s,d)=>s.replace(/\{(\w+)\}/g,(_,key)=>String(d[key]??''));
  const tier=()=>$('trainingTier')?.value||'STANDARD';
  const token=()=>$('paymentResumeToken')?.value?.trim()||'';
  function clearPrivateQuote(){
    privateQuote=null;
    const file=$('paymentProof');if(file){file.required=false;file.value='';}
    const state=$('trainingPaymentPrivate');if(state)state.textContent='';
  }
  function render(event,lang,mode){
    const changed=latestEvent?.event_id!==event?.event_id||latestMode!==mode;
    latestEvent=event;latestLang=lang;latestMode=mode;
    const box=$('trainingPayment'),proof=$('paymentProof'),plan=$('trainingTier');
    if(!box||!proof||!plan)return;
    const q=event?.trainingPayment;
    box.hidden=!q||mode!=='FORM';
    if(changed)clearPrivateQuote();
    if(box.hidden){proof.required=false;proof.value='';$('trainingPaymentPrivate').textContent='';return;}
    const t=copy();
    $('trainingPaymentHeading').textContent=t.heading;
    $('trainingPlanLabel').textContent=t.choose;
    for(const opt of plan.options)opt.textContent=PRICE_NAMES[opt.value]?.[lang]||opt.value;
    $('trainingPaymentNote').textContent=t.intro+' '+t.late;
    const prices=(q.tiers||[]).map(p=>{
      const tname=PRICE_NAMES[p.tier]?.[lang]||p.tier;
      return tname+': '+p.baseCzk+' + '+p.surchargeCzk+' = '+p.totalCzk+' Kč';
    });
    $('trainingPaymentAmount').textContent=prices.join(' · ');
    $('trainingPaymentInstructions').textContent=q.sessionPaymentOpen?t.ready:t.notReady;
    $('paymentResumeLabel').textContent=t.codeLabel;
    $('paymentResumeHelp').textContent=t.codeHelp;
    $('paymentQuoteButton').textContent=t.check;
    $('paymentPdfLabel').textContent=t.pdf;
    $('paymentProofHelp').textContent=t.pdfHelp;
    const isGoing=document.querySelector('input[name=rsvp]:checked')?.value==='YES';
    $('paymentResumeField').hidden=!isGoing;
    $('paymentQuoteButton').hidden=!isGoing||!token();
    const good=!!privateQuote&&privateQuote.eventId===event.event_id&&
      privateQuote.tier===tier()&&privateQuote.code===token()&&
      privateQuote.email===$('email')?.value.trim();
    $('paymentProofField').hidden=!good;
    proof.required=good;
    if(!good)proof.value='';
    if(good){
      const p=privateQuote.payload,tname=PRICE_NAMES[p.tier]?.[lang]||p.tier;
      $('trainingPaymentPrivate').textContent=fill(t.approved,{
       tier:tname,base:p.baseCzk,fee:p.surchargeCzk,total:p.totalCzk,
       recipient:p.recipient,account:p.account});
    }else if(!privateQuote){$('trainingPaymentPrivate').textContent='';}
  }
  function catalogPrice(event,lang){
    const q=event?.trainingPayment;
    if(!q)return null;
    const t=q.tiers?.find(x=>x.tier===tier())||q.tiers?.[0];
    const prefix=lang==='cs'?'Orientačně':lang==='ru'?'Предварительно':lang==='uk'?'Орієнтовно':'Indicative';
    return t?prefix+': '+t.totalCzk+' Kč (incl. applicable 25% surcharge)':null;
  }
  function requestOptions(event,body){
    if(!event?.trainingPayment)return {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    body.trainingTier=tier();
    if(!token())return {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    const quote=privateQuote,proof=$('paymentProof')?.files?.[0];
    if(!quote||quote.eventId!==event.event_id||quote.tier!==tier()||
       quote.code!==token()||quote.email!==$('email').value.trim())throw Error('quote_required');
    if(!proof||proof.size<100||proof.size>2097152||!proof.name.toLowerCase().endsWith('.pdf'))throw Error('invalid_pdf');
    const data=new FormData();
    data.append('payload',JSON.stringify({...body,action:'submit',paymentResumeToken:token(),
      quotedTier:tier(),quotedTotalCzk:quote.payload.totalCzk,
      quoteLockedAt:quote.payload.quoteLockedAt}));
    data.append('paymentProof',proof,proof.name);
    return {body:data};
  }
  async function checkQuote(){
    const e=latestEvent,d=copy(),form=$('rsvpForm'),out=$('trainingPaymentPrivate');
    if(!e||!e.trainingPayment||!token()||!form)return;
    if(!form.checkValidity()){form.reportValidity();return;}
    if(document.querySelector('input[name=rsvp]:checked')?.value!=='YES')return;
    const btn=$('paymentQuoteButton');btn.disabled=true;btn.textContent=d.checking;
    clearPrivateQuote();out.textContent=d.checking;
    const body={action:'quote',eventId:e.event_id,firstName:$('firstName').value,
      lastName:$('lastName').value,email:$('email').value,phone:$('phone').value,
      ageGroup:document.querySelector('input[name=age]:checked')?.value||'adult',
      guardianName:$('guardianName').value,guardianPhone:$('guardianPhone').value,
      photo:'NO',futureUpdates:false,rsvp:'YES',safety:$('safety').checked,
      language:latestLang,paymentResumeToken:token(),trainingTier:tier()};
    try{
      const reply=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!reply.ok)throw Error(reply.status===409?'pending':'invalid');
      const payload=await reply.json(),p=payload.trainingPayment;
      if(!payload.ok||!p?.account||!p?.recipient||!p?.quoteLockedAt)throw Error('invalid');
      privateQuote={eventId:e.event_id,tier:tier(),code:token(),
        email:$('email').value.trim(),payload:p};
      render(e,latestLang,latestMode);
    }catch(err){out.textContent=err?.message==='pending'?d.pending:d.changed;}
    finally{btn.disabled=false;btn.textContent=copy().check;}
  }
  function changedMessage(lang){return (T[lang]||T.cs).changed;}
  function receiptMessage(lang){return (T[lang]||T.cs).receipt;}
  function resumeMessage(lang){return (T[lang]||T.cs).codeReceipt;}
  document.querySelectorAll('input[name=rsvp]').forEach(el=>el.addEventListener('change',()=>{
    clearPrivateQuote();render(latestEvent,latestLang,latestMode);
  }));
  ['trainingTier','paymentResumeToken','email','firstName','lastName'].forEach(id=>{
    $(id)?.addEventListener('input',()=>{clearPrivateQuote();render(latestEvent,latestLang,latestMode);});
  });
  $('paymentQuoteButton')?.addEventListener('click',checkQuote);
  window.ImperionTrainingPayment={render,catalogPrice,requestOptions,changedMessage,
    receiptMessage,resumeMessage,clearPrivateQuote};
})();
