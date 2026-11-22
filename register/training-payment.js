/* Current 9 November 2026 Druzina individual tariffs.
 * Sole registration form: intake -> individually approved private quote -> PDF.
 * No cash is marked paid until a separate bank readback.
 */
(function(){
  'use strict';
  const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
  const PRICE_NAMES={STANDARD:{cs:'První / standardní',en:'First / standard',ru:'Первое / обычное',uk:'Перше / звичайне'},SENIOR:{cs:'Senior (po ověření)',en:'Senior (verified only)',ru:'Senior (после проверки)',uk:'Senior (після перевірки)'},STARTER4:{cs:'Starter 4 (4 tréninky)',en:'Starter 4 (4 sessions)',ru:'Starter 4 (4 занятия)',uk:'Starter 4 (4 заняття)'}};
  const T={
    cs:{heading:'Cena a doklad o platbě tréninku',choose:'Požadovaný tarif',intro:'Základní cena za 2 h: první návštěva 240 Kč, ověřený Senior 120 Kč; Starter 4 = 800 Kč za čtyři tréninky / 30 dnů. Po prvním zaplaceném a absolvovaném tréninku lze do 48 hodin doplatit 560 Kč na Starter 4. Toto navýšení balíčku vyžaduje zvláštní ověření.',late:'Nová žádost méně než 48 h před začátkem: jednorázový příplatek 25 %.',notReady:'Platba zatím není otevřena. Odešlete přihlášku; po osobním písemném schválení částky a účtu a bankovním převodu nahrajete PDF potvrzení (max. 5 MB) sem do stejného formuláře. PDF není bankovní potvrzení připsání. Neplaťte ani necestujte před schválením.',ready:'Příjemce a účet zobrazíme až po potvrzení účasti a kontrole vašeho osobního kódu.',codeLabel:'Osobní kód předchozí žádosti (jen pro již podané žádosti)',codeHelp:'Noví zájemci ponechají prázdné a odešlou první žádost. Uschovejte si jednorázový kód, který získáte.',check:'Ověřit schválenou částku a účet',checking:'Ověřuji…',checkFirst:'Nejdříve ověřte svou cenu a platební údaje.',approved:'Individuálně schválený tarif: {tier}. Základ {base} Kč + příplatek {fee} Kč = CELKEM {total} Kč. Příjemce: {recipient}. Účet: {account}. Peníze odešlete pouze po písemném potvrzení organizátorem.',pdf:'PDF potvrzení bankovního převodu (max. 5 MB) *',pdfHelp:'Před odesláním skryjte nesouvisející transakce. PDF je jen důkaz převodu ke kontrole, nikoli potvrzení připsání peněz.',pending:'Neplatný kód, nezaúčtovaná osobní nabídka nebo uzavřený termín; organizátor musí nejprve potvrdit účast.',changed:'Cena či 48hodinová hranice se změnila. Ověřte částku znovu.',receipt:'PDF přijato ke kontrole. Platba ani účast zatím nejsou potvrzeny.',codeReceipt:'Uložte tento soukromý jednorázový kód. Po písemném potvrzení organizátorem jej zadejte do stejného formuláře a ověřte nabídku. Kód není potvrzení místa.'},
    en:{heading:'Training price and bank transfer PDF',choose:'Requested training tariff',intro:'Two-hour base prices: first visit CZK 240, verified Senior CZK 120; Starter 4 is CZK 800 for four sessions within 30 days. After your first paid and attended session, a verified upgrade within 48 hours costs another CZK 560.',late:'New bookings less than 48 hours before the session carry a 25% surcharge.',notReady:'Payments are not open yet. Submit an enquiry; after personal written approval of the payee and amount and a bank transfer, upload a PDF receipt (max 5 MB) here in the same form. The PDF is not proof of cleared funds. Do not pay or travel before approval.',ready:'Recipient and bank account appear only after individual approval and private-code verification.',codeLabel:'Private code from an earlier request (existing applicants only)',codeHelp:'New applicants leave this blank and submit the form first. Save the one-time code you receive.',check:'Check approved total and bank account',checking:'Checking…',checkFirst:'Check your approved quote and bank account first.',approved:'Individually approved rate: {tier}. Base CZK {base} + surcharge CZK {fee} = TOTAL CZK {total}. Recipient: {recipient}. Account: {account}. Transfer only after written organiser confirmation.',pdf:'Bank transfer proof (PDF, max. 5 MB) *',pdfHelp:'Redact unrelated transactions. A PDF is evidence for review; it is not proof of cleared funds.',pending:'No approved personal quote for this code or session. Contact the organiser for individual confirmation.',changed:'The price or 48-hour window changed. Check your quote again.',receipt:'PDF received for review. Neither funds nor attendance are verified.',codeReceipt:'Save this private one-time code. Once the organiser confirms in writing, return to the same form, enter it and check your quote. This is not a booked seat.'},
    ru:{heading:'Цена тренировки и PDF подтверждения оплаты',choose:'Запрашиваемый тариф',intro:'За 2 часа: первое занятие 240 Kč, подтверждённый Senior 120 Kč; Starter 4 — 800 Kč за четыре занятия в течение 30 дней. После первого оплаченного и посещённого занятия можно в течение 48 часов перейти на Starter 4, доплатив 560 Kč после проверки.',late:'Для новой записи менее чем за 48 часов до занятия действует доплата 25%.',notReady:'Приём платежей пока закрыт. Отправьте заявку; после личного письменного одобрения суммы и получателя и банковского перевода загрузите PDF квитанции (до 5 МБ) сюда же, в ту же форму. PDF не подтверждает зачисление средств. До одобрения не платите и не приезжайте.',ready:'Получатель и банковский счёт доступны только после персонального подтверждения и проверки кода.',codeLabel:'Личный код предыдущей заявки (для повторного входа)',codeHelp:'Если записываетесь впервые, оставьте код пустым и отправьте заявку, затем сохраните полученный одноразовый код.',check:'Проверить утверждённую сумму и банковский счёт',checking:'Проверяем…',checkFirst:'Сначала проверьте лично подтверждённую стоимость и реквизиты.',approved:'Подтверждённый тариф: {tier}. База {base} Kč + доплата {fee} Kč = ИТОГО {total} Kč. Получатель: {recipient}. Счёт: {account}. Переводить только после письменного подтверждения организатора.',pdf:'PDF подтверждения банковского перевода (макс. 5 МБ) *',pdfHelp:'Скройте сведения о посторонних операциях. PDF отправляется на проверку, но не доказывает поступление средств.',pending:'По этому коду ещё нет персонально утверждённой суммы или занятие не открыто. Требуется подтверждение организатора.',changed:'Сумма или 48-часовая граница изменились. Проверьте расчёт заново.',receipt:'PDF получен на проверку. Деньги и участие пока не подтверждены.',codeReceipt:'Сохраните этот личный одноразовый код. После письменного подтверждения организатора вернитесь в ту же форму, введите код и проверьте сумму. Код не является бронированием.'},
    uk:{heading:'Вартість тренування та PDF підтвердження оплати',choose:'Бажаний тариф',intro:'За 2 години: перше заняття 240 Kč, підтверджений Senior 120 Kč; Starter 4 — 800 Kč за чотири заняття протягом 30 днів. Після першого оплаченого та відвіданого заняття можна протягом 48 годин перейти на Starter 4, доплативши 560 Kč після перевірки.',late:'Для нової заявки менш ніж за 48 годин до тренування діє доплата 25%.',notReady:'Оплату наразі закрито. Надішліть заявку; після особистого письмового погодження суми й одержувача та банківського переказу завантажте PDF квитанції (до 5 МБ) сюди ж, у ту саму форму. PDF не підтверджує надходження коштів. До погодження не сплачуйте і не приїжджайте.',ready:'Одержувач і рахунок доступні лише після персонального погодження та перевірки коду.',codeLabel:'Особистий код попередньої заявки (для повторного входу)',codeHelp:'Якщо записуєтеся вперше, залиште поле порожнім, надішліть заявку і збережіть одноразовий код.',check:'Перевірити погоджену суму й банківський рахунок',checking:'Перевіряємо…',checkFirst:'Спочатку перевірте персонально підтверджену суму та реквізити.',approved:'Підтверджений тариф: {tier}. База {base} Kč + доплата {fee} Kč = РАЗОМ {total} Kč. Одержувач: {recipient}. Рахунок: {account}. Переказуйте лише після письмового підтвердження організатора.',pdf:'PDF підтвердження банківського переказу (до 5 МБ) *',pdfHelp:'Приховайте дані про сторонні операції. PDF призначено для перевірки, він не доводить надходження коштів.',pending:'Для цього коду ще немає персонально погодженої суми або тренування не відкрите. Потрібне підтвердження організатора.',changed:'Сума або 48-годинна межа змінились. Перевірте розрахунок знову.',receipt:'PDF отримано на перевірку. Кошти та участь ще не підтверджені.',codeReceipt:'Збережіть цей особистий одноразовий код. Після письмового підтвердження організатора поверніться до тієї самої форми, введіть код і перевірте суму. Код не є бронюванням.'}
  };
  const OSVC_TEXT={
    cs:{heading:'Platba za průvodcovskou akci',intro:'Cena je za vybranou akci, bez automatického příplatku a bez klubových tarifů.',notReady:'Platba zatím není otevřena. Odešlete nezávaznou přihlášku. Neplaťte a necestujte bez písemného potvrzení pořadatele.',ready:'Bankovní údaje OSVČ se zobrazí jen po osobním schválení vaší žádosti.',approved:'Schválená cena {total} Kč. Příjemce OSVČ: {recipient}. Účet: {account}. Plaťte až po písemném potvrzení pořadatele.',receipt:'PDF bylo přijato, ale banka ani místo dosud nebyly potvrzeny.',codeReceipt:'Uložte si soukromý kód. Použijte jej k pozdějšímu ověření ceny a stavu účasti. Samotný kód není vstupenka.',statusCheck:'Ověřit stav platby a účasti',statusWaiting:'Kontroluji stav…',statusPending:'Přihláška přijata; platba zatím není ověřena.',statusProof:'PDF přijato; bankovní připsání zatím není ověřeno.',statusPaid:'Banka potvrdila připsání; místo ještě čeká na potvrzení.',statusConfirmed:'Platba připsána a místo na vybrané akci potvrzeno.',statusInvalid:'Kód nebo údaje nebyly ověřeny.'},
    en:{heading:'Guided-event payment',intro:'Fixed price for the selected event. Club plans and training surcharges do not apply.',notReady:'Payment is not open yet. Enquire first. Do not pay or travel until the organiser confirms in writing.',ready:'The OSVC bank details appear only after individual approval.',approved:'Approved amount CZK {total}. OSVC payee: {recipient}. Account: {account}. Transfer only after written organiser approval.',receipt:'PDF received; funds and the place remain unverified.',codeReceipt:'Keep this private code to check your approved quote and booking status later. The code is not a ticket.',statusCheck:'Check payment and booking status',statusWaiting:'Checking…',statusPending:'Request received; no bank credit verified yet.',statusProof:'PDF received; bank settlement not yet verified.',statusPaid:'Bank credit verified; place not yet confirmed.',statusConfirmed:'Funds received and a place confirmed for this event.',statusInvalid:'Unable to verify the code or contact details.'},
    ru:{heading:'Оплата экскурсии',intro:'Стоимость относится к выбранному мероприятию. Клубные тарифы и доплата за позднюю тренировку не применяются.',notReady:'Приём оплаты пока закрыт. Отправьте заявку. Не переводите деньги и не приезжайте без письменного подтверждения организатора.',ready:'Реквизиты OSVČ выдаются только после индивидуального одобрения заявки.',approved:'Согласованная сумма {total} Kč. Получатель OSVČ: {recipient}. Счёт: {account}. Переводить только после письменного подтверждения.',receipt:'PDF получен, поступление денег и место пока не подтверждены.',codeReceipt:'Сохраните личный код для проверки суммы и статуса заявки. Код сам по себе не является билетом.',statusCheck:'Проверить оплату и место',statusWaiting:'Проверяем…',statusPending:'Заявка получена, банк пока не подтвердил поступление.',statusProof:'PDF получен, банковское зачисление ещё не подтверждено.',statusPaid:'Деньги зачислены, место ещё не подтверждено.',statusConfirmed:'Оплата поступила, место на мероприятии подтверждено.',statusInvalid:'Не удалось проверить код или контактные данные.'},
    uk:{heading:'Оплата екскурсії',intro:'Ціна стосується конкретного заходу; клубні тарифи й доплата за тренування не застосовуються.',notReady:'Оплату ще не відкрито. Надішліть заявку. Не сплачуйте та не вирушайте без письмового підтвердження організатора.',ready:'Реквізити OSVČ доступні лише після індивідуального погодження.',approved:'Погоджена сума {total} Kč. Одержувач OSVČ: {recipient}. Рахунок: {account}. Сплачуйте лише після письмового погодження.',receipt:'PDF отримано, але надходження коштів та місце ще не підтверджені.',codeReceipt:'Збережіть приватний код для перевірки суми та статусу. Код сам по собі не є квитком.',statusCheck:'Перевірити оплату й участь',statusWaiting:'Перевіряю…',statusPending:'Заявку отримано, банківський платіж ще не перевірено.',statusProof:'PDF отримано, зарахування коштів ще не перевірено.',statusPaid:'Кошти надійшли, місце ще не підтверджено.',statusConfirmed:'Оплату отримано, місце на заході підтверджено.',statusInvalid:'Не вдалося перевірити код або контактні дані.'}
  };
  const STATUS_TEXT={
    cs:{statusCheck:'Ověřit stav platby a účasti',statusWaiting:'Kontroluji…',statusPending:'Přihláška přijata; platba zatím není ověřena.',statusProof:'PDF přijato; banka zatím nepotvrdila připsání.',statusPaid:'Platba ověřena bankou, místo zatím není potvrzeno.',statusConfirmed:'Platba i místo na akci jsou potvrzeny.',statusInvalid:'Kód nebo údaje nebyly ověřeny.'},
    en:{statusCheck:'Check payment and booking status',statusWaiting:'Checking…',statusPending:'Enquiry received; bank credit not yet verified.',statusProof:'PDF received; bank credit not yet verified.',statusPaid:'Funds verified; place not yet confirmed.',statusConfirmed:'Payment and a place are confirmed.',statusInvalid:'Unable to verify code or contact details.'},
    ru:{statusCheck:'Проверить оплату и место',statusWaiting:'Проверяем…',statusPending:'Заявка получена; оплата не подтверждена.',statusProof:'PDF принят; зачисление не подтверждено.',statusPaid:'Поступление денег подтверждено, место пока нет.',statusConfirmed:'Оплата и место подтверждены.',statusInvalid:'Неверный код или контактные данные.'},
    uk:{statusCheck:'Перевірити оплату й місце',statusWaiting:'Перевіряю…',statusPending:'Заявку отримано, платіж не перевірено.',statusProof:'PDF отримано, зарахування ще не підтверджено.',statusPaid:'Кошти перевірено, місце ще не підтверджено.',statusConfirmed:'Оплату та місце підтверджено.',statusInvalid:'Не вдалося перевірити код чи дані.'}
  };
  const QR_TEXT={
    cs:{title:'QR platba pro schválenou žádost',reference:'Variabilní symbol (VS): ',copy:'Kopírovat platební údaje',copied:'Údaje zkopírovány',failed:'Kopírování není dostupné',note:'QR obsahuje schválenou částku, účet a VS. Připsání se ověřuje jen podle banky.'},
    en:{title:'QR transfer for this approved request',reference:'Variable symbol (VS): ',copy:'Copy transfer details',copied:'Details copied',failed:'Clipboard unavailable',note:'QR includes the approved amount, account and VS. Settled funds are verified separately with the bank.'},
    ru:{title:'QR для перевода по одобренной заявке',reference:'Вариабильный символ (VS): ',copy:'Скопировать реквизиты',copied:'Скопировано',failed:'Копирование недоступно',note:'QR содержит утверждённые сумму, счёт и VS. Поступление денег проверяется только по банку.'},
    uk:{title:'QR для переказу за погодженою заявкою',reference:'Варіабельний символ (VS): ',copy:'Копіювати реквізити',copied:'Скопійовано',failed:'Копіювання недоступне',note:'QR містить погоджені суму, рахунок та VS. Надходження коштів перевіряється через банк.'}
  };
  const MANUAL={
    cs:{label:'Už jste zaplatili? Přiložte PDF potvrzení (nepovinné, max. 5 MB)',
      help:'Jen pokud jste už provedli převod na dříve schválený účet. Tato stránka nevyzývá k nové platbě. PDF přijmeme k ruční kontrole; místo ani připsání peněz tím nepotvrzujeme.',
      failed:'PDF se nepodařilo nahrát. Přihláška zůstává uložena. Uchovejte si osobní kód a zkuste PDF přiložit znovu.',
      payee:'Komu jste již peníze odeslali?',payeeHelp:'Vyberte příjemce existující platby; nejde o nabídku další platby.'},
    en:{label:'Already transferred? Attach the PDF receipt (optional, max 5 MB)',
      help:'Only if you already transferred to an account approved earlier. Do not initiate a new transfer based on this page. We review the PDF manually; it does not confirm funds or a place.',
      failed:'PDF upload failed, but your RSVP was saved. Keep your private code to retry the document upload.',
      payee:'Who received your existing transfer?',payeeHelp:'Select the actual recipient of the earlier payment. Do not initiate a new transfer.'},
    ru:{label:'Уже переводили деньги? Приложите PDF квитанции (необязательно, до 5 МБ)',
      help:'Только если перевод уже сделан на ранее согласованный счёт. Не переводите деньги на основании этой страницы. PDF поступит на ручную проверку и не подтверждает оплату или место.',
      failed:'PDF не удалось загрузить, но заявка сохранена. Сохраните личный код и повторите загрузку документа.',
      payee:'Кому вы уже переводили деньги?',payeeHelp:'Укажите фактического получателя предыдущего перевода. Это не приглашение к новой оплате.'},
    uk:{label:'Уже переказували кошти? Додайте PDF квитанції (необов’язково, до 5 МБ)',
      help:'Лише якщо ви вже переказали кошти на раніше погоджений рахунок. Не сплачуйте на підставі цієї сторінки. PDF піде на ручну перевірку та не підтверджує оплату або місце.',
      failed:'PDF не завантажено, але заявку збережено. Збережіть приватний код і повторіть завантаження документа.',
      payee:'Кому ви вже переказали кошти?',payeeHelp:'Оберіть фактичного одержувача попереднього переказу. Не виконуйте нової оплати.'}
  };
  const $=id=>document.getElementById(id);
  function renderApprovedQr(p){
    const area=$('paymentQrArea'),canvas=$('paymentQrCode'),ref=$('paymentReference');
    if(!area||!canvas||!ref)return;
    canvas.replaceChildren();area.hidden=true;
    if(!p?.spd||!p?.paymentReference||!p?.iban||!/^[1-9][0-9]{9}$/.test(p.variableSymbol||'')||!window.QRCode)return;
    const t=QR_TEXT[latestLang]||QR_TEXT.cs;
    $('paymentQrLabel').textContent=t.title;
    ref.textContent=t.reference+p.variableSymbol+' · ID '+p.paymentReference;
    $('paymentQrCaution').textContent=t.note;
    $('paymentCopyButton').textContent=t.copy;
    try{new window.QRCode(canvas,{text:p.spd,width:192,height:192,colorDark:'#000',colorLight:'#fff',correctLevel:window.QRCode.CorrectLevel.M});area.hidden=false;}
    catch{canvas.replaceChildren();}
  }
  let latestEvent=null,latestLang='cs',latestMode='PLANNED',privateQuote=null;
  const copy=()=>({...((T[latestLang]||T.cs)),...(latestEvent?.trainingPayment?.kind==='OSVC_EVENT'?(OSVC_TEXT[latestLang]||OSVC_TEXT.cs):{})});
  const fill=(s,d)=>s.replace(/\{(\w+)\}/g,(_,key)=>String(d[key]??''));
  const tier=()=>$('trainingTier')?.value||'STANDARD';
  const token=()=>$('paymentResumeToken')?.value?.trim()||'';
  function clearPrivateQuote(resetProof=false){
    const hadApprovedQuote=!!privateQuote;
    privateQuote=null;
    const file=$('paymentProof');if(file){
      file.required=false;
      if(resetProof||hadApprovedQuote)file.value='';
    }
    const state=$('trainingPaymentPrivate');if(state)state.textContent='';
    renderApprovedQr(null);
  }
  function render(event,lang,mode){
    const changed=latestEvent?.event_id!==event?.event_id||latestMode!==mode;
    latestEvent=event;latestLang=lang;latestMode=mode;
    const box=$('trainingPayment'),proof=$('paymentProof'),plan=$('trainingTier');
    if(!box||!proof||!plan)return;
    const q=event?.trainingPayment,osvc=q?.kind==='OSVC_EVENT';
    box.hidden=!q||mode!=='FORM';
    if(changed){
      clearPrivateQuote(true);
      if($('paymentProofRecipient'))$('paymentProofRecipient').value='OSVC';
    }
    if(box.hidden){proof.required=false;proof.value='';$('trainingPaymentPrivate').textContent='';renderApprovedQr(null);return;}
    const t=copy();
    const paidWalk=osvc&&event?.event_id==='PUB-WALK-20261129';
    if(paidWalk){
      const rate={
       cs:{intro:'Pouze placená registrace. 190 Kč/os. při připsání celé platby do pátku 27. 11. 15:30, jinak při volných místech 237,50 Kč (+25 %).',note:'Přihláška bez platby není rezervace. Organizátor nejprve individuálně sdělí a odsouhlasí platební a storno podmínky. Místo platí až po připsání celé částky a písemném potvrzení.'},
       en:{intro:'PAID BOOKINGS ONLY. 190 CZK per person if full bank credit arrives by Fri 27 Nov 15:30 CET; later, if space remains, 237.50 CZK (+25%).',note:'An unpaid form is not a booking. The organiser will first approve payment instructions and cancellation terms individually. Only bank-cleared payment plus written confirmation secure a place.'},
       ru:{intro:'ТОЛЬКО ОПЛАЧЕННАЯ РЕГИСТРАЦИЯ. 190 Kč при зачислении до пятницы 27.11 в 15:30; затем при наличии мест 237,50 Kč (+25%).',note:'Заявка без оплаты не является бронью. Сначала организатор согласует реквизиты и условия отмены. Место закрепляется только после банковского зачисления всей суммы и письменного подтверждения.'},
       uk:{intro:'ЛИШЕ ОПЛАЧЕНА РЕЄСТРАЦІЯ. 190 Kč до п’ятниці 27.11, 15:30 за умови зарахування банком; пізніше за наявності місць 237,50 Kč (+25%).',note:'Несплачена заявка не є бронюванням. Спершу організатор погодить реквізити й умови скасування. Місце дійсне лише після надходження всієї суми та письмового підтвердження.'}
      }[lang]||{intro:'Paid bookings only. 190 CZK until 27 Nov 15:30; late 237.50 CZK.',note:'Only cleared full payment and written organiser confirmation secure a place.'};
      t.intro=rate.intro;
      t.notReady=rate.note;
      t.ready=rate.note;
    }
    if(osvc)plan.value='STANDARD';
    if(plan.closest('.field'))plan.closest('.field').hidden=osvc;
    $('trainingPaymentHeading').textContent=t.heading;
    $('trainingPlanLabel').textContent=t.choose;
    for(const opt of plan.options)opt.textContent=PRICE_NAMES[opt.value]?.[lang]||opt.value;
    $('trainingPaymentNote').textContent=osvc?t.intro:t.intro+' '+t.late;
    const prices=(q.tiers||[]).map(p=>{
      const tname=PRICE_NAMES[p.tier]?.[lang]||p.tier;
      return tname+': '+p.baseCzk+' + '+p.surchargeCzk+' = '+p.totalCzk+' Kč';
    });
    $('trainingPaymentAmount').textContent=paidWalk?'190 Kč (by 27 Nov 15:30) / 237,50 Kč (late +25%)':osvc?(q.tiers?.[0]?.totalCzk+' Kč'):prices.join(' · ');
    $('trainingPaymentInstructions').textContent=q.sessionPaymentOpen?t.ready:t.notReady;
    $('paymentResumeLabel').textContent=t.codeLabel;
    $('paymentResumeHelp').textContent=t.codeHelp;
    $('paymentQuoteButton').textContent=t.check;
    $('paymentPdfLabel').textContent=t.pdf;
    $('paymentProofHelp').textContent=t.pdfHelp;
    const isGoing=document.querySelector('input[name=rsvp]:checked')?.value==='YES';
    if($('paymentStatusButton')){
      $('paymentStatusButton').hidden=!isGoing||!token();
      $('paymentStatusButton').textContent=(STATUS_TEXT[lang]||STATUS_TEXT.cs).statusCheck;
    }
    $('paymentResumeField').hidden=!isGoing;
    $('paymentQuoteButton').hidden=!isGoing||!token();
    const good=!!privateQuote&&privateQuote.eventId===event.event_id&&
      privateQuote.tier===tier()&&privateQuote.code===token()&&
      privateQuote.email===$('email')?.value.trim();
    // Permit document intake for ALREADY completed transfers even before an
    // approved quote. It cannot open payment collection or confirm a seat.
    const manual=!osvc&&isGoing;
    $('paymentProofField').hidden=!(good||manual);
    proof.required=good;
    $('paymentPdfLabel').textContent=good?t.pdf:(manual?(MANUAL[lang]||MANUAL.cs).label:t.pdf);
    $('paymentProofHelp').textContent=good?t.pdfHelp:(manual?(MANUAL[lang]||MANUAL.cs).help:t.pdfHelp);
    if(!good&&!manual)proof.value='';
    const payeeField=$('paymentProofRecipientField');
    if(payeeField)payeeField.hidden=!(manual&&!good);
    if(manual&&!good){
      $('paymentProofRecipientLabel').textContent=(MANUAL[lang]||MANUAL.cs).payee;
      $('paymentProofRecipientHelp').textContent=(MANUAL[lang]||MANUAL.cs).payeeHelp;
    }
    renderApprovedQr(good?privateQuote.payload:null);
    if(good){
      const p=privateQuote.payload,tname=PRICE_NAMES[p.tier]?.[lang]||p.tier;
      $('trainingPaymentPrivate').textContent=fill(t.approved,{
       tier:tname,base:p.baseCzk,fee:p.surchargeCzk,total:p.totalCzk,
       recipient:p.recipient,account:p.account})+' VS: '+p.variableSymbol;
    }else if(!privateQuote){$('trainingPaymentPrivate').textContent='';}
  }
  function catalogPrice(event,lang){
    const q=event?.trainingPayment;
    if(!q)return null;
    if(q.kind==='OSVC_EVENT')return event.event_id==='PUB-WALK-20261129'?'190 Kč (up to 27 Nov 15:30) / 237,50 Kč (late +25%)':String(q.tiers?.[0]?.totalCzk||event.price_czk)+' Kč';
    const tiers=Array.isArray(q.tiers)?q.tiers:[];
    const values=tiers.map(p=>p.totalCzk).join(' / ');
    if(!values)return null;
    const late=tiers.some(p=>Number(p.surchargeCzk)>0);
    const copy={
      cs:['Orientačně','standardní / ověřený Senior / Starter 4','včetně 25% příplatku za přihlášení méně než 48 hodin předem','bez příplatku'],
      en:['Indicative','standard / verified Senior / Starter 4','including the 25% surcharge for booking less than 48 hours ahead','without a surcharge'],
      ru:['Ориентировочно','обычный / подтверждённый Senior / Starter 4','включая надбавку 25% при записи менее чем за 48 часов','без надбавки'],
      uk:['Орієнтовно','звичайний / підтверджений Senior / Starter 4','із доплатою 25% за запис менш ніж за 48 годин','без доплати']
    }[lang]||['Indicative','standard / verified Senior / Starter 4','including the 25% short-notice surcharge','without a surcharge'];
    return copy[0]+': '+values+' Kč ('+copy[1]+'; '+(late?copy[2]:copy[3])+')';
  }
  function requestOptions(event,body){
    if(!event?.trainingPayment)return {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    body.trainingTier=tier();
    if(!token())return {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
    const quote=privateQuote,proof=$('paymentProof')?.files?.[0];
    if(!proof||proof.size<100||proof.size>5242880||!proof.name.toLowerCase().endsWith('.pdf'))throw Error('invalid_pdf');
    if(!quote){
      if(event?.trainingPayment?.kind==='OSVC_EVENT')throw Error('quote_required');
      const manual=new FormData();
      manual.append('payload',JSON.stringify({...body,action:'manual_proof',
        paymentResumeToken:token(),proofRecipient:$('paymentProofRecipient')?.value||'OSVC'}));
      manual.append('paymentProof',proof,proof.name);
      return {body:manual};
    }
    if(quote.eventId!==event.event_id||quote.tier!==tier()||
       quote.code!==token()||quote.email!==$('email').value.trim())throw Error('quote_required');
    const data=new FormData();
    data.append('payload',JSON.stringify({...body,action:'submit',paymentResumeToken:token(),
      quotedTier:tier(),quotedTotalCzk:quote.payload.totalCzk,
      quoteLockedAt:quote.payload.quoteLockedAt}));
    data.append('paymentProof',proof,proof.name);
    return {body:data};
  }
  // Same existing RSVP endpoint and private one-use code; no duplicate signup.
  async function uploadManualProof(event,body,privateCode,file,proofRecipient='OSVC'){
    if(!event||event.trainingPayment?.kind==='OSVC_EVENT'||event.category!=='HEMA Training')
      throw Error('unsupported_event');
    if(!['OSVC','DRUZINA'].includes(proofRecipient))throw Error('invalid_payee');
    if(!/^[A-Za-z0-9_-]{43}$/.test(privateCode||'')||
       !file||file.size<100||file.size>5242880||!file.name.toLowerCase().endsWith('.pdf'))
      throw Error('invalid_pdf');
    const data=new FormData();
    data.append('payload',JSON.stringify({...body,action:'manual_proof',
      paymentResumeToken:privateCode,trainingTier:body.trainingTier||tier(),
      proofRecipient}));
    data.append('paymentProof',file,file.name);
    try{
      const res=await fetch(API,{method:'POST',body:data,cache:'no-store',
        signal:AbortSignal.timeout(30000)});
      if(!res.ok)throw Error('manual_upload_failed');
      const result=await res.json();
      if(result.ok!==true||result.paymentEvidenceStatus!=='PROOF_RECEIVED'||
         result.bankVerified!==false)throw Error('manual_upload_failed');
      return result;
    }catch(error){
      // A dropped response is not proof of a failed upload. Reuse the existing
      // read-only one-use-code status endpoint; never resubmit an RSVP.
      try{
        const status=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'status',eventId:event.event_id,
            firstName:body.firstName,lastName:body.lastName,email:body.email,
            paymentResumeToken:privateCode}),cache:'no-store',
          signal:AbortSignal.timeout(10000)});
        if(status.ok){
          const saved=await status.json();
          if(saved.ok===true&&saved.paymentEvidenceStatus==='PROOF_RECEIVED')
            return {ok:true,status:'RECEIVED',confirmed:false,
              paymentEvidenceStatus:'PROOF_RECEIVED',bankVerified:false};
        }
      }catch(_){}
      throw error;
    }
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
      if(!payload.ok||!p?.account||!p?.recipient||!p?.quoteLockedAt||
         !/^[1-9][0-9]{9}$/.test(p?.variableSymbol||''))throw Error('invalid');
      privateQuote={eventId:e.event_id,tier:tier(),code:token(),
        email:$('email').value.trim(),payload:p};
      render(e,latestLang,latestMode);
    }catch(err){out.textContent=err?.message==='pending'?d.pending:d.changed;}
    finally{btn.disabled=false;btn.textContent=copy().check;}
  }
  async function checkStatus(){
    const e=latestEvent,output=$('paymentStatusResult'),btn=$('paymentStatusButton');
    if(!e?.trainingPayment||!token()||!output||!btn)return;
    const d=STATUS_TEXT[latestLang]||STATUS_TEXT.cs;
    const first=$('firstName').value.trim(),last=$('lastName').value.trim(),
      email=$('email').value.trim();
    if(first.length<2||last.length<2||!email.includes('@')){
      output.textContent=d.statusInvalid;return;
    }
    btn.disabled=true;output.textContent=d.statusWaiting;
    try{
      const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'status',eventId:e.event_id,
          firstName:first,lastName:last,email,paymentResumeToken:token()}),
        cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!res.ok)throw Error('invalid');
      const status=await res.json();
      output.textContent=status.confirmed?d.statusConfirmed:
        status.bankVerified?d.statusPaid:
        status.paymentEvidenceStatus==='PROOF_RECEIVED'?d.statusProof:d.statusPending;
    }catch{output.textContent=d.statusInvalid;}
    finally{btn.disabled=false;btn.textContent=d.statusCheck;}
  }
  function changedMessage(lang){return (T[lang]||T.cs).changed;}
  function receiptMessage(lang){return latestEvent?.trainingPayment?.kind==='OSVC_EVENT'?(OSVC_TEXT[lang]||OSVC_TEXT.cs).receipt:(T[lang]||T.cs).receipt;}
  function resumeMessage(lang){return latestEvent?.trainingPayment?.kind==='OSVC_EVENT'?(OSVC_TEXT[lang]||OSVC_TEXT.cs).codeReceipt:(T[lang]||T.cs).codeReceipt;}
  document.querySelectorAll('input[name=rsvp]').forEach(el=>el.addEventListener('change',()=>{
    clearPrivateQuote();render(latestEvent,latestLang,latestMode);
  }));
  ['trainingTier','paymentResumeToken','email','firstName','lastName'].forEach(id=>{
    $(id)?.addEventListener('input',()=>{clearPrivateQuote();render(latestEvent,latestLang,latestMode);});
  });
  $('paymentQuoteButton')?.addEventListener('click',checkQuote);
  $('paymentStatusButton')?.addEventListener('click',checkStatus);
  $('paymentCopyButton')?.addEventListener('click',async()=>{
    const p=privateQuote?.payload;
    if(!p?.spd||!p?.paymentReference||!p?.iban||!p?.variableSymbol)return;
    const t=QR_TEXT[latestLang]||QR_TEXT.cs;
    const details=[p.recipient,p.iban,p.account,p.totalCzk+' CZK',
      'VS '+p.variableSymbol,
      (latestEvent?.trainingPayment?.kind==='OSVC_EVENT'?'BW ':'DM ')+p.paymentReference.replace(/-/g,'').toUpperCase()].join('\n');
    try{
      if(!navigator.clipboard?.writeText)throw Error('unsupported');
      await navigator.clipboard.writeText(details);$('paymentCopyButton').textContent=t.copied;
    }catch{$('paymentCopyButton').textContent=t.failed;}
  });
  window.ImperionTrainingPayment={render,catalogPrice,requestOptions,changedMessage,
    receiptMessage,resumeMessage,clearPrivateQuote,uploadManualProof,
    manualUi:(language)=>MANUAL[language]||MANUAL.cs};
})();
