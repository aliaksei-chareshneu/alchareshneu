/* Shared, progressively enhanced conversion journeys. No analytics vendor or network collection. */
(() => {
  'use strict';
  const page = document.querySelector('.hero')?.id || 'main';
  const base = page === 'main' ? '' : '../';
  const registration = document.querySelector('#navBookBtn').href;
  const copy = {
    en: {
      skip:'Skip to content',homeTitle:'Learn. Explore. Find your people.',homeIntro:'Tutoring with Aliaksei Chareshneu, PhD. Hikes with BrnoWalkers. Historical fencing with Družina Moravy. Your next step starts in Brno.',trust:'Aliaksei Chareshneu, PhD · Masaryk University · Brno & online',chooseEyebrow:'ONE CITY. MANY WAYS TO GROW.',chooseTitle:'What brings you here?',
      card0Title:'Tutoring & coaching',card0Intro:'Sciences, languages, IT, fitness and practical support. Choose the help you need.',card0Cta:'Explore services & prices →',card1Title:'BrnoWalkers',card1Intro:'Explore Moravia together: city walks, caves and mountain trails.',card1Cta:'Find your next walk →',card2Title:'Družina Moravy',card2Intro:'Historical fencing, HEMA & LARP. Start with a first training for 120 Kč.',card2Cta:'Plan your first training →',card3Title:'Upcoming events',card3Intro:'One calendar for hikes, training and community events in Brno.',card3Cta:'See what’s next →',
      home:'Home',academy:'Academy',calendar:'Calendar',reviews:'Read Google reviews ↗',prices:'Prices & options',book:'Book a session',trial:'First training · 120 Kč',events:'Find an upcoming event',select:'Choose your goal',search:'Search services or subjects',all:'Show all services',noResults:'No matching service. Try another subject or ask me directly.',ask:'Ask about this service',full:'All prices & packages',steps:'Your first step, made simple',step1:'Choose your format',step2:'Register',step3:'Join us',
      academySteps:['Choose a subject or service and check the full price list.','Tell me your goal, preferred language and availability.','Agree the format and time before your session.'],
      druzinaSteps:['Check the training days and venue below.','Book your first training for 120 Kč.','Meet the coach, try the training, then choose how to continue.'],
      walkersSteps:['Check the route, distance, difficulty and price for your event.','Choose your event in the registration form.','Follow the meeting and equipment instructions in the announcement.'],
      goals:['Study & languages','Fitness & nutrition','Life in Brno','IT & creative work'],goalNotes:['Exam preparation, sciences, programming and conversation.','Personal training, nutrition plans and ongoing support.','Practical help, housing and private guided tours.','Computer cleanup, websites, media and coaching.'],
      crossTitle:'There’s more to discover in Brno',crossIntro:'Turn a lesson, a training or a walk into a connection. Explore another part of the community.',empty:'Your next plan starts here',emptyIntro:'New dates appear in the calendar and announcement channels. Check the calendar, follow announcements, or explore regular training.',error:'The live event list is taking longer than usual.',errorIntro:'You can still check the public calendar or follow announcements for current details.',retry:'Try again',announcements:'Event announcements',loyalty:'Learn together. Come back together.',loyaltyText:'Refer a friend: they receive 10% off their first booking and you receive 10% off your next one. Ask when arranging your session.',first:'New here?',difficulty:'Choose a route that suits you',walkNote:'City walks: 5–12 km, easy. Caves: 2–6 km, easy to medium. Mountain hikes: 10–25 km, medium to hard. Prices and meeting details are specific to each event.',terms:'Check prices and terms before booking.',catalog:'Services & full price list',contact:'Contact',more:'Explore',
    },
    ru: {
      skip:'К содержанию',homeTitle:'Учись. Исследуй. Найди своих.',homeIntro:'Занятия с Алексеем Черешневым, PhD. Походы с BrnoWalkers. Историческое фехтование с Družina Moravy. Твой следующий шаг — в Брно.',trust:'Алексей Черешнев, PhD · Университет Масарика · Брно и онлайн',chooseEyebrow:'ОДИН ГОРОД. РАЗНЫЕ ПУТИ РАЗВИТИЯ.',chooseTitle:'Что тебе интересно?',
      card0Title:'Занятия и коучинг',card0Intro:'Науки, языки, IT, фитнес и практическая поддержка. Выбери помощь под свою задачу.',card0Cta:'Услуги и цены →',card1Title:'BrnoWalkers',card1Intro:'Открываем Моравию вместе: прогулки, пещеры и горные маршруты.',card1Cta:'Выбрать прогулку →',card2Title:'Družina Moravy',card2Intro:'Историческое фехтование, HEMA и LARP. Первая тренировка — 120 Kč.',card2Cta:'На первую тренировку →',card3Title:'Ближайшие события',card3Intro:'Походы, тренировки и встречи сообщества в одном календаре.',card3Cta:'Посмотреть события →',
      home:'Главная',academy:'Академия',calendar:'Календарь',reviews:'Отзывы в Google ↗',prices:'Цены и варианты',book:'Записаться на занятие',trial:'Первая тренировка · 120 Kč',events:'Выбрать ближайшее событие',select:'Выбери свою задачу',search:'Поиск услуг или предметов',all:'Показать все услуги',noResults:'Ничего не найдено. Попробуй другой запрос или напиши мне.',ask:'Обсудить эту услугу',full:'Все цены и пакеты',steps:'Как начать',step1:'Выбери формат',step2:'Запишись',step3:'Присоединяйся',
      academySteps:['Выбери предмет или услугу и посмотри полный прайс.','Расскажи о цели, удобном языке и времени.','Согласуй формат и время до занятия.'],druzinaSteps:['Посмотри дни тренировок и адрес ниже.','Запишись на первую тренировку за 120 Kč.','Познакомься с тренером, попробуй занятие и выбери, как продолжить.'],walkersSteps:['Проверь маршрут, расстояние, сложность и цену события.','Выбери мероприятие в форме регистрации.','Следуй указаниям о месте встречи и снаряжении в анонсе.'],goals:['Учёба и языки','Фитнес и питание','Жизнь в Брно','IT и творчество'],goalNotes:['Подготовка к экзаменам, науки, программирование и разговорная практика.','Персональные тренировки, питание и регулярная поддержка.','Практическая помощь, жильё и индивидуальные экскурсии.','Очистка компьютеров, сайты, контент и коучинг.'],
      crossTitle:'Открой больше в Брно',crossIntro:'Занятие, тренировка или прогулка могут стать началом знакомства. Загляни в другие проекты сообщества.',empty:'Начни планировать следующую встречу',emptyIntro:'Новые даты появляются в календаре и каналах анонсов. Посмотри календарь, подпишись на новости или выбери регулярную тренировку.',error:'Список событий загружается дольше обычного.',errorIntro:'Актуальные даты можно посмотреть в публичном календаре и каналах анонсов.',retry:'Попробовать ещё раз',announcements:'Анонсы событий',loyalty:'Учитесь вместе. Возвращайтесь вместе.',loyaltyText:'Приведи друга: ему — скидка 10% на первую запись, тебе — 10% на следующую. Уточни при согласовании занятия.',first:'Впервые здесь?',difficulty:'Выбери маршрут по силам',walkNote:'Город: 5–12 км, легко. Пещеры: 2–6 км, легко или средне. Горы: 10–25 км, средне или сложно. Цена и место встречи указаны для каждого события отдельно.',terms:'Проверь цены и условия перед записью.',catalog:'Услуги и полный прайс',contact:'Контакты',more:'Посмотреть',
    },
    cs: {
      skip:'Přejít na obsah',homeTitle:'Uč se. Objevuj. Najdi své lidi.',homeIntro:'Doučování s Aliakseiem Chareshneuem, PhD. Výlety s BrnoWalkers. Historický šerm s Družinou Moravy. Tvůj další krok začíná v Brně.',trust:'Aliaksei Chareshneu, PhD · Masarykova univerzita · Brno a online',chooseEyebrow:'JEDNO MĚSTO. SPOUSTA MOŽNOSTÍ.',chooseTitle:'Co tě sem přivádí?',
      card0Title:'Doučování a koučink',card0Intro:'Vědy, jazyky, IT, fitness a praktická podpora. Vyber si pomoc podle svých potřeb.',card0Cta:'Služby a ceny →',card1Title:'BrnoWalkers',card1Intro:'Objevuj Moravu s námi: městské procházky, jeskyně a horské stezky.',card1Cta:'Vybrat další výlet →',card2Title:'Družina Moravy',card2Intro:'Historický šerm, HEMA a LARP. První trénink za 120 Kč.',card2Cta:'Naplánovat první trénink →',card3Title:'Nejbližší akce',card3Intro:'Výlety, tréninky a komunitní setkání v jednom kalendáři.',card3Cta:'Co se chystá →',
      home:'Domů',academy:'Akademie',calendar:'Kalendář',reviews:'Přečíst recenze na Google ↗',prices:'Ceny a možnosti',book:'Objednat lekci',trial:'První trénink · 120 Kč',events:'Vybrat nejbližší akci',select:'Co chceš zvládnout?',search:'Hledat službu nebo předmět',all:'Zobrazit všechny služby',noResults:'Žádná odpovídající služba. Zkus jiné slovo nebo mi napiš.',ask:'Zeptat se na tuto službu',full:'Všechny ceny a balíčky',steps:'Jak začít',step1:'Vyber si formát',step2:'Přihlas se',step3:'Přidej se k nám',
      academySteps:['Vyber si předmět nebo službu a prohlédni si ceník.','Napiš svůj cíl, preferovaný jazyk a časové možnosti.','Před lekcí se domluvíme na formátu a termínu.'],druzinaSteps:['Podívej se níže na dny tréninků a místo konání.','Přihlas se na první trénink za 120 Kč.','Seznam se s trenérem, vyzkoušej trénink a vyber si pokračování.'],walkersSteps:['Zkontroluj trasu, vzdálenost, náročnost a cenu akce.','Vyber akci v registračním formuláři.','Řiď se pokyny k místu srazu a vybavení v oznámení.'],goals:['Studium a jazyky','Fitness a výživa','Život v Brně','IT a tvorba'],goalNotes:['Příprava na zkoušky, vědy, programování a konverzace.','Osobní tréninky, výživové plány a průběžná podpora.','Praktická pomoc, bydlení a soukromé prohlídky.','Čištění počítačů, weby, obsah a koučink.'],
      crossTitle:'Objev v Brně ještě víc',crossIntro:'Lekce, trénink nebo výlet mohou být začátkem nového přátelství. Poznej další část naší komunity.',empty:'Naplánuj si další setkání',emptyIntro:'Nové termíny najdeš v kalendáři a kanálech s oznámeními. Otevři kalendář, sleduj novinky nebo si vyber pravidelný trénink.',error:'Načítání akcí trvá déle než obvykle.',errorIntro:'Aktuální termíny stále najdeš ve veřejném kalendáři a oznámeních.',retry:'Zkusit znovu',announcements:'Oznámení akcí',loyalty:'Učte se spolu. Vracejte se spolu.',loyaltyText:'Doporuč kamaráda: on získá slevu 10 % na první rezervaci a ty 10 % na další. Zeptej se při domlouvání lekce.',first:'Jsi tu poprvé?',difficulty:'Vyber si trasu podle svých sil',walkNote:'Město: 5–12 km, snadné. Jeskyně: 2–6 km, snadné až střední. Hory: 10–25 km, střední až náročné. Cena a místo srazu jsou uvedeny u každé akce.',terms:'Před rezervací si přečti ceny a podmínky.',catalog:'Služby a kompletní ceník',contact:'Kontakty',more:'Prozkoumat',
    },
    uk: {
      skip:'До вмісту',homeTitle:'Навчайся. Досліджуй. Знайди своїх.',homeIntro:'Заняття з Олексієм Черешневим, PhD. Походи з BrnoWalkers. Історичне фехтування з Družina Moravy. Твій наступний крок — у Брно.',trust:'Олексій Черешнев, PhD · Університет Масарика · Брно й онлайн',chooseEyebrow:'ОДНЕ МІСТО. РІЗНІ ШЛЯХИ РОЗВИТКУ.',chooseTitle:'Що тобі цікаво?',
      card0Title:'Заняття та коучинг',card0Intro:'Науки, мови, IT, фітнес і практична підтримка. Обери допомогу під свою задачу.',card0Cta:'Послуги та ціни →',card1Title:'BrnoWalkers',card1Intro:'Відкривай Моравію разом із нами: прогулянки, печери й гірські стежки.',card1Cta:'Обрати прогулянку →',card2Title:'Družina Moravy',card2Intro:'Історичне фехтування, HEMA та LARP. Перше тренування — 120 Kč.',card2Cta:'На перше тренування →',card3Title:'Найближчі події',card3Intro:'Походи, тренування й зустрічі спільноти в одному календарі.',card3Cta:'Переглянути події →',
      home:'Головна',academy:'Академія',calendar:'Календар',reviews:'Відгуки в Google ↗',prices:'Ціни та варіанти',book:'Записатися на заняття',trial:'Перше тренування · 120 Kč',events:'Обрати найближчу подію',select:'Обери свою задачу',search:'Пошук послуг або предметів',all:'Показати всі послуги',noResults:'Нічого не знайдено. Спробуй інший запит або напиши мені.',ask:'Обговорити цю послугу',full:'Усі ціни та пакети',steps:'Як почати',step1:'Обери формат',step2:'Зареєструйся',step3:'Приєднуйся',
      academySteps:['Обери предмет або послугу й переглянь повний прайс.','Розкажи про мету, зручну мову й час.','Погодь формат і час до заняття.'],druzinaSteps:['Переглянь дні тренувань і адресу нижче.','Запишися на перше тренування за 120 Kč.','Познайомся з тренером, спробуй заняття й обери продовження.'],walkersSteps:['Перевір маршрут, відстань, складність і ціну події.','Обери подію у формі реєстрації.','Дотримуйся вказівок щодо місця зустрічі та спорядження в анонсі.'],goals:['Навчання й мови','Фітнес і харчування','Життя в Брно','IT і творчість'],goalNotes:['Підготовка до іспитів, науки, програмування й розмовна практика.','Персональні тренування, харчування й регулярна підтримка.','Практична допомога, житло та індивідуальні екскурсії.','Очищення комп’ютерів, сайти, контент і коучинг.'],
      crossTitle:'Відкрий більше в Брно',crossIntro:'Заняття, тренування чи прогулянка можуть стати початком знайомства. Зазирни до інших проєктів спільноти.',empty:'Плануй наступну зустріч',emptyIntro:'Нові дати з’являються в календарі й каналах анонсів. Переглянь календар, підпишись на новини або обери регулярне тренування.',error:'Список подій завантажується довше, ніж зазвичай.',errorIntro:'Актуальні дати можна переглянути в публічному календарі й каналах анонсів.',retry:'Спробувати ще раз',announcements:'Анонси подій',loyalty:'Навчайтеся разом. Повертайтеся разом.',loyaltyText:'Приведи друга: йому — знижка 10% на перший запис, тобі — 10% на наступний. Уточни під час узгодження заняття.',first:'Уперше тут?',difficulty:'Обери маршрут під свої сили',walkNote:'Місто: 5–12 км, легко. Печери: 2–6 км, легко або середньо. Гори: 10–25 км, середньо або складно. Ціна й місце зустрічі вказані окремо для кожної події.',terms:'Перевір ціни й умови перед записом.',catalog:'Послуги й повний прайс',contact:'Контакти',more:'Переглянути',
    }
  };
  const lang = () => copy[document.documentElement.lang] ? document.documentElement.lang : 'en';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if(cls)n.className=cls; if(text)n.textContent=text; return n; };
  const link = (text, href, cls='btn') => {const a=el('a',cls,text);a.href=href;return a;};
  const section = (id) => {let n=document.getElementById(id);if(!n){n=el('section','experience-section');n.id=id;document.querySelector('main').append(n);}n.replaceChildren();const w=el('div','wrap');n.append(w);return w;};
  function track(name, details={}) {
    // Deliberately excludes search text, contact details, full URLs and query parameters.
    document.dispatchEvent(new CustomEvent('ecosystem:conversion',{detail:{name,page,language:lang(),source:document.referrer ? new URL(document.referrer).hostname : 'direct',...details}}));
  }
  function enhance() {
    const t=copy[lang()];
    document.body.dataset.page=page;
    document.querySelectorAll('[data-exp]').forEach(n=>{if(t[n.dataset.exp])n.textContent=t[n.dataset.exp];});
    document.querySelectorAll('footer a').forEach(a=>{const path=new URL(a.href).pathname;if(path.endsWith('/academy/'))a.textContent=t.academy+' →';if(path.endsWith('/calendar/'))a.textContent=t.calendar+' →';});
    document.querySelectorAll('.reviews-badge').forEach(n=>n.textContent=t.reviews);
    document.querySelectorAll('[data-i18n="tabs.main"]').forEach(n=>n.textContent=t.home);
    document.querySelectorAll('[data-i18n="tabs.academy"]').forEach(n=>n.textContent=t.academy);
    document.querySelectorAll('[data-i18n="tabs.calendar"]').forEach(n=>n.textContent=t.calendar);
    document.querySelectorAll('section > .wrap > h3.anchor-heading').forEach(h=>{const n=el('h2',h.className);n.innerHTML=h.innerHTML;h.replaceWith(n);});
    document.querySelectorAll('.hero img').forEach(n=>n.decoding='async');
    document.querySelectorAll('.tabs-bar a').forEach(n=>{const active=new URL(n.href).pathname===location.pathname;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
    // Localize metadata using the same actual heading and offer as the visible page.
    const title=document.querySelector('h1')?.textContent.trim();
    const description=document.querySelector('.hero .tagline')?.textContent.trim();
    if(title) {document.title=title+(page==='main'?' | Aliaksei Chareshneu, PhD · Brno':' | Brno');for(const key of ['og:title','twitter:title'])document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.setAttribute('content',document.title);}
    if(description)for(const key of ['description','og:description','twitter:description'])document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.setAttribute('content',description);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content',{en:'en_US',ru:'ru_RU',cs:'cs_CZ',uk:'uk_UA'}[lang()]);
    document.querySelector('#langSwitch')?.setAttribute('aria-label',{en:'Language',ru:'Язык',cs:'Jazyk',uk:'Мова'}[lang()]);
    document.querySelectorAll('#langSwitch button').forEach(n=>n.setAttribute('aria-label',{ru:'Русский',en:'English',cs:'Čeština',uk:'Українська'}[n.dataset.lang]));
    if(page==='main') {
      // Old quick links referenced a moved catalogue; keep every real destination.
      const q=document.querySelector('#quick-links .wrap');
      if(q){q.replaceChildren();const row=el('div','events-empty-actions');row.append(link(t.card0Cta,'academy/'),link(t.prices+' · Družina','druzina/#tariff'),link(t.events,'calendar/'));q.append(row);const notes={en:'Brno iD vouchers: ask about eligibility and current support when registering for children’s activities.',ru:'Ваучеры Brno iD: уточни доступность и размер поддержки при записи ребёнка.',cs:'Poukazy Brno iD: při přihlašování dítěte se zeptej na nárok a aktuální výši podpory.',uk:'Ваучери Brno iD: уточни доступність і розмір підтримки під час запису дитини.'};q.append(el('p','note',notes[lang()]));}
      const badge=document.querySelector('#main .reviews-badge'); if(badge)badge.textContent=t.reviews;
    }
    if(['academy','druzina','walkers'].includes(page)) {
      const hero=document.querySelector('.hero-ctas');
      const primary=hero?.querySelector('.btn.solid');
      if(primary){primary.textContent=page==='academy'?t.book:page==='druzina'?t.trial:t.events;primary.href=page==='walkers'?'../calendar/':registration;if(page==='walkers'){primary.removeAttribute('target');primary.removeAttribute('rel');}}
      const secondary=hero?.querySelector('.btn:not(.solid)');
      if(secondary&&page==='academy'){secondary.textContent=t.prices;secondary.href='#service-selector';}
      if(secondary&&page==='druzina'){secondary.textContent=t.prices;secondary.href='#tariff';secondary.removeAttribute('target');}
      const steps=section('first-steps');steps.append(el('p','eyebrow-sm',t.first),el('h2','',t.steps));
      const list=el('ol','journey-steps');t[page+'Steps'].forEach((text,i)=>{const item=el('li');item.append(el('span','step-number','0'+(i+1)),el('h3','',[t.step1,t.step2,t.step3][i]),el('p','',text));list.append(item);});steps.append(list);
      document.querySelector('.hero').after(steps.parentElement);
    }
    if(page==='academy') academy(t);
    if(page==='walkers') {
      const w=section('choose-route');w.append(el('h2','',t.difficulty),el('p','lead',t.walkNote),link(t.events,'../calendar/','btn solid'));document.getElementById('first-steps').after(w.parentElement);
    }
    if(page!=='main') {
      const w=section('explore-more');w.append(el('p','eyebrow-sm','BRNO · COMMUNITY'),el('h2','',t.crossTitle),el('p','lead',t.crossIntro));const row=el('div','cross-grid');
      [['academy',t.card0Title,t.card0Intro],['walkers',t.card1Title,t.card1Intro],['druzina',t.card2Title,t.card2Intro]].filter(x=>x[0]!==page).forEach(([id,title,intro])=>{const a=link('',base+id+'/','cross-card');a.append(el('h3','',title),el('p','',intro),el('span','venture-cta',t.more+' →'));row.append(a);});w.append(row);
    }
    document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
    document.querySelectorAll('.faq-q').forEach(b=>b.setAttribute('aria-expanded',String(b.closest('.faq-item')?.classList.contains('open')||false)));
    // Keep keyboard focus out of the hidden mobile toolbar.
    const mobile=document.querySelector('#mobileCta');if(mobile)mobile.inert=mobile.getAttribute('aria-hidden')==='true';
    document.querySelectorAll('.mobile-cta-btn').forEach(a=>{a.textContent=page==='druzina'?t.trial:page==='academy'?t.book:t.events;if(page==='walkers'||page==='calendar'||page==='main'){a.href=page==='calendar'?'#calendar-events':base+'calendar/';a.removeAttribute('target');}});
    document.documentElement.dataset.enhanced='true';
  }
  function academy(t) {
    const w=section('service-selector');w.append(el('p','eyebrow-sm','ETERNAL LEARNING ACADEMY'),el('h2','',t.select));
    const grid=el('div','goal-grid');const ids=['price-edu','price-fit','price-supp','price-itsec'];
    t.goals.forEach((title,i)=>{const a=link('','#'+ids[i],'goal-card');a.dataset.service=ids[i];a.append(el('span','step-number','0'+(i+1)),el('h3','',title),el('p','',t.goalNotes[i]),el('span','venture-cta',t.prices+' →'));grid.append(a);});w.append(grid);
    const label=el('label','search-label',t.search);label.htmlFor='service-search';const input=el('input','service-search');input.id='service-search';input.type='search';input.placeholder=t.search;input.autocomplete='off';
    const status=el('p','search-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const reset=el('button','btn',t.all);reset.type='button';
    const filter=()=>{const query=input.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();let count=0;document.querySelectorAll('.price-cat').forEach(cat=>{cat.hidden=!cat.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query);if(!cat.hidden)count++;const details=cat.querySelector('.subject-details');if(details)details.open=!!query&&!cat.hidden;});status.textContent=count?'':t.noResults;};
    input.addEventListener('input',filter);reset.addEventListener('click',()=>{input.value='';filter();input.focus();});w.append(label,input,status,reset);
    document.getElementById('first-steps').before(w.parentElement);
    const pricing=document.querySelector('#academy-pricing');if(!pricing.querySelector('h2')){const heading=el('h2','catalog-heading',t.catalog);pricing.querySelector('.wrap').prepend(heading);}else pricing.querySelector('h2').textContent=t.catalog;
    document.querySelectorAll('.price-cat').forEach(cat=>{
      cat.hidden=false;
      const subjects=cat.querySelector('.academy-subjects');
      if(subjects&&!subjects.closest('details')){const details=el('details','subject-details');const summary=el('summary','',t.full+' · '+t.goals[0]);details.append(summary);subjects.before(details);details.append(subjects);cat.querySelector('.tbl-wrap')?.after(details);}
      if(cat.querySelector('.service-action'))return;
      const name=cat.querySelector('h3').textContent.trim();const a=link(t.ask,'https://wa.me/420702914842?text='+encodeURIComponent(name),'btn service-action');a.dataset.service=cat.id;cat.append(a);
    });
    const loyalty=section('pricing-loyalty');loyalty.append(el('h2','',t.loyalty),el('p','lead',t.loyaltyText),link(t.book,registration,'btn solid'));
  }
  // Event delegation survives language-driven DOM replacement.
  document.addEventListener('click',e=>{
    const a=e.target.closest('a,button');if(!a)return;
    if(a.matches('[data-lang]')) {const u=new URL(location.href);u.searchParams.set('lang',a.dataset.lang);history.replaceState(null,'',u);track('language_selected',{language:a.dataset.lang});}
    if(a.matches('.faq-q'))queueMicrotask(()=>a.setAttribute('aria-expanded',String(a.closest('.faq-item').classList.contains('open'))));
    if(!a.href)return;
    const url=new URL(a.href,location.href);if(a.closest('.event-upcoming-card'))track('event_click',{placement:'event_card'});let name='cta_click';
    if(url.hostname==='docs.google.com'&&url.pathname.includes('/forms/'))name='registration_start';
    else if(url.hostname==='calendar.google.com')name='calendar_subscription';
    else if(['t.me','wa.me','chat.whatsapp.com'].includes(url.hostname))name='community_click';
    else if(a.dataset.service)name='service_selection';
    else if(a.closest('.event-upcoming-card'))name='event_click';
    else if(url.hash.startsWith('#price')||url.hash==='#tariff')name='pricing_interaction';
    track(name,{placement:a.closest('.hero')?'hero':a.closest('.mobile-cta')?'mobile':a.closest('.nav')?'navigation':'content',service:a.dataset.service||undefined});
    if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash.startsWith('#price-')) {
      const input=document.getElementById('service-search');if(input){input.value='';document.querySelectorAll('.price-cat').forEach(n=>n.hidden=false);document.querySelector('.search-status').textContent='';}
    }
  });
  const mobile=document.getElementById('mobileCta');if(mobile)new MutationObserver(()=>{mobile.inert=mobile.getAttribute('aria-hidden')==='true';}).observe(mobile,{attributes:true,attributeFilter:['aria-hidden']});
  document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement && e.target.closest('.event-upcoming-card') && !e.target.dataset.fallback){e.target.dataset.fallback='true';e.target.src=base+'images/walkers_group.webp';}},true);
  document.addEventListener('site:language',enhance);
  enhance();
})();
