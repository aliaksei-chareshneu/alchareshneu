
/* Conversion-first homepage, 11 Nov 2026. Uses existing public registration catalog.
   No new contact storage, payment claim, duplicate CRM, or analytics tracker. */
(function () {
  'use strict';
  if (!document.body || document.getElementById('imperion-frontdoor')) return;
  var API = 'https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
  var LANGS = ['cs', 'en', 'ru', 'uk'];
  var COPY = {
    cs: {eyebrow:'BRNO · ZÁŽITKY · LIDÉ · ROZVOJ', title:'Zažijte něco nového.',title2:'Najděte to své.',lead:'Šerm, výlety, hry nebo příprava na důležitý cíl. Jedno místo pro váš další krok.',button:'Vybrat zážitek',under:'JEDNO MÍSTO. MNOHO MOŽNOSTÍ.',dir1:'⚔️ Příběhy a pohyb',dir2:'🥾 Zážitky a setkání',dir3:'🎓 Učení a výsledky',calendarEyebrow:'CO BUDE DÁL',calendarTitle:'Vyberte si termín.',calendarIntro:'Klikněte na den v kalendáři. Uvidíte cenu, stav a další krok.',all:'Vše',club:'Šerm a historie',walkers:'Výlety a hry',academy:'Jazyky a příprava',loading:'Načítáme aktuální veřejné akce…',offline:'Aktuální seznam se nepodařilo ověřit. Nespoléhejte na staré termíny.',empty:'Na tento měsíc nejsou zveřejněny dostupné akce v této kategorii.',errorTitle:'Termíny zatím nelze ověřit',emptyTitle:'Najděte další příležitost',noEventTitle:'Vyberte den s akcí',noEventDesc:'Vyberte označený den a podrobnosti uvidíte tady. Na telefonu hned pod kalendářem.',learnTitle:'Připravte se na svůj cíl',learnDesc:'Čeština, jazyky, přijímačky, maturita, přírodní vědy a IT. Individuální termíny řešíme podle vašeho cíle a dostupnosti — bez smyšlených položek v kalendáři.',learnCta:'Vybrat přípravu',open:'Online přihláška otevřena',contact:'Před účastí kontaktujte pořadatele',planned:'Zatím bez potvrzené přihlášky',book:'Požádat o místo',ask:'Ověřit účast',follow:'Sledovat další termíny',price:'Cena bude potvrzena',free:'Zdarma',date:'Kdy',place:'Kde',priceLabel:'Cena',details:'Více informací',notice:'Odeslání přihlášky neznamená potvrzené místo ani platbu. Pořadatel potvrdí účast zvlášť.',photo:'Ilustrační fotografie podobné aktivity',calendarNote:'Časy: Europe/Prague. Zobrazujeme pouze veřejné záznamy z existujícího katalogu; neověřené akce nejsou rezervacemi.',back:'Starší informace',privacy:'Soukromí a bezpečnost',controller:'Organizátora a podmínky ověříte u konkrétní akce.',liveCalendar:'Veřejný kalendář',today:'Dnes',prev:'Předchozí měsíc',next:'Další měsíc'},
    en: {eyebrow:'BRNO · EXPERIENCES · PEOPLE · GROWTH',title:'Try something new.',title2:'Find what moves you.',lead:'Fencing, hikes, games or preparing for a big goal. One place for your next step.',button:'Explore the calendar',under:'ONE PLACE. ENDLESS POSSIBILITIES.',dir1:'⚔️ Stories in motion',dir2:'🥾 Adventures together',dir3:'🎓 Learn and achieve',calendarEyebrow:'WHAT COMES NEXT',calendarTitle:'Find your next date.',calendarIntro:'Tap any event day to see the price, status and next step.',all:'Everything',club:'Fencing & history',walkers:'Hikes & games',academy:'Languages & exams',loading:'Loading approved public events…',offline:'We could not verify the latest event list. Please do not rely on outdated dates.',empty:'There are no published available events in this category this month.',errorTitle:'Dates cannot be verified',emptyTitle:'Discover another opportunity',noEventTitle:'Choose an event day',noEventDesc:'Select a day with an icon; event details will appear here, or below the calendar on mobile.',learnTitle:'Move toward your goal',learnDesc:'Czech, languages, entrance exams, school subjects, biology, chemistry and IT. One-to-one lesson times are arranged individually; we do not invent calendar availability.',learnCta:'Explore learning options',open:'Online request available',contact:'Contact organiser before attending',planned:'Not open for confirmed registration',book:'Request a place',ask:'Check availability',follow:'Follow new dates',price:'Price to confirm',free:'Free',date:'When',place:'Where',priceLabel:'Price',details:'About this activity',notice:'Submitting an enquiry does not confirm a place or payment. The organiser confirms attendance separately.',photo:'Illustrative photo from a similar activity',calendarNote:'Times: Europe/Prague. Only public entries from the existing catalogue appear here; tentative events are not reservations.',back:'More information',privacy:'Privacy and safety',controller:'Organiser and full terms are confirmed per event.',liveCalendar:'Public calendar',today:'Today',prev:'Previous month',next:'Next month'},
    ru: {eyebrow:'БРНО · ВПЕЧАТЛЕНИЯ · ЛЮДИ · РАЗВИТИЕ',title:'Попробуй новое.',title2:'Найди своё.',lead:'Фехтование, походы, игры или подготовка к важной цели. Всё начинается с одного выбора.',button:'Выбрать событие',under:'ОДИН ГОРОД. МНОЖЕСТВО ВОЗМОЖНОСТЕЙ.',dir1:'⚔️ История и движение',dir2:'🥾 Приключения и люди',dir3:'🎓 Учёба и результат',calendarEyebrow:'ЧТО ДАЛЬШЕ',calendarTitle:'Выбери свою дату.',calendarIntro:'Нажми на день: справа или ниже появятся детали, цена и запись.',all:'Все события',club:'Фехтование и история',walkers:'Походы и игры',academy:'Языки и экзамены',loading:'Загружаем подтверждённые публичные мероприятия…',offline:'Не удалось проверить актуальные даты. Не используйте устаревшее расписание.',empty:'На этот месяц нет опубликованных доступных событий этой категории.',errorTitle:'Даты пока недоступны',emptyTitle:'Найди следующую возможность',noEventTitle:'Выбери день с событием',noEventDesc:'Нажми дату с иконкой — подробности появятся здесь, а на телефоне под календарём.',learnTitle:'Подготовься к своей цели',learnDesc:'Чешский и другие языки, вступительные экзамены, школьные предметы, биология, химия и IT. Время индивидуальных занятий согласуется отдельно; мы не придумываем свободные слоты.',learnCta:'Выбрать подготовку',open:'Открыта онлайн-заявка',contact:'Участие по согласованию',planned:'Запись пока не подтверждена',book:'Запросить место',ask:'Уточнить участие',follow:'Следить за новыми датами',price:'Цена уточняется',free:'Бесплатно',date:'Когда',place:'Где',priceLabel:'Цена',details:'Об активности',notice:'Отправленная заявка не означает подтверждения места или оплаты. Организатор подтвердит участие отдельно.',photo:'Иллюстративное фото похожей активности',calendarNote:'Время: Europe/Prague. Показаны только публичные события из существующего каталога; условные события не считаются бронью.',back:'Подробная информация',privacy:'Конфиденциальность и безопасность',controller:'Организатор и условия уточняются для каждого события.',liveCalendar:'Публичный календарь',today:'Сегодня',prev:'Предыдущий месяц',next:'Следующий месяц'},
    uk: {eyebrow:'БРНО · ВРАЖЕННЯ · ЛЮДИ · РОЗВИТОК',title:'Спробуйте нове.',title2:'Знайдіть своє.',lead:'Фехтування, походи, ігри чи підготовка до важливої мети. Усе починається з одного вибору.',button:'Обрати подію',under:'ОДНЕ МІСТО. БАГАТО МОЖЛИВОСТЕЙ.',dir1:'⚔️ Історія і рух',dir2:'🥾 Пригоди та знайомства',dir3:'🎓 Навчання і результат',calendarEyebrow:'ЩО ДАЛІ',calendarTitle:'Оберіть свою дату.',calendarIntro:'Натисніть на день: опис, ціна та запис з’являться поруч або нижче.',all:'Усі події',club:'Фехтування та історія',walkers:'Походи та ігри',academy:'Мови та іспити',loading:'Завантажуємо перевірені публічні події…',offline:'Не вдалося перевірити актуальні дати. Не покладайтеся на старий розклад.',empty:'На цей місяць немає опублікованих доступних подій у цій категорії.',errorTitle:'Дати поки недоступні',emptyTitle:'Знайдіть наступну можливість',noEventTitle:'Оберіть день із подією',noEventDesc:'Натисніть на день із символом — подробиці з’являться тут або під календарем.',learnTitle:'Підготуйтеся до своєї мети',learnDesc:'Чеська та інші мови, вступні іспити, шкільні предмети, біологія, хімія й IT. Час індивідуальних занять погоджується окремо; вигаданих вільних слотів немає.',learnCta:'Обрати підготовку',open:'Відкрита онлайн-заявка',contact:'Участь за погодженням',planned:'Запис ще не підтверджений',book:'Запитати про місце',ask:'Уточнити участь',follow:'Стежити за новими датами',price:'Ціну уточнюємо',free:'Безкоштовно',date:'Коли',place:'Де',priceLabel:'Ціна',details:'Про активність',notice:'Надіслана заявка не підтверджує місце або оплату. Організатор підтвердить участь окремо.',photo:'Ілюстративне фото схожої активності',calendarNote:'Час: Europe/Prague. Тут лише публічні події з чинного каталогу; умовні події не є бронюванням.',back:'Детальні відомості',privacy:'Конфіденційність та безпека',controller:'Організатор і умови уточнюються для кожної події.',liveCalendar:'Публічний календар',today:'Сьогодні',prev:'Попередній місяць',next:'Наступний місяць'}
  };
  var paths = {club:'druzina/',walkers:'walkers/',academy:'academy/'};
  var query = new URLSearchParams(location.search);
  var requested = query.get('lang');
  var saved=null;try {saved=localStorage.getItem('dm_lang');} catch (_) {}
  var lang = LANGS.indexOf(requested)>=0 ? requested : (LANGS.indexOf(saved)>=0 ? saved : 'cs');
  var data=[], status='loading', filter='all', selectedId='', chosenDay='', month=new Date(), pending=false;
  var tzFormatter = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'});
  function tr(k){return COPY[lang][k]||COPY.en[k]||k;}
  function el(id){return document.getElementById(id);}
  function sendSignal(name,placement) {
    document.dispatchEvent(new CustomEvent('ecosystem:conversion',{detail:{name:name,page:'home',language:lang,placement:placement}}));
  }
  var html = [
    '<div id="imperion-frontdoor">',
    '<header class="fd-header"><div class="fd-shell fd-header-inner">',
      '<div class="fd-logo"><span class="fd-logo-mark" aria-hidden="true">✦</span><span>BRNO <span style="color:#f3cf8f">/</span> EXPERIENCE</span></div>',
      '<div class="fd-directions" aria-label="Our activities"><span id="fdDir1"></span><span id="fdDir2"></span><span id="fdDir3"></span></div>',
      '<div class="fd-languages" aria-label="Language">',
      '<button type="button" data-fd-language="cs">CZ</button><button type="button" data-fd-language="en">EN</button><button type="button" data-fd-language="ru">RU</button><button type="button" data-fd-language="uk">UA</button>',
      '</div></div></header>',
    '<main>',
      '<section class="fd-hero" aria-label="Welcome">',
        '<div class="fd-mosaic" aria-hidden="true"><span></span><span></span><span></span></div>',
        '<div class="fd-shell fd-hero-inner">',
          '<div class="fd-eyebrow" id="fdEyebrow"></div>',
          '<h1><span id="fdHero1" style="color:#fffdf3"></span><span id="fdHero2"></span></h1>',
          '<p class="fd-lede" id="fdLead"></p>',
          '<a class="fd-hero-cta" id="fdHeroCta" href="#impr-calendar"><span id="fdHeroLabel"></span><span aria-hidden="true">↗</span></a>',
        '</div>',
        '<div class="fd-hero-bottom" id="fdUnder"></div>',
      '</section>',
      '<section class="fd-section" id="impr-calendar" tabindex="-1">',
        '<div class="fd-shell">',
          '<div class="fd-topline"><div><div class="fd-eyebrow" id="fdCalEyebrow"></div><h2 id="fdCalTitle"></h2></div><p id="fdCalIntro"></p></div>',
          '<div class="fd-filters" role="group" aria-label="Activities">',
          '<button type="button" data-fd-filter="all"></button><button type="button" data-fd-filter="club"></button><button type="button" data-fd-filter="walkers"></button><button type="button" data-fd-filter="academy"></button></div>',
          '<div class="fd-calendar-layout">',
            '<div class="fd-calendar-pane">',
              '<div class="fd-calendar-nav"><button type="button" id="fdPrev" aria-label="Previous month">‹</button><h3 id="fdMonth"></h3><button type="button" id="fdNext" aria-label="Next month">›</button></div>',
              '<div class="fd-weekdays" id="fdWeekdays"></div><div class="fd-days" id="fdDays" role="group" aria-label="Event dates"></div>',
              '<p class="fd-cal-note" id="fdCalNote"></p>',
            '</div>',
            '<aside class="fd-detail-pane" id="fdDetails" aria-live="polite">',
              '<div class="fd-photo"><img id="fdPhoto" src="images/main_hero.webp" alt="" loading="lazy"><span class="fd-photo-tag" id="fdPhotoTag"></span></div>',
              '<div class="fd-detail-content"><p class="fd-meta" id="fdEventMeta"></p><h3 id="fdEventTitle"></h3><p class="fd-description" id="fdEventDesc"></p>',
              '<div class="fd-event-variants" id="fdVariants" hidden></div><div class="fd-facts" id="fdFacts"></div>',
              '<div class="fd-status" id="fdStatus" hidden></div>',
              '<div class="fd-actions"><a class="fd-book" id="fdBook" href="register/"></a><a class="fd-info" id="fdMore" href="calendar/"></a></div></div>',
            '</aside>',
          '</div>',
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
    return 'register/?lang='+encodeURIComponent(lang)+'&event='+encodeURIComponent(e.event_id)+'&src=frontdoor_calendar';
  }
  function dayKey(iso){
    var d=new Date(iso);
    if (!Number.isFinite(d.getTime()))return '';
    var parts=tzFormatter.formatToParts(d),p={};
    parts.forEach(function(x){p[x.type]=x.value;});
    return p.year+'-'+p.month+'-'+p.day;
  }
  function mode(e) {
    if (!e) return 'planned';
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
    if(e.event_id==='PUB-OREL-20261114')return ({cs:'Šerm pro začátečníky · bezplatný workshop',en:'Try historical fencing · free workshop',ru:'Попробуй фехтование · бесплатный воркшоп',uk:'Спробуйте фехтування · безплатний воркшоп'})[lang];
    if(e.category==='HEMA Training' && group(e)==='club')return ({cs:'Historický šerm · Družina Moravy',en:'Historical fencing · Družina Moravy',ru:'Историческое фехтование · Družina Moravy',uk:'Історичне фехтування · Družina Moravy'})[lang];
    return e.title;
  }
  function publicDescription(e){
    if(e.event_id==='PUB-OREL-20261114')return ({cs:'Úvodní workshop v Orlovně Husovice. Vstup zdarma, účast až po osobním potvrzení organizátorem.',en:'Introductory workshop at Orlovna Husovice. Free entry, attendance only after personal confirmation.',ru:'Вводный воркшоп в Orlovna Husovice. Бесплатно, участие только после личного подтверждения организатора.',uk:'Вступний воркшоп в Orlovna Husovice. Безплатно, участь лише після особистого підтвердження.'})[lang];
    if(e.category==='HEMA Training' && group(e)==='club')return ({cs:'Pohyb, historický šerm a společný trénink. Bezpečné místo a účast vždy potvrdí organizátor.',en:'Movement, historical fencing and group training. The organiser must confirm the safe venue and your place.',ru:'Движение, историческое фехтование и тренировка в группе. Место и участие организатор подтверждает лично.',uk:'Рух, історичне фехтування та групове тренування. Безпечне місце й участь організатор підтверджує особисто.'})[lang];
    return typeof e.public_note==='string'&&e.public_note.trim()?e.public_note.slice(0,330):tr('controller');
  }
  function publicVenue(e){
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
  function matches(e){return filter==='all'||group(e)===filter;}
  function isSuppressed(e){
    var date=String(e.begins_at||'').slice(0,10);
    // Owner decision: regular Saturday HEMA is suspended from 7 Nov until separately reinstated.
    // Free Orel 14 Nov is a distinct approved workshop, not a regular Saturday session.
    var clubSaturday=e.category==='HEMA Training'&&group(e)==='club'&&e.event_id!=='PUB-OREL-20261114'&&new Date(e.begins_at).getUTCDay()===6;
    return clubSaturday||date==='2026-11-15'||date==='2026-11-17'||e.event_id==='BW-PAID-20261028'||e.event_id==='COM-HIKE-20261028';
  }
  function eventsForDay(key){
    return data.filter(function(e){return dayKey(e.begins_at)===key&&matches(e);}).sort(function(a,b){return Date.parse(a.begins_at)-Date.parse(b.begins_at);});
  }
  function locale(){return ({cs:'cs-CZ',en:'en-GB',ru:'ru-RU',uk:'uk-UA'})[lang]||'cs-CZ';}
  function timeOf(e){
    return new Intl.DateTimeFormat(locale(),{timeZone:'Europe/Prague',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(e.begins_at));
  }
  function applyLanguage() {
    document.documentElement.lang=lang;
    [['fdEyebrow','eyebrow'],['fdHero1','title'],['fdHero2','title2'],['fdLead','lead'],['fdHeroLabel','button'],['fdUnder','under'],['fdDir1','dir1'],['fdDir2','dir2'],['fdDir3','dir3'],['fdCalEyebrow','calendarEyebrow'],['fdCalTitle','calendarTitle'],['fdCalIntro','calendarIntro'],['fdCalNote','calendarNote'],['fdNotice','notice'],['fdFooterCalendar','liveCalendar'],['fdFooterPrivacy','privacy'],['fdFooterInfo','back']].forEach(function(pair){label(pair[0],pair[1]);});
    parent.querySelectorAll('[data-fd-language]').forEach(function(btn){btn.setAttribute('aria-pressed',String(btn.dataset.fdLanguage===lang));});
    parent.querySelectorAll('[data-fd-filter]').forEach(function(btn){btn.textContent=tr(btn.dataset.fdFilter==='club'?'club':btn.dataset.fdFilter==='walkers'?'walkers':btn.dataset.fdFilter==='academy'?'academy':'all');});
    el('fdPrev').setAttribute('aria-label',tr('prev'));el('fdNext').setAttribute('aria-label',tr('next'));
    el('fdPhotoTag').textContent=tr('photo');
    render();
  }
  function setDetailEmpty(isError) {
    el('fdPhoto').src='images/main_hero.webp';
    el('fdEventMeta').textContent=tr('eyebrow');
    el('fdEventTitle').textContent=isError?tr('errorTitle'):(filter==='academy'?tr('learnTitle'):(status==='ready'?tr('emptyTitle'):tr('noEventTitle')));
    el('fdEventDesc').textContent=isError?tr('offline'):(filter==='academy'?tr('learnDesc'):(status==='loading'?tr('loading'):(data.length?tr('noEventDesc'):tr('empty'))));
    el('fdFacts').replaceChildren();el('fdStatus').hidden=true;
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
    [[tr('date'),timeOf(event)],[tr('place'),publicVenue(event)],[({cs:'Pořadatel',en:'Organiser',ru:'Организатор',uk:'Організатор'})[lang],event.data_controller||tr('controller')],[tr('priceLabel'),event.price_verified===true?(Number(event.price_czk)===0?tr('free'):(Number.isFinite(Number(event.price_czk))?Number(event.price_czk)+' Kč':tr('price'))):tr('price')]].forEach(function(x){
      var line=document.createElement('span'),b=document.createElement('strong');b.textContent=x[0]+': ';line.appendChild(b);line.appendChild(document.createTextNode(x[1]));facts.appendChild(line);
    });
    var st=el('fdStatus');st.hidden=false;st.className='fd-status '+(m==='open'?'open':'');st.textContent=tr(m);
    var book=el('fdBook');book.removeAttribute('aria-disabled');
    if(m==='open'){book.href=hrefForEvent(event);book.textContent=tr('book');}
    else if(m==='contact'){book.href=hrefForEvent(event);book.textContent=tr('ask');}
    else {book.href=g==='club'?'https://t.me/druzinamoravy_news':g==='walkers'?'https://t.me/pochody_brno_news':'academy/';book.textContent=tr('follow');}
    book.dataset.status=m;book.dataset.category=g;
    var more=el('fdMore');more.textContent=tr('details');more.href=paths[g];
    var variants=el('fdVariants');variants.replaceChildren();variants.hidden=opts.length<2;
    if(opts.length>1)opts.forEach(function(option){
      var b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(option.event_id===event.event_id));b.textContent=icon(option)+' '+timeOf(option)+' · '+option.title;
      b.addEventListener('click',function(){selectedId=option.event_id;renderDetail(key);});variants.appendChild(b);
    });
  }
  function render(){
    var weekday=new Intl.DateTimeFormat(locale(),{weekday:'short',timeZone:'UTC'});
    el('fdWeekdays').replaceChildren();
    for(var n=0;n<7;n++){var wd=document.createElement('span');wd.textContent=weekday.format(new Date(Date.UTC(2024,0,1+n)));el('fdWeekdays').appendChild(wd);}
    el('fdMonth').textContent=new Intl.DateTimeFormat(locale(),{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(month.getFullYear(),month.getMonth(),12)));
    parent.querySelectorAll('[data-fd-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.fdFilter===filter));});
    var year=month.getFullYear(),m=month.getMonth(),first=(new Date(Date.UTC(year,m,1)).getUTCDay()+6)%7;
    var days=new Date(Date.UTC(year,m+1,0)).getUTCDate(),grid=el('fdDays');grid.replaceChildren();
    for(var offset=0;offset<first;offset++){var blank=document.createElement('span');blank.className='fd-day fd-blank';blank.setAttribute('aria-hidden','true');grid.appendChild(blank);}
    var today=dayKey(new Date().toISOString()), firstWithEvents='';
    for(var day=1;day<=days;day++){
      var key=year+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      var evs=eventsForDay(key);
      if(evs.length&&!firstWithEvents)firstWithEvents=key;
      var item=document.createElement(evs.length?'button':'span');item.className='fd-day'+(key===today?' fd-today':'')+(key<today?' fd-past':'');
      if(evs.length){item.type='button';item.setAttribute('aria-label',key+' · '+evs.map(function(e){return e.title;}).join('; '));item.setAttribute('aria-pressed',String(key===chosenDay));item.addEventListener('click',function(k){return function(){chosenDay=k;selectedId='';sendSignal('calendar_day_select','calendar');render();};}(key));}
      var number=document.createElement('span');number.className='fd-daynum';number.textContent=day;item.appendChild(number);
      if(evs.length){var symbol=document.createElement('span');symbol.className='fd-dayicons';symbol.textContent=evs.slice(0,2).map(icon).join('');if(evs.length>2)symbol.textContent+='+'+(evs.length-2);item.appendChild(symbol);}
      grid.appendChild(item);
    }
    if(!chosenDay||!eventsForDay(chosenDay).length)chosenDay=firstWithEvents||'';
    if(chosenDay)renderDetail(chosenDay);else setDetailEmpty(status==='error');
    parent.querySelectorAll('.fd-day[aria-pressed]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('aria-label').slice(0,10)===chosenDay));});
  }
  function monthShift(delta){month=new Date(month.getFullYear(),month.getMonth()+delta,1);chosenDay='';selectedId='';render();}
  el('fdPrev').addEventListener('click',function(){monthShift(-1);});
  el('fdNext').addEventListener('click',function(){monthShift(1);});
  parent.querySelectorAll('[data-fd-language]').forEach(function(b){b.addEventListener('click',function(){
    lang=b.dataset.fdLanguage;
    try{localStorage.setItem('dm_lang',lang);}catch(_){}
    try{var url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url.pathname+url.search+url.hash);}catch(_){}
    // Keep existing site language/marketing state in sync for visits to deep information pages.
    var legacy=document.querySelector('#langSwitch button[data-lang="'+lang+'"]');if(legacy)legacy.click();
    el('fdFooterInfo').href='start/?lang='+lang;
    applyLanguage();
  });});
  parent.querySelectorAll('[data-fd-filter]').forEach(function(b){b.addEventListener('click',function(){filter=b.dataset.fdFilter;chosenDay='';selectedId='';sendSignal('activity_filter','calendar');render();});});
  el('fdHeroCta').addEventListener('click',function(){sendSignal('calendar_open','hero');});
  el('fdBook').addEventListener('click',function(){sendSignal('event_cta_'+(this.dataset.status||'browse'),'calendar_detail');});
  el('fdFooterInfo').href='start/?lang='+lang;
  applyLanguage();
  document.documentElement.setAttribute('data-imperion-frontdoor','ready');
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
