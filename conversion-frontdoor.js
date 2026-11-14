
/* Conversion-first homepage, 11 Nov 2026. Uses existing public registration catalog.
   No new contact storage, payment claim, duplicate CRM, or analytics tracker. */
(function () {
  'use strict';
  if (!document.body || document.getElementById('imperion-frontdoor')) return;
  // Read-only knowledge-base fallback: existing homepage remains fully accessible.
  if(new URLSearchParams(location.search).get('view')==='details')return;
  var API = 'https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';

  // Editorial companion to the verified 55-second video (13 Nov 2026): avoid fake numerical losses.
  var VALUE_HOME = {
    cs:['Když zůstane všechno při starém, můžete dál míjet příležitosti k pohybu, učení a novým setkáním.',
        'Vyberte si konkrétní další krok. U událostí a výuky uvidíte skutečné ceny či podmínky před závaznou rezervací.'],
    en:['When nothing changes, opportunities to move, learn and meet people may keep passing you by.',
        'Choose one practical next step. Check real event or lesson prices and terms before committing.'],
    ru:['Если ничего не менять, возможности двигаться, учиться и знакомиться могут и дальше проходить мимо.',
        'Выберите конкретный следующий шаг. Реальные цены и условия занятий и событий доступны до обязательной записи.'],
    uk:['Якщо нічого не змінювати, можливості рухатися, навчатися й знайомитися можуть проходити повз.',
        'Оберіть один конкретний наступний крок. Справжні ціни й умови доступні до зобов’язання чи бронювання.']
  };

  var LANGS = ['cs', 'en', 'ru', 'uk'];
  var COPY = {
    cs: {eyebrow:'HISTORIE · ZÁŽITKY · ROZVOJ', title:'Co vám dnes',title2:'chybí?',lead:'Chtěli byste více přátel, pohybu, zážitků nebo nových dovedností? Začněte tím, co chcete změnit — ne seznamem služeb.',button:'Vybrat zážitek',under:'JEDNO MÍSTO. MNOHO MOŽNOSTÍ.',dir1:'⚔️ Příběhy a pohyb',dir2:'🥾 Zážitky a setkání',dir3:'🎓 Učení a výsledky',calendarEyebrow:'KALENDÁŘ AKCÍ',calendarTitle:'Nadcházející akce a tréninky',calendarIntro:'Klikněte na den v kalendáři a otevřete podrobnosti, cenu a přihlášku.',all:'Vše',club:'Šerm a historie',walkers:'Výlety a hry',academy:'Jazyky a příprava',loading:'Načítáme aktuální veřejné akce…',offline:'Aktuální seznam se nepodařilo ověřit. Nespoléhejte na staré termíny.',empty:'Na tento měsíc nejsou zveřejněny dostupné akce v této kategorii.',errorTitle:'Termíny zatím nelze ověřit',emptyTitle:'Najděte další příležitost',noEventTitle:'Vyberte den s akcí',noEventDesc:'Vyberte označený den a otevřete podrobnosti.',learnTitle:'Připravte se na svůj cíl',learnDesc:'Čeština, jazyky, přijímačky, maturita, přírodní vědy a IT. Individuální termíny řešíme podle vašeho cíle a dostupnosti — bez smyšlených položek v kalendáři.',learnCta:'Vybrat přípravu',open:'Online přihláška otevřena',contact:'Před účastí kontaktujte pořadatele',planned:'Zatím bez potvrzené přihlášky',book:'Požádat o místo',ask:'Ověřit účast',follow:'Sledovat další termíny',price:'Cena bude potvrzena',free:'Zdarma',date:'Kdy',place:'Kde',priceLabel:'Cena',details:'Více informací',notice:'Odeslání přihlášky neznamená potvrzené místo ani platbu. Pořadatel potvrdí účast zvlášť.',photo:'Ilustrační fotografie podobné aktivity',calendarNote:'Časy: Europe/Prague. Veřejné akce jsou z katalogu; pravidelné pondělky jsou pouze orientační a vyžadují písemné potvrzení.',back:'Starší informace',privacy:'Soukromí a bezpečnost',controller:'Organizátora a podmínky ověříte u konkrétní akce.',liveCalendar:'Veřejný kalendář',today:'Dnes',prev:'Předchozí měsíc',next:'Další měsíc',close:'Zavřít podrobnosti akce'},
    en: {eyebrow:'HISTORY · ADVENTURES · LEARNING',title:'What would you',title2:'like to change?',lead:'Missing friends, movement, new experiences or useful skills? Start with what matters to you, not a catalogue of services.',button:'Explore the calendar',under:'ONE PLACE. ENDLESS POSSIBILITIES.',dir1:'⚔️ Stories in motion',dir2:'🥾 Adventures together',dir3:'🎓 Learn and achieve',calendarEyebrow:'EVENT CALENDAR',calendarTitle:'Upcoming events and training',calendarIntro:'Tap an event day to open its details, price and booking options.',all:'Everything',club:'Fencing & history',walkers:'Hikes & games',academy:'Languages & exams',loading:'Loading approved public events…',offline:'We could not verify the latest event list. Please do not rely on outdated dates.',empty:'There are no published available events in this category this month.',errorTitle:'Dates cannot be verified',emptyTitle:'Discover another opportunity',noEventTitle:'Choose an event day',noEventDesc:'Select a highlighted day to open event details.',learnTitle:'Move toward your goal',learnDesc:'Czech, languages, entrance exams, school subjects, biology, chemistry and IT. One-to-one lesson times are arranged individually; we do not invent calendar availability.',learnCta:'Explore learning options',open:'Online request available',contact:'Contact organiser before attending',planned:'Not open for confirmed registration',book:'Request a place',ask:'Check availability',follow:'Follow new dates',price:'Price to confirm',free:'Free',date:'When',place:'Where',priceLabel:'Price',details:'About this activity',notice:'Submitting an enquiry does not confirm a place or payment. The organiser confirms attendance separately.',photo:'Illustrative photo from a similar activity',calendarNote:'Times: Europe/Prague. Real events come from the public catalogue; Monday recurring slots are tentative and require written confirmation.',back:'More information',privacy:'Privacy and safety',controller:'Organiser and full terms are confirmed per event.',liveCalendar:'Public calendar',today:'Today',prev:'Previous month',next:'Next month',close:'Close event details'},
    ru: {eyebrow:'ИСТОРИЯ · ПРИКЛЮЧЕНИЯ · РАЗВИТИЕ',title:'Чего вам',title2:'не хватает?',lead:'Больше общения, движения, приключений или новых навыков? Начните с задачи, которую хотите решить, а не с перечня услуг.',button:'Выбрать событие',under:'ОДНА ПЛОЩАДКА. МНОЖЕСТВО ВОЗМОЖНОСТЕЙ.',dir1:'⚔️ История и движение',dir2:'🥾 Приключения и люди',dir3:'🎓 Учёба и результат',calendarEyebrow:'КАЛЕНДАРЬ СОБЫТИЙ',calendarTitle:'Ближайшие события и тренировки',calendarIntro:'Нажми на день, чтобы открыть описание, цену и запись.',all:'Все события',club:'Фехтование и история',walkers:'Походы и игры',academy:'Языки и экзамены',loading:'Загружаем подтверждённые публичные мероприятия…',offline:'Не удалось проверить актуальные даты. Не используйте устаревшее расписание.',empty:'На этот месяц нет опубликованных доступных событий этой категории.',errorTitle:'Даты пока недоступны',emptyTitle:'Найди следующую возможность',noEventTitle:'Выбери день с событием',noEventDesc:'Нажми дату с иконкой, чтобы открыть подробности.',learnTitle:'Подготовься к своей цели',learnDesc:'Чешский и другие языки, вступительные экзамены, школьные предметы, биология, химия и IT. Время индивидуальных занятий согласуется отдельно; мы не придумываем свободные слоты.',learnCta:'Выбрать подготовку',open:'Открыта онлайн-заявка',contact:'Участие по согласованию',planned:'Запись пока не подтверждена',book:'Запросить место',ask:'Уточнить участие',follow:'Следить за новыми датами',price:'Цена уточняется',free:'Бесплатно',date:'Когда',place:'Где',priceLabel:'Цена',details:'Об активности',notice:'Отправленная заявка не означает подтверждения места или оплаты. Организатор подтвердит участие отдельно.',photo:'Иллюстративное фото похожей активности',calendarNote:'Время: Europe/Prague. События — из публичного каталога; понедельники отмечены как плановые слоты без подтверждённого места.',back:'Подробная информация',privacy:'Конфиденциальность и безопасность',controller:'Организатор и условия уточняются для каждого события.',liveCalendar:'Публичный календарь',today:'Сегодня',prev:'Предыдущий месяц',next:'Следующий месяц',close:'Закрыть описание события'},
    uk: {eyebrow:'ІСТОРІЯ · ПРИГОДИ · РОЗВИТОК',title:'Чого вам',title2:'бракує?',lead:'Більше спілкування, руху, пригод чи корисних навичок? Почніть з мети, яку хочете досягти, а не з переліку послуг.',button:'Обрати подію',under:'ОДИН САЙТ. БАГАТО МОЖЛИВОСТЕЙ.',dir1:'⚔️ Історія і рух',dir2:'🥾 Пригоди та знайомства',dir3:'🎓 Навчання і результат',calendarEyebrow:'КАЛЕНДАР ПОДІЙ',calendarTitle:'Найближчі події та тренування',calendarIntro:'Натисніть на день, щоб відкрити опис, ціну та запис.',all:'Усі події',club:'Фехтування та історія',walkers:'Походи та ігри',academy:'Мови та іспити',loading:'Завантажуємо перевірені публічні події…',offline:'Не вдалося перевірити актуальні дати. Не покладайтеся на старий розклад.',empty:'На цей місяць немає опублікованих доступних подій у цій категорії.',errorTitle:'Дати поки недоступні',emptyTitle:'Знайдіть наступну можливість',noEventTitle:'Оберіть день із подією',noEventDesc:'Натисніть на день із символом, щоб відкрити подробиці.',learnTitle:'Підготуйтеся до своєї мети',learnDesc:'Чеська та інші мови, вступні іспити, шкільні предмети, біологія, хімія й IT. Час індивідуальних занять погоджується окремо; вигаданих вільних слотів немає.',learnCta:'Обрати підготовку',open:'Відкрита онлайн-заявка',contact:'Участь за погодженням',planned:'Запис ще не підтверджений',book:'Запитати про місце',ask:'Уточнити участь',follow:'Стежити за новими датами',price:'Ціну уточнюємо',free:'Безкоштовно',date:'Коли',place:'Де',priceLabel:'Ціна',details:'Про активність',notice:'Надіслана заявка не підтверджує місце або оплату. Організатор підтвердить участь окремо.',photo:'Ілюстративне фото схожої активності',calendarNote:'Час: Europe/Prague. Події — з публічного каталогу; понеділки — попередній план без підтвердженого місця.',back:'Детальні відомості',privacy:'Конфіденційність та безпека',controller:'Організатор і умови уточнюються для кожної події.',liveCalendar:'Публічний календар',today:'Сьогодні',prev:'Попередній місяць',next:'Наступний місяць',close:'Закрити опис події'}
  };

  // Only visible inside the selected paid-event dialog. Never a live checkout or proof of settlement.
  var PAYMENT_COPY = {
    cs:{
      toggle:'Platba a storno podmínky (rozkliknout)',
      contact:'Pro domluvení platby a konečné částky kontaktujte koordinátora ještě před převodem:',
      payee:'Právní pořadatel / příjemce platby',
      notice:'Nesdělujeme veřejně žádné univerzální číslo účtu. Převádějte peníze až po písemném potvrzení pořadatele, termínu, částky a platebních údajů.',
      timing:'Nové přihlášky alespoň 48 hodin před začátkem: základní cena. Při nové přihlášce méně než 48 hodin před začátkem: příplatek +25 % (zaokrouhleno nahoru na celé Kč).',
      cancellation:'Zrušení účastníkem nejméně 48 hodin před začátkem: vrácení 100 % přijaté ceny. Při pozdějším zrušení se běžně cena nevrací.',
      exception:'Platí pro nově sjednané účasti. Dříve písemně potvrzené podmínky a zákonná práva zůstávají zachována. Zruší-li akci pořadatel, vrací přijatou platbu.',
      guard:'Odeslaná přihláška ani PDF o převodu neznamená potvrzenou účast nebo připsání peněz.',
      now:'Orientační cena pro novou přihlášku nyní',base:'základ',unverified:'Cena bude potvrzena individuálně',
      subject:'Dotaz na platbu za akci',message:'Dobrý den, mám zájem o účast na akci',ask:'Prosím o potvrzení konečné ceny, příjemce platby a platebních údajů.'
    },
    en:{
      toggle:'Payment and cancellation terms (tap to open)',
      contact:'To arrange payment and confirm the final total, contact the coordinator before transferring money:',
      payee:'Legal organiser / payment recipient',
      notice:'There is no universal public bank account. Transfer funds only after written confirmation of the organiser, date, total and payment details.',
      timing:'New requests at least 48 hours before the start: base price. New requests less than 48 hours before the start: +25% surcharge (rounded up to whole CZK).',
      cancellation:'Participant cancellation at least 48 hours before the start: 100% refund of the received event fee. Later cancellations are normally non-refundable.',
      exception:'Applies to newly agreed bookings. Earlier written terms and mandatory legal rights remain valid. If the organiser cancels, the payment received is refunded.',
      guard:'Submitting an enquiry or uploading a bank-transfer PDF does not confirm attendance or receipt of funds.',
      now:'Indicative price for a new request now',base:'base',unverified:'Price to be confirmed individually',
      subject:'Event payment enquiry',message:'Hello, I would like to attend',ask:'Please confirm the final price, legal payee and payment details.'
    },
    ru:{
      toggle:'Оплата и отмена — открыть условия',
      contact:'Для согласования оплаты и окончательной суммы свяжитесь со мной до перевода:',
      payee:'Юридический организатор / получатель платежа',
      notice:'Единого публичного банковского счёта нет. Переводите деньги только после письменного подтверждения организатора, даты, суммы и реквизитов.',
      timing:'Новая запись за 48 часов или раньше до начала — базовая цена. При новой записи менее чем за 48 часов — доплата +25% (округление вверх до целой Kč).',
      cancellation:'Отмена участником за 48 часов или раньше — возврат 100% полученной оплаты. При более поздней отмене обычно возврата нет.',
      exception:'Правило для новых договорённостей. Ранее письменно согласованные условия и обязательные права по закону сохраняются. При отмене организатором полученную оплату возвращаем.',
      guard:'Заявка и PDF о переводе не означают подтверждённого места или поступления денег.',
      now:'Предварительная цена новой записи сейчас',base:'база',unverified:'Цена подтверждается индивидуально',
      subject:'Вопрос об оплате мероприятия',message:'Здравствуйте, хочу участвовать в мероприятии',ask:'Прошу подтвердить итоговую цену, юридического получателя и реквизиты.'
    },
    uk:{
      toggle:'Оплата та скасування — відкрити умови',
      contact:'Щоб погодити оплату й остаточну суму, зв’яжіться зі мною до переказу:',
      payee:'Юридичний організатор / одержувач платежу',
      notice:'Єдиного публічного банківського рахунку немає. Переказуйте кошти лише після письмового підтвердження організатора, дати, суми та реквізитів.',
      timing:'Нова реєстрація за 48 годин або раніше до початку — базова ціна. При новій реєстрації менш ніж за 48 годин — доплата +25% (округлення вгору до цілої Kč).',
      cancellation:'Скасування учасником за 48 годин або раніше — повернення 100% отриманої оплати. При пізнішому скасуванні зазвичай повернення немає.',
      exception:'Правило для нових домовленостей. Попередні письмові умови та обов’язкові законні права зберігаються. Якщо організатор скасовує подію, отриману оплату повертаємо.',
      guard:'Заявка або PDF про переказ не підтверджує місце чи надходження коштів.',
      now:'Орієнтовна ціна нової заявки зараз',base:'база',unverified:'Ціна узгоджується індивідуально',
      subject:'Запит про оплату заходу',message:'Вітаю, хочу взяти участь у заході',ask:'Прошу підтвердити кінцеву ціну, законного отримувача та платіжні реквізити.'
    }
  };
  function pc(k){return (PAYMENT_COPY[lang]||PAYMENT_COPY.cs)[k];}
  function isPaidActivity(e){return e&&Number.isFinite(Number(e.price_czk))&&Number(e.price_czk)>0;}
  function displayEventPrice(e){
    if(e.provisional)return window.ImperionCalendarPolicy.langData(lang).price;
    if(e.price_verified!==true||e.price_czk===null||e.price_czk===undefined||e.price_czk==='')return tr('price');
    var base=Number(e.price_czk);
    if(!Number.isFinite(base)||base<0)return tr('price');
    if(base===0)return tr('free');
    // Price is indicative for a NEW enquiry only; earlier contracted rates are preserved.
    var late=Date.parse(e.begins_at)-Date.now()<48*60*60*1000;
    return late ? pc('now')+': '+(base+Math.ceil(base*.25))+' Kč ('+pc('base')+' '+base+' Kč, +25 %)' : base+' Kč';
  }
  function updatePaymentDetails(e){
    var box=el('fdPaymentTerms');box.open=false;
    box.hidden=!isPaidActivity(e);
    if(box.hidden)return;
    el('fdPaymentSummary').textContent=pc('toggle');
    el('fdPaymentContactIntro').textContent=pc('contact');
    el('fdPaymentPayee').textContent=pc('payee')+': '+(e.data_controller||tr('controller'));
    el('fdPaymentEventRef').textContent='ID: '+e.event_id;
    el('fdPaymentTiming').textContent=pc('timing');
    el('fdPaymentCancellation').textContent=pc('cancellation');
    el('fdPaymentException').textContent=pc('exception');
    el('fdPaymentNotice').textContent=pc('notice');
    el('fdPaymentGuard').textContent=pc('guard');
    // An event ID is mandatory and validated from the existing public catalogue.
    var message=pc('message')+' "'+publicTitle(e)+'" (ID: '+e.event_id+'). '+pc('ask');
    el('fdPaymentEmail').href='mailto:chereshnev.biochem@gmail.com?subject='+encodeURIComponent(pc('subject')+' '+e.event_id)+'&body='+encodeURIComponent(message);
    el('fdPaymentWhatsApp').href='https://wa.me/420702914842?text='+encodeURIComponent(message);
    el('fdPaymentTelegram').href='https://t.me/Chareshneu';
  }
  /* Small navigation and two focused customer paths (no extra tracking). */
  var FRONT_COPY = {
    cs:{home:'Úvod',events:'Akce',academyNav:'Akademie',clubNav:'Družina',walkersNav:'BrnoWalkers',about:'O mně',heroEvents:'Vybrat akci',heroTypes:'Družina · BrnoWalkers',heroAcademy:'Vybrat svůj cíl',academyNote:'Jazyky · pohyb · škola · život v Česku',city:'Město',cityAll:'Všechna místa',cityBrno:'Brno',cityPrague:'Praha',cityOther:'Ostatní / upřesníme',cityEmpty:'Pro zvolené místo a období zatím není zveřejněna potvrzená akce.',moreDates:'další',menu:'Navigace'},
    en:{home:'Home',events:'Events',academyNav:'Academy',clubNav:'Družina',walkersNav:'BrnoWalkers',about:'About',heroEvents:'Choose an event',heroTypes:'Družina · BrnoWalkers',heroAcademy:'Choose your learning goal',academyNote:'Languages · movement · school · Czechia',city:'City',cityAll:'All places',cityBrno:'Brno',cityPrague:'Prague',cityOther:'Other / to confirm',cityEmpty:'No verified published events for this place and month yet.',moreDates:'more',menu:'Navigation'},
    ru:{home:'Главная',events:'События',academyNav:'Академия',clubNav:'Дружина',walkersNav:'BrnoWalkers',about:'Обо мне',heroEvents:'Выбрать событие',heroTypes:'Дружина · BrnoWalkers',heroAcademy:'Найти решение своей задачи',academyNote:'Языки · движение · школа · жизнь в Чехии',city:'Город',cityAll:'Все города',cityBrno:'Брно',cityPrague:'Прага',cityOther:'Другие / уточняется',cityEmpty:'В выбранном городе в этом месяце пока нет проверенных опубликованных мероприятий.',moreDates:'ещё',menu:'Навигация'},
    uk:{home:'Головна',events:'Події',academyNav:'Академія',clubNav:'Дружина',walkersNav:'BrnoWalkers',about:'Про мене',heroEvents:'Обрати подію',heroTypes:'Дружина · BrnoWalkers',heroAcademy:'Знайти рішення своєї задачі',academyNote:'Мови · рух · школа · життя в Чехії',city:'Місто',cityAll:'Усі міста',cityBrno:'Брно',cityPrague:'Прага',cityOther:'Інші / уточнюється',cityEmpty:'Для обраного міста й місяця поки немає перевірених опублікованих подій.',moreDates:'ще',menu:'Навігація'}
  };
  function ft(k){return (FRONT_COPY[lang]||FRONT_COPY.cs)[k]||FRONT_COPY.en[k]||k;}
  var paths = {club:'druzina/',walkers:'walkers/',academy:'academy/'};
  var query = new URLSearchParams(location.search);
  var requested = query.get('lang');
  // A bare homepage URL must always start in Czech. Explicit ?lang=XX still wins.
  // Do not infer page language from a stale saved preference on a previous visit.
  var lang = LANGS.indexOf(requested)>=0 ? requested : 'cs';
  var data=[], status='loading', filter=['club','walkers','academy'].includes(query.get('category'))?query.get('category'):'all', city='all', selectedId='', chosenDay='', month=new Date(), pending=false;
  var modalShown=false, modalDay='';
  var tzFormatter = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'});
  function tr(k){return COPY[lang][k]||COPY.en[k]||k;}
  function el(id){return document.getElementById(id);}
  function openEventModal(day){
    if(!day || !eventsForDay(day).length)return;
    modalShown=true;modalDay=day;
    el('fdOverlay').hidden=false;el('fdDetails').hidden=false;
    document.body.classList.add('fd-modal-open');
    el('fdDetails').scrollTop=0;
    el('fdClose').focus();
    sendSignal('event_detail_open','calendar');
  }
  function closeEventModal(restoreFocus){
    if(!modalShown)return;
    modalShown=false;
    el('fdOverlay').hidden=true;el('fdDetails').hidden=true;
    document.body.classList.remove('fd-modal-open');
    var day=modalDay;modalDay='';
    if(restoreFocus!==false){
      var buttons=Array.from(el('fdDays').querySelectorAll('button'));
      var target=buttons.find(function(b){return (b.getAttribute('aria-label')||'').slice(0,10)===day;});
      if(target)target.focus();
    }
  }
  function sendSignal(name,placement) {
    document.dispatchEvent(new CustomEvent('ecosystem:conversion',{detail:{name:name,page:'home',language:lang,placement:placement}}));
  }
  var html = [
    '<div id="imperion-frontdoor">',
    '<header class="fd-header"><div class="fd-shell fd-header-inner">',
      '<a class="fd-logo" href="#imperion-frontdoor"><span class="fd-logo-mark" aria-hidden="true">⚔</span><span class="fd-logo-text"><strong>IMPERION</strong><small>HISTORIE · ZÁŽITKY · ROZVOJ</small></span></a>',
      '<nav class="fd-nav" id="fdNav" aria-label="Primary navigation">',
      '<a id="fdNavHome" href="#imperion-frontdoor"></a><a id="fdNavEvents" href="#impr-calendar"></a><a id="fdNavAcademy" href="academy/"></a>',
      '<a id="fdNavClub" href="druzina/"></a><a id="fdNavWalkers" href="walkers/"></a><a id="fdNavAbout" href="about/?lang=cs"></a>',
      '</nav>',
      '<div class="fd-languages" aria-label="Language">',
      '<button type="button" data-fd-language="cs">CZ</button><button type="button" data-fd-language="en">EN</button><button type="button" data-fd-language="ru">RU</button><button type="button" data-fd-language="uk">UA</button>',
      '</div></div></header>',
    '<main>',
      '<section class="fd-hero" aria-label="Welcome">',
        '<div class="fd-mosaic fd-photo-shadows" aria-hidden="true"></div>',
        '<div class="fd-shell fd-hero-inner">',
          '<div class="fd-eyebrow" id="fdEyebrow"></div>',
          '<h1><span id="fdHero1" style="color:#fffdf3"></span> <span id="fdHero2"></span></h1>',
          '<p class="fd-lede" id="fdLead"></p>',
          '<p class="fd-value-now" id="fdValueNow"></p>',
          '<p class="fd-value-then" id="fdValueThen"></p>',
          '<div class="fd-hero-actions">',
          '<a class="fd-hero-cta" id="fdHeroCta" href="#impr-calendar"><span aria-hidden="true">▦</span><span class="fd-hero-cta-copy"><strong id="fdHeroLabel"></strong><small id="fdHeroSub"></small></span></a>',
          '<a class="fd-hero-academy" id="fdAcademyCta" href="academy/?lang=cs"><span class="fd-academy-symbol" aria-hidden="true">🎓</span><span class="fd-academy-copy"><strong id="fdAcademyLabel"></strong><small id="fdAcademyNote"></small></span></a>',
          '</div>',
          '<div class="fd-hero-topics" aria-hidden="true"><span id="fdDir1"></span><span id="fdDir2"></span><span id="fdDir3"></span></div>',
        '</div>',
        '<div class="fd-hero-bottom" id="fdUnder"></div>',
      '</section>',
      '<section class="fd-section" id="impr-calendar" tabindex="-1">',
        '<div class="fd-shell">',
          '<div class="fd-topline"><div><div class="fd-eyebrow" id="fdCalEyebrow"></div><h2 id="fdCalTitle"></h2></div><p id="fdCalIntro"></p></div>',
          '<aside class="fd-nearest-event" id="fdNearestEvent" aria-live="polite" aria-label="Next verified public event"><div class="fd-nearest-copy"><span id="fdNearestEyebrow"></span><strong id="fdNearestTitle"></strong><span id="fdNearestWhen"></span></div><div class="fd-nearest-actions"><a id="fdNearestBook" href="#impr-calendar"></a><button type="button" id="fdNearestMore"></button></div></aside>',
          '<div class="fd-stage">',
          '<aside class="fd-facet-panel" aria-label="Event filters">',
          '<div class="fd-facet-head"><span aria-hidden="true">⚑</span><strong id="fdFacetTitle"></strong></div>',
          '<div class="fd-filters" role="group" aria-label="Activities">',
          '<button type="button" data-fd-filter="all"></button><button type="button" data-fd-filter="club"></button><button type="button" data-fd-filter="walkers"></button><button type="button" data-fd-filter="academy"></button></div>',
          '<div class="fd-city-filter"><span id="fdCityHeading"></span><div class="fd-city-options" role="group" aria-label="City">',
          '<button type="button" data-fd-city="all"></button><button type="button" data-fd-city="brno"></button><button type="button" data-fd-city="prague"></button><button type="button" data-fd-city="other"></button>',
          '</div></div>',
          '<button class="fd-reset" id="fdReset" type="button"></button>',
          '</aside>',
          '<div class="fd-calendar-layout">',
            '<div class="fd-calendar-pane">',
              '<div class="fd-calendar-nav"><button type="button" id="fdPrev" aria-label="Previous month">‹</button><h3 id="fdMonth"></h3><button type="button" id="fdNext" aria-label="Next month">›</button></div>',
              '<div class="fd-weekdays" id="fdWeekdays"></div><div class="fd-days" id="fdDays" role="group" aria-label="Event dates"></div>',
              '<p class="fd-cal-note" id="fdCalNote"></p>',
              '<div class="fd-calendar-fallback" id="fdFallback" hidden><p id="fdFallbackHint"></p><a id="fdFallbackLink" href="academy/"></a></div>',
            '</div>',
            '</div>',
            '<aside class="fd-upcoming-pane" aria-labelledby="fdUpcomingTitle"><h3 id="fdUpcomingTitle"></h3><p id="fdUpcomingIntro"></p><div class="fd-upcoming-list" id="fdUpcoming"></div></aside>',
            '</div>',
            '<section class="fd-all-section" aria-labelledby="fdAllTitle"><div class="fd-all-head"><h3 id="fdAllTitle"></h3><p id="fdAllIntro"></p></div><div class="fd-all-list" id="fdAllList" role="list"></div></section>',
            '<div class="fd-modal-backdrop" id="fdOverlay" hidden></div>',
            '<aside class="fd-detail-pane fd-modal" id="fdDetails" role="dialog" aria-modal="true" aria-labelledby="fdEventTitle" tabindex="-1" hidden>',
              '<button class="fd-modal-close" type="button" id="fdClose" aria-label="Close event details">×</button>',
              '<div class="fd-photo"><img id="fdPhoto" src="images/main_hero.webp" alt="" loading="lazy"><span class="fd-photo-tag" id="fdPhotoTag"></span></div>',
              '<div class="fd-detail-content"><p class="fd-meta" id="fdEventMeta"></p><h3 id="fdEventTitle"></h3><p class="fd-description" id="fdEventDesc"></p>',
              '<div class="fd-event-variants" id="fdVariants" hidden></div><div class="fd-facts" id="fdFacts"></div>',
              '<div class="fd-status" id="fdStatus" hidden></div>',
              '<details class="fd-payment-terms" id="fdPaymentTerms" hidden><summary id="fdPaymentSummary"></summary><div class="fd-payment-body">',
              '<p id="fdPaymentContactIntro"></p><nav class="fd-payment-links" id="fdPaymentContacts" aria-label="Payment contact methods">',
              '<a id="fdPaymentEmail" href="mailto:chereshnev.biochem@gmail.com">Email</a>',
              '<a id="fdPaymentWhatsApp" href="https://wa.me/420702914842" target="_blank" rel="noopener noreferrer">WhatsApp</a>',
              '<a id="fdPaymentTelegram" href="https://t.me/Chareshneu" target="_blank" rel="noopener noreferrer">Telegram</a>',
              '</nav><p id="fdPaymentEventRef"></p><p id="fdPaymentPayee"></p><p id="fdPaymentTiming"></p><p id="fdPaymentCancellation"></p>',
              '<p id="fdPaymentException"></p><p id="fdPaymentNotice"></p><p id="fdPaymentGuard"></p></div></details>',
              '<div class="fd-actions"><a class="fd-book" id="fdBook" href="register/"></a><a class="fd-info" id="fdMore" href="calendar/"></a></div></div>',
            '</aside>',
          '<p class="fd-cal-note" id="fdNotice" style="margin-top:19px"></p>',
        '</div>',
      '</section>',
    '</main>',
    '<footer class="fd-footer"><div class="fd-shell fd-footer-inner"><span>© 2026 · Družina Moravy, z. s. · BrnoWalkers · Aliaksei Chareshneu OSVČ</span>',
    '<div class="fd-footer-links"><a href="calendar/" id="fdFooterCalendar"></a><a href="register/privacy/" id="fdFooterPrivacy"></a><a href="academy/" id="fdFooterInfo"></a></div></div></footer>',
    '</div>'
  ].join('');
  document.body.insertAdjacentHTML('afterbegin',html);
  var parent=el('imperion-frontdoor');
  function label(id,key){el(id).textContent=tr(key);}
  function hrefForEvent(e) {
    // Attribute visitors who intentionally selected the quick BrnoWalkers route;
    // never accept an arbitrary source value from the URL.
    var source = query.get('src') === 'frontdoor_fast_walkers' && filter === 'walkers'
      ? 'frontdoor_fast_walkers' : 'frontdoor_calendar';
    var params = new URLSearchParams({lang:lang,event:e.event_id,src:source});
    ['utm_source','utm_medium','utm_campaign'].forEach(function(key) {
      var value = query.get(key);
      if (value && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) params.set(key, value);
    });
    return 'register/?' + params.toString();
  }
  function dayKey(iso){
    var d=new Date(iso);
    if (!Number.isFinite(d.getTime()))return '';
    var parts=tzFormatter.formatToParts(d),p={};
    parts.forEach(function(x){p[x.type]=x.value;});
    return p.year+'-'+p.month+'-'+p.day;
  }
  function mode(e) {
    if (!e||e.provisional) return 'planned';
    if(e.registration_mode==='CONTACT')return 'contact';
    if(e.registration_mode==='FORM' && e.is_open===true && e.price_verified===true && e.end_time_verified===true && Date.parse(e.begins_at)>Date.now()) return 'open';
    return 'planned';
  }
  function group(e) {
    var s=[e.community,e.category,e.title].join(' ').toLocaleLowerCase();
    if(/academy|education|language|course|tutor|exam|příprav|priprаv|výuka|vyuka|češtin|cestin|lekce/.test(s))return 'academy';
    if(/družin|druzin|hema|šerm|serm|fenc|larp|historick|archery|lukostřel/.test(s))return 'club';
    return 'walkers';
  }
  function publicTitle(e){
    if(e.provisional)return window.ImperionCalendarPolicy.langData(lang).title;
    if(e.event_id==='PUB-OREL-20261114')return ({cs:'Šerm pro začátečníky · bezplatný workshop',en:'Try historical fencing · free workshop',ru:'Попробуй фехтование · бесплатный воркшоп',uk:'Спробуйте фехтування · безплатний воркшоп'})[lang];
    if(e.category==='HEMA Training' && group(e)==='club')return ({cs:'Historický šerm · Družina Moravy',en:'Historical fencing · Družina Moravy',ru:'Историческое фехтование · Družina Moravy',uk:'Історичне фехтування · Družina Moravy'})[lang];
    return e.title;
  }
  function publicDescription(e){
    if(e.provisional)return window.ImperionCalendarPolicy.langData(lang).detail;
    if(e.event_id==='PUB-OREL-20261114')return ({cs:'Úvodní workshop v Orlovně Husovice. Vstup zdarma, účast až po osobním potvrzení organizátorem.',en:'Introductory workshop at Orlovna Husovice. Free entry, attendance only after personal confirmation.',ru:'Вводный воркшоп в Orlovna Husovice. Бесплатно, участие только после личного подтверждения организатора.',uk:'Вступний воркшоп в Orlovna Husovice. Безплатно, участь лише після особистого підтвердження.'})[lang];
    if(e.category==='HEMA Training' && group(e)==='club')return ({cs:'Pohyb, historický šerm a společný trénink. Bezpečné místo a účast vždy potvrdí organizátor.',en:'Movement, historical fencing and group training. The organiser must confirm the safe venue and your place.',ru:'Движение, историческое фехтование и тренировка в группе. Место и участие организатор подтверждает лично.',uk:'Рух, історичне фехтування та групове тренування. Безпечне місце й участь організатор підтверджує особисто.'})[lang];
    return typeof e.public_note==='string'&&e.public_note.trim()?e.public_note.slice(0,330):tr('controller');
  }
  function publicVenue(e){
    if(e.provisional)return 'Brno · '+window.ImperionCalendarPolicy.langData(lang).status;
    if(e.category==='HEMA Training' && group(e)==='club' && e.event_id!=='PUB-OREL-20261114')
      return ({cs:'Brno · přesný sraz až po potvrzení',en:'Brno · exact location after confirmation',ru:'Брно · место сообщим после подтверждения',uk:'Брно · місце після підтвердження'})[lang];
    return e.venue||tr('controller');
  }
  function icon(e){
    var s=[e.category,e.title].join(' ').toLowerCase();
    if(/board|deskov|настол|hry/.test(s))return '🎲';
    if(/archery|luk|стрель|bow/.test(s))return '🏹';
    if(/hema|šerm|serm|fenc|training|trénink|trenink/.test(s))return '⚔️';
    if(/larp|histor|reconstruct/.test(s))return '🛡️';
    if(/canoe|raft|splav|лод/.test(s))return '🛶';
    if(group(e)==='academy')return '🎓';
    if(group(e)==='walkers')return '🥾';
    return '📅';
  }
  
  function eventCity(e){
    // Treat an unstated city as OTHER, never invent Prague inventory.
    var declared=String(e.city||e.location_city||'').trim();
    var place=declared||String(e.venue||'');
    if(/praha|praze|prahy|prague|praž|prag\b/i.test(place))return 'prague';
    if(/\bbrno\b|\bbrně\b|\bbrna\b|husovice|obřany|obrany|zbrojovka|jurkovičov|malinovsk|dům umění města brna|dum umeni mesta brna|červený kopec|cerveny kopec|bílovice|bilovice/i.test(place))return 'brno';
    // Current club training venue is not exposed until individual confirmation,
    // but the confirmed operating city is Brno (existing publicVenue function).
    if(e.category==='HEMA Training'&&group(e)==='club')return 'brno';
    return 'other';
  }
  function matches(e){return (filter==='all'||group(e)===filter)&&(city==='all'||eventCity(e)===city);}
  function isSuppressed(e){
    var date=String(e.begins_at||'').slice(0,10);
    // Owner decision: regular Saturday HEMA is suspended from 7 Nov until separately reinstated.
    // Free Orel 14 Nov is a distinct approved workshop, not a regular Saturday session.
    var clubSaturday=e.category==='HEMA Training'&&group(e)==='club'&&e.event_id!=='PUB-OREL-20261114'&&new Date(e.begins_at).getUTCDay()===6;
    return clubSaturday||date==='2026-11-15'||date==='2026-11-17'||e.event_id==='BW-PAID-20261028'||e.event_id==='COM-HIKE-20261028';
  }
  function displayData(y,m){
    // Fail closed while public catalogue is loading or unavailable; no synthetic events.
    if(status!=='ready')return data;
    var policy=window.ImperionCalendarPolicy;
    // Planned Mondays never enter public API catalogue and cannot be reserved online.
    var previews=policy?policy.forMonth(y,m,data):[];
    return data.concat(previews);
  }
  function eventsForDay(key){
    var y=Number(key.slice(0,4)),m=Number(key.slice(5,7))-1;
    return displayData(y,m).filter(function(e){return dayKey(e.begins_at)===key&&matches(e);}).sort(function(a,b){return Date.parse(a.begins_at)-Date.parse(b.begins_at);});
  }
  function locale(){return ({cs:'cs-CZ',en:'en-GB',ru:'ru-RU',uk:'uk-UA'})[lang]||'cs-CZ';}
  function timeOf(e){
    return new Intl.DateTimeFormat(locale(),{timeZone:'Europe/Prague',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(e.begins_at));
  }
  var EDITORIAL = {
    cs:{facet:'Filtrovat',upcoming:'Akce v tomto měsíci',upcomingIntro:'Kliknutím otevřete popis, cenu a přihlášku.',reset:'Zrušit filtry',none:'Žádné potvrzené veřejné termíny pro zvolený výběr.',allTitle:'Všechny nadcházející akce',allIntro:'Pouze následujících 30 dní · ověřené veřejné akce, podrobnosti a přihláška.'},
    en:{facet:'Filter events',upcoming:'Events this month',upcomingIntro:'Select an event for details, price and enquiry.',reset:'Clear filters',none:'No verified public dates for this selection.',allTitle:'All upcoming events',allIntro:'Next 30 days only · verified public dates, details and requests.'},
    ru:{facet:'Фильтры',upcoming:'События месяца',upcomingIntro:'Нажмите на событие, чтобы увидеть цену и запись.',reset:'Сбросить фильтры',none:'Для выбранных фильтров нет подтверждённых публичных дат.',allTitle:'Все предстоящие события',allIntro:'Только ближайшие 30 дней · проверенные даты, описание и запись.'},
    uk:{facet:'Фільтри',upcoming:'Події цього місяця',upcomingIntro:'Натисніть, щоб побачити ціну, опис і запис.',reset:'Скинути фільтри',none:'Для вибраних фільтрів немає підтверджених дат.',allTitle:'Усі найближчі події',allIntro:'Лише найближчі 30 днів · перевірені дати, опис та запис.'}
  };
  function ed(k){return (EDITORIAL[lang]||EDITORIAL.cs)[k];}
  function activateFromList(e){
    // Open the exact event, including an event outside the month currently shown.
    var key=dayKey(e.begins_at);
    month=new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1);
    chosenDay=key;selectedId=e.event_id;
    render();openEventModal(key);
  }
  function renderUpcoming(){
    var pane=el('fdUpcoming');pane.replaceChildren();
    if(status==='loading'){var loading=document.createElement('p');loading.className='fd-upcoming-empty';loading.textContent=tr('loading');pane.appendChild(loading);return;}
    var m=month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0');
    // Only verified catalogue entries appear in the upcoming EVENTS sidebar.
    var candidates=data.filter(function(e){return matches(e)&&dayKey(e.begins_at).slice(0,7)===m;}).slice(0,5);
    if(!candidates.length){var none=document.createElement('p');none.className='fd-upcoming-empty';none.textContent=status==='error'?tr('offline'):ed('none');pane.appendChild(none);return;}
    candidates.forEach(function(e){
      var btn=document.createElement('button');btn.className='fd-upcoming-event';btn.type='button';
      btn.setAttribute('aria-label',timeOf(e)+' · '+publicTitle(e));
      var head=document.createElement('span');head.className='fd-upcoming-type';head.textContent=icon(e)+' '+(group(e)==='club'?tr('club'):group(e)==='walkers'?tr('walkers'):tr('academy'));
      var name=document.createElement('strong');name.textContent=publicTitle(e);
      var when=document.createElement('time');when.dateTime=e.begins_at;when.textContent=timeOf(e);
      var foot=document.createElement('span');foot.className='fd-upcoming-foot';foot.appendChild(when);
      var dot=document.createElement('span');dot.textContent=' · '+(eventCity(e)==='prague'?ft('cityPrague'):eventCity(e)==='brno'?ft('cityBrno'):ft('cityOther'));foot.appendChild(dot);
      btn.appendChild(head);btn.appendChild(name);btn.appendChild(foot);
      btn.addEventListener('click',function(){activateFromList(e);});
      pane.appendChild(btn);
    });
  }
  function renderAllEvents(){
    var list=el('fdAllList');list.replaceChildren();
    if(status!=='ready'){
      var notice=document.createElement('p');notice.className='fd-all-empty';
      notice.textContent=status==='loading'?tr('loading'):tr('offline');
      list.appendChild(notice);return;
    }
    // The illustrated event list is a verified catalogue, not a feed of tentative recurring slots.
    var limit=Date.now()+30*86400000;
    var upcoming=data.filter(matches).filter(function(e){var at=Date.parse(e.begins_at);return Number.isFinite(at)&&at>=Date.now()&&at<=limit;});
    if(!upcoming.length){
      var none=document.createElement('p');none.className='fd-all-empty';none.textContent=ed('none');
      list.appendChild(none);return;
    }
    upcoming.forEach(function(e){
      var item=document.createElement('div');item.className='fd-all-item';item.setAttribute('role','listitem');
      var btn=document.createElement('button');btn.type='button';btn.className='fd-all-event';
      btn.setAttribute('aria-label',timeOf(e)+' · '+publicTitle(e)+' · '+displayEventPrice(e));
      var photo=document.createElement('img');photo.className='fd-all-photo';
      photo.src=({club:'images/druzina_train.webp',walkers:'images/walkers_group.webp',academy:'images/portrait_face.webp'})[group(e)]||'images/main_hero.webp';
      photo.alt=tr('photo');photo.width=118;photo.height=84;photo.loading='lazy';photo.decoding='async';
      var copy=document.createElement('span');copy.className='fd-all-copy';
      var meta=document.createElement('span');meta.className='fd-all-meta';
      var time=document.createElement('time');time.dateTime=e.begins_at;time.textContent=timeOf(e);
      var category=document.createElement('span');category.textContent=icon(e)+' '+(group(e)==='club'?tr('club'):group(e)==='walkers'?tr('walkers'):tr('academy'));
      meta.appendChild(time);meta.appendChild(category);
      var title=document.createElement('strong');title.textContent=publicTitle(e);
      var foot=document.createElement('span');foot.className='fd-all-foot';foot.textContent=publicVenue(e)+' · '+displayEventPrice(e);
      var arrow=document.createElement('span');arrow.className='fd-all-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
      copy.appendChild(meta);copy.appendChild(title);copy.appendChild(foot);
      btn.appendChild(photo);btn.appendChild(copy);btn.appendChild(arrow);item.appendChild(btn);list.appendChild(item);
      btn.addEventListener('click',function(){activateFromList(e);});
    });
  }
  function shortTime(e){
    return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(e.begins_at));
  }
  function applyLanguage() {
    document.documentElement.lang=lang;
    document.title=({
      cs:'IMPERION · Zážitky, výuka a akce v Brně',
      en:'IMPERION · Experiences, lessons and events in Brno',
      ru:'IMPERION · События, занятия и приключения в Брно',
      uk:'IMPERION · Події, заняття та пригоди в Брно'
    })[lang]||'IMPERION · Brno';
    [['fdEyebrow','eyebrow'],['fdHero1','title'],['fdHero2','title2'],['fdLead','lead'],['fdUnder','under'],['fdDir1','dir1'],['fdDir2','dir2'],['fdDir3','dir3'],['fdCalEyebrow','calendarEyebrow'],['fdCalTitle','calendarTitle'],['fdCalIntro','calendarIntro'],['fdCalNote','calendarNote'],['fdNotice','notice'],['fdFooterCalendar','liveCalendar'],['fdFooterPrivacy','privacy'],['fdFooterInfo','back']].forEach(function(pair){label(pair[0],pair[1]);});
    el('fdValueNow').textContent=VALUE_HOME[lang][0];
    el('fdValueThen').textContent=VALUE_HOME[lang][1];
    [['fdHeroLabel','heroEvents'],['fdHeroSub','heroTypes'],['fdAcademyLabel','heroAcademy'],['fdAcademyNote','academyNote'],
      ['fdNavHome','home'],['fdNavEvents','events'],['fdNavAcademy','academyNav'],['fdNavClub','clubNav'],
      ['fdNavWalkers','walkersNav'],['fdNavAbout','about'],['fdCityHeading','city']].forEach(function(pair){el(pair[0]).textContent=ft(pair[1]);});
    // The last footer link now opens the dedicated About page, not the legacy details view.
    el('fdFooterInfo').textContent=ft('about');
    // The Academy landing page and catalogue both support CS/EN/RU/UK.
    el('fdAcademyCta').href='academy/?lang='+encodeURIComponent(lang);
    [['fdNavAcademy','academy/'],['fdNavClub','druzina/'],['fdNavWalkers','walkers/']].forEach(function(pair){el(pair[0]).href=pair[1]+'?lang='+encodeURIComponent(lang);});
    el('fdNavAbout').href='about/?lang='+encodeURIComponent(lang);
    [['fdFacetTitle','facet'],['fdUpcomingTitle','upcoming'],['fdUpcomingIntro','upcomingIntro'],['fdAllTitle','allTitle'],['fdAllIntro','allIntro'],['fdReset','reset']].forEach(function(pair){el(pair[0]).textContent=ed(pair[1]);});
    parent.querySelectorAll('[data-fd-city]').forEach(function(btn){btn.textContent=ft('city'+btn.dataset.fdCity.charAt(0).toUpperCase()+btn.dataset.fdCity.slice(1));});
    parent.querySelectorAll('[data-fd-language]').forEach(function(btn){btn.setAttribute('aria-pressed',String(btn.dataset.fdLanguage===lang));});
    parent.querySelectorAll('[data-fd-filter]').forEach(function(btn){btn.textContent=tr(btn.dataset.fdFilter==='club'?'club':btn.dataset.fdFilter==='walkers'?'walkers':btn.dataset.fdFilter==='academy'?'academy':'all');});
    el('fdPrev').setAttribute('aria-label',tr('prev'));el('fdNext').setAttribute('aria-label',tr('next'));
    el('fdPhotoTag').textContent=tr('photo');
    el('fdClose').setAttribute('aria-label',tr('close'));
    render();
  }
  function setDetailEmpty(isError) {
    el('fdPhoto').src='images/main_hero.webp';
    el('fdEventMeta').textContent=tr('eyebrow');
    el('fdEventTitle').textContent=isError?tr('errorTitle'):(filter==='academy'?tr('learnTitle'):(status==='ready'?tr('emptyTitle'):tr('noEventTitle')));
    el('fdEventDesc').textContent=isError?tr('offline'):(filter==='academy'?tr('learnDesc'):(status==='loading'?tr('loading'):(data.length?tr('noEventDesc'):tr('empty'))));
    el('fdFacts').replaceChildren();el('fdStatus').hidden=true;
    el('fdPaymentTerms').hidden=true;el('fdPaymentTerms').open=false;
    el('fdVariants').hidden=true;el('fdVariants').replaceChildren();
    el('fdBook').textContent=filter==='academy'?tr('learnCta'):tr('liveCalendar');
    el('fdBook').href=filter==='academy'?'academy/':'calendar/';
    el('fdMore').textContent=tr('details');el('fdMore').href=filter==='academy'?'academy/':'walkers/';
  }
  function renderDetail(key) {
    var opts=eventsForDay(key);
    if(!opts.length){setDetailEmpty(status==='error');return;}
    var event=opts.find(function(e){return e.event_id===selectedId;})||opts[0];selectedId=event.event_id;
    var g=group(event),m=mode(event);
    el('fdPhoto').src=({club:'images/druzina_train.webp',walkers:'images/walkers_group.webp',academy:'images/portrait_face.webp'})[g]||'images/main_hero.webp';
    el('fdPhoto').alt=tr('photo');
    el('fdEventMeta').textContent=icon(event)+'  '+(g==='club'?tr('club'):g==='walkers'?tr('walkers'):tr('academy'));
    el('fdEventTitle').textContent=publicTitle(event);
    el('fdEventDesc').textContent=publicDescription(event);
    var facts=el('fdFacts');facts.replaceChildren();
    [[tr('date'),timeOf(event)],[tr('place'),publicVenue(event)],[({cs:'Pořadatel',en:'Organiser',ru:'Организатор',uk:'Організатор'})[lang],event.data_controller||tr('controller')],[tr('priceLabel'),displayEventPrice(event)]].forEach(function(x){
      var line=document.createElement('span'),b=document.createElement('strong');b.textContent=x[0]+': ';line.appendChild(b);line.appendChild(document.createTextNode(x[1]));facts.appendChild(line);
    });
    var st=el('fdStatus');st.hidden=false;st.className='fd-status '+(m==='open'?'open':'');st.textContent=event.provisional?window.ImperionCalendarPolicy.langData(lang).status:tr(m);
    updatePaymentDetails(event);
    var book=el('fdBook');book.removeAttribute('aria-disabled');
    if(event.provisional){book.href=window.ImperionCalendarPolicy.enquire(lang,event.local_day);book.target='_blank';book.rel='noopener noreferrer';book.textContent=window.ImperionCalendarPolicy.langData(lang).ask;}
    else if(m==='open'){book.removeAttribute('target');book.href=hrefForEvent(event);book.textContent=tr('book');}
    else if(m==='contact'){book.href=hrefForEvent(event);book.textContent=tr('ask');}
    else {book.href=g==='club'?'https://t.me/druzinamoravy_news':g==='walkers'?'https://t.me/pochody_brno_news':'academy/';book.textContent=tr('follow');}
    book.dataset.status=event.provisional?'tentative':m;book.dataset.category=g;
    var more=el('fdMore');more.textContent=tr('details');more.href=paths[g];
    var variants=el('fdVariants');variants.replaceChildren();variants.hidden=opts.length<2;
    if(opts.length>1)opts.forEach(function(option){
      var b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(option.event_id===event.event_id));b.textContent=icon(option)+' '+timeOf(option)+' · '+option.title;
      b.addEventListener('click',function(){selectedId=option.event_id;renderDetail(key);});variants.appendChild(b);
    });
  }
  var NEAREST_COPY={
    cs:{label:'NEJBLIŽŠÍ OVĚŘENÁ AKCE',book:'Požádat o místo →',ask:'Ověřit účast →',details:'Podrobnosti',empty:'Zatím žádná ověřená akce v nabídce',when:'Vyberte datum nebo změňte filtr',planned:'Termín vyžaduje potvrzení',error:'Nelze ověřit dostupné akce'},
    en:{label:'NEXT VERIFIED EVENT',book:'Request a place →',ask:'Check availability →',details:'Details',empty:'No verified event with this filter',when:'Choose a date or change filters',planned:'Attendance requires confirmation',error:'Event availability could not be checked'},
    ru:{label:'БЛИЖАЙШЕЕ ПОДТВЕРЖДЁННОЕ СОБЫТИЕ',book:'Запросить место →',ask:'Уточнить участие →',details:'Подробнее',empty:'Нет проверенного мероприятия по фильтру',when:'Выберите дату или измените фильтр',planned:'Место требует подтверждения',error:'Не удалось проверить мероприятия'},
    uk:{label:'НАЙБЛИЖЧА ПЕРЕВІРЕНА ПОДІЯ',book:'Запитати місце →',ask:'Уточнити участь →',details:'Детальніше',empty:'Немає перевіреної події за фільтром',when:'Оберіть дату чи змініть фільтр',planned:'Участь потребує підтвердження',error:'Не вдалося перевірити події'}
  };
  var nearestEvent=null;
  function renderNearestEvent(){
    var c=NEAREST_COPY[lang]||NEAREST_COPY.cs,chosen=data.filter(matches).slice().sort(function(a,b){return Date.parse(a.begins_at)-Date.parse(b.begins_at);})[0]||null;
    nearestEvent=chosen;
    var block=el('fdNearestEvent'),action=el('fdNearestBook'),details=el('fdNearestMore');
    el('fdNearestEyebrow').textContent=c.label;
    el('fdNearestTitle').textContent=chosen?publicTitle(chosen):(status==='error'?c.error:c.empty);
    el('fdNearestWhen').textContent=chosen?timeOf(chosen)+' · '+displayEventPrice(chosen):c.when;
    if(!chosen){
      block.classList.add('fd-nearest-empty');action.hidden=true;details.hidden=true;
      return;
    }
    block.classList.remove('fd-nearest-empty');action.hidden=false;details.hidden=false;
    var m=mode(chosen);
    if(m==='open'||m==='contact'){
      action.href=hrefForEvent(chosen);
      action.textContent=m==='open'?c.book:c.ask;
      action.removeAttribute('aria-disabled');
    }else{
      // A planned event is informational only, not a verified booking.
      action.href='#impr-calendar';action.textContent=c.planned;
      action.setAttribute('aria-disabled','true');
    }
    details.textContent=c.details;
  }
  el('fdNearestMore').addEventListener('click',function(){if(nearestEvent)activateFromList(nearestEvent);});

  function render(){
    var weekday=new Intl.DateTimeFormat(locale(),{weekday:'short',timeZone:'UTC'});
    el('fdWeekdays').replaceChildren();
    for(var n=0;n<7;n++){var wd=document.createElement('span');wd.textContent=weekday.format(new Date(Date.UTC(2024,0,1+n)));el('fdWeekdays').appendChild(wd);}
    el('fdMonth').textContent=new Intl.DateTimeFormat(locale(),{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(month.getFullYear(),month.getMonth(),12)));
    parent.querySelectorAll('[data-fd-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.fdFilter===filter));});
    parent.querySelectorAll('[data-fd-city]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.fdCity===city));});
    var year=month.getFullYear(),m=month.getMonth(),first=(new Date(Date.UTC(year,m,1)).getUTCDay()+6)%7;
    var days=new Date(Date.UTC(year,m+1,0)).getUTCDate(),grid=el('fdDays');grid.replaceChildren();
    for(var offset=0;offset<first;offset++){var blank=document.createElement('span');blank.className='fd-day fd-blank';blank.setAttribute('aria-hidden','true');grid.appendChild(blank);}
    var today=dayKey(new Date().toISOString()), firstWithEvents='';
    for(var day=1;day<=days;day++){
      var key=year+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      var evs=eventsForDay(key);
      if(evs.length&&!firstWithEvents)firstWithEvents=key;
      var item=document.createElement(evs.length?'button':'span');item.className='fd-day'+(key===today?' fd-today':'')+(key<today?' fd-past':'')+(evs.some(function(e){return e.provisional;})?' fd-day-recurring':'');
      if(evs.length){item.type='button';item.setAttribute('aria-label',key+' · '+evs.map(function(e){return e.title;}).join('; '));item.setAttribute('aria-pressed',String(key===chosenDay));item.addEventListener('click',function(k){return function(){chosenDay=k;selectedId='';sendSignal('calendar_day_select','calendar');render();openEventModal(k);};}(key));}
      var number=document.createElement('span');number.className='fd-daynum';number.textContent=day;item.appendChild(number);
      if(evs.length){
        var icons=document.createElement('span');icons.className='fd-dayicons';
        evs.slice(0,3).forEach(function(e){
          var mark=document.createElement('span');mark.className='fd-day-activity';
          var glyph=document.createElement('span');glyph.className='fd-day-glyph';glyph.textContent=icon(e);glyph.setAttribute('aria-hidden','true');
          var clock=document.createElement('time');clock.className='fd-day-time';clock.dateTime=e.begins_at;clock.textContent=shortTime(e);
          mark.appendChild(glyph);mark.appendChild(clock);icons.appendChild(mark);
        });
        if(evs.length>2){var moreMobile=document.createElement('span');moreMobile.className='fd-day-more fd-more-mobile';moreMobile.textContent='+'+(evs.length-2);icons.appendChild(moreMobile);}
        if(evs.length>3){var moreDesktop=document.createElement('span');moreDesktop.className='fd-day-more fd-more-desktop';moreDesktop.textContent='+'+(evs.length-3);icons.appendChild(moreDesktop);}
        item.appendChild(icons);
      }
      grid.appendChild(item);
    }
    if(!chosenDay||!eventsForDay(chosenDay).length)chosenDay=firstWithEvents||'';
    if(chosenDay)renderDetail(chosenDay);else setDetailEmpty(status==='error');
    var fallback=el('fdFallback');
    // A tentative Monday does not turn an otherwise empty event catalogue into a confirmed listing.
    fallback.hidden=!!(chosenDay&&eventsForDay(chosenDay).some(function(e){return !e.provisional;}))||status==='loading';
    if(!fallback.hidden){
      var isAcademy=filter==='academy';
      el('fdFallbackHint').textContent=isAcademy?tr('learnDesc'):(status==='error'?tr('offline'):(city!=='all'?ft('cityEmpty'):tr('empty')));
      el('fdFallbackLink').textContent=isAcademy?tr('learnCta'):tr('liveCalendar');
      el('fdFallbackLink').href=isAcademy?'academy/':'calendar/';
    }
    parent.querySelectorAll('.fd-day[aria-pressed]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('aria-label').slice(0,10)===chosenDay));});
    renderUpcoming();
    renderAllEvents();
    renderNearestEvent();
  }
  function monthShift(delta){closeEventModal(false);month=new Date(month.getFullYear(),month.getMonth()+delta,1);chosenDay='';selectedId='';render();}
  el('fdPrev').addEventListener('click',function(){monthShift(-1);});
  el('fdNext').addEventListener('click',function(){monthShift(1);});
  el('fdClose').addEventListener('click',function(){closeEventModal(true);});
  el('fdOverlay').addEventListener('click',function(){closeEventModal(true);});
  document.addEventListener('keydown',function(event){
    if(!modalShown)return;
    if(event.key==='Escape'){event.preventDefault();closeEventModal(true);return;}
    if(event.key!=='Tab')return;
    var nodes=Array.from(el('fdDetails').querySelectorAll('button:not([disabled]),a[href],summary')).filter(function(n){return !n.hidden && n.getClientRects().length;});
    if(!nodes.length){event.preventDefault();el('fdDetails').focus();return;}
    var first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey && (document.activeElement===first || !el('fdDetails').contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey && (document.activeElement===last || !el('fdDetails').contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  parent.querySelectorAll('[data-fd-language]').forEach(function(b){b.addEventListener('click',function(){
    lang=b.dataset.fdLanguage;
    try{localStorage.setItem('dm_lang',lang);}catch(_){}
    try{var url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url.pathname+url.search+url.hash);}catch(_){}
    // Keep existing site language/marketing state in sync for visits to deep information pages.
    var legacy=document.querySelector('#langSwitch button[data-lang="'+lang+'"]');if(legacy)legacy.click();
    el('fdFooterInfo').href='about/?lang='+encodeURIComponent(lang);
    applyLanguage();
  });});
  parent.querySelectorAll('[data-fd-filter]').forEach(function(b){b.addEventListener('click',function(){closeEventModal(false);filter=b.dataset.fdFilter;chosenDay='';selectedId='';sendSignal('activity_filter','calendar');render();});});
  parent.querySelectorAll('[data-fd-city]').forEach(function(b){b.addEventListener('click',function(){closeEventModal(false);city=b.dataset.fdCity;chosenDay='';selectedId='';sendSignal('city_filter','calendar');render();});});
  el('fdReset').addEventListener('click',function(){closeEventModal(false);filter='all';city='all';chosenDay='';selectedId='';sendSignal('filters_reset','calendar');render();});
  el('fdAcademyCta').addEventListener('click',function(){sendSignal('academy_catalog_open','hero');});
  el('fdNavEvents').addEventListener('click',function(){sendSignal('calendar_open','navigation');});
  el('fdHeroCta').addEventListener('click',function(){sendSignal('calendar_open','hero');});
  el('fdBook').addEventListener('click',function(){sendSignal('event_cta_'+(this.dataset.status||'browse'),'calendar_detail');});
  el('fdFooterInfo').href='about/?lang='+encodeURIComponent(lang);
  applyLanguage();
  document.documentElement.setAttribute('data-imperion-frontdoor','ready');
  // Delay first paint until all deferred localisation scripts have completed.
  var reveal=function(){document.documentElement.removeAttribute('data-imp-boot');};
  if(document.readyState==='complete')reveal();
  else document.addEventListener('DOMContentLoaded',reveal,{once:true});
  // Incoming links from Start/other pages can arrive with a fragment before
  // this JS-mounted calendar exists. Restore the intended landing position.
  if(location.hash==='#impr-calendar'){
    requestAnimationFrame(function(){var target=el('impr-calendar');if(target)target.scrollIntoView({block:'start'});});
  }
  try{
    var controller=new AbortController();var timeout=setTimeout(function(){controller.abort();},10000);
    fetch(API,{method:'GET',cache:'no-store',signal:controller.signal}).then(function(r){if(!r.ok)throw Error('catalog_unavailable');return r.json();}).then(function(payload){
      if(!payload||!Array.isArray(payload.events))throw Error('catalog_invalid');
      data=payload.events.filter(function(e){
        return e&&typeof e.event_id==='string'&&/^PUB-[A-Z0-9-]{4,90}$/.test(e.event_id)&&typeof e.title==='string'&&Number.isFinite(Date.parse(e.begins_at))&&Date.parse(e.begins_at)>=Date.now()&&!isSuppressed(e);
      }).sort(function(a,b){return Date.parse(a.begins_at)-Date.parse(b.begins_at);});
      status='ready';
      if(data.length&&!data.some(function(e){var k=dayKey(e.begins_at);return k.slice(0,7)===month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0');})){month=new Date(data[0].begins_at);}
      render();
    }).catch(function(){status='error';data=[];render();}).finally(function(){clearTimeout(timeout);});
  }catch(_){status='error';render();}
})();
