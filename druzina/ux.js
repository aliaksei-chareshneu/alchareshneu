/* Družina Moravy • accessible progressive language/UX layer.
   No analytics, network requests, auto-booking, profiles or personal data. */
(() => {
  'use strict';
  const translations = {
    en: {
      pageTitle: 'Ranks & achievements', rankSubtitle: 'Approved rules v1.1 · voluntary pilot from 1 November 2026',
      photoAlt:'People learning with padded swords and shields at a real Družina training',photoCaption:'Real Družina training · Brno',navAria:'Browse club information',factsAria:'Training at a glance',moreAria:'More about the club',rankAria:'Jump to a rank category',joinLink:'Join the community',navStart:'Start here', navSchedule:'Days & place', navPath:'Training paths', navRanks:'Ranks', navFaq:'Questions', navAbout:'Who we are',
      startEyebrow:'Your first step', startTitle:'Curious about fencing? You belong here.',
      startLead:'No experience or special equipment needed to ask. We practise with safety, respect and teamwork. Regular dates are indicative — every visit needs individual confirmation.',
      fact1Label:'Usual days',fact1Value:'Monday · Saturday',
      fact2Label:'Usual time',fact2Value:'18:00 · confirm duration',
      fact3Label:'Meeting point',fact3Value:'Nová Zbrojovka · outdoors; confirm exact meeting pin',
      stepsEyebrow:'How your first visit works',step1Title:'Tell us you are interested',step1Desc:'Ask about a future date. No account, payment or commitment from your message.',
      step2Title:'We confirm the details',step2Desc:'We check whether the session can run, venue, organiser, safety requirements and terms. Wait for written confirmation.',
      step3Title:'Learn at your own pace',step3Desc:'Start with STOP, distance and controlled basic movements. You can ask questions or opt out of any sparring.',
      actionTitle:'Not sure which weapon or training suits you?',actionDescription:'Just tell us you are new — we will help you find out what is possible. New paid training bookings are currently paused.',
      contact:'Ask a question on WhatsApp ↗',linkTree:'Explore the skill tree',linkJoin:'Ways to participate',linkRanks:'How ranks work',linkMedia:'Our club in the press',linkChatWA:'WhatsApp announcements',linkChatTG:'Telegram news',
      faqOverline:'Good to know',faqTitle:'Questions before your first visit',
      faqLead:'Clear answers, without pretending that an inquiry is already a booking.',
      faq1Q:'I have never fenced. Can I come?',faq1A:'Yes, beginners are welcome to enquire. Your first supervised practice starts with equipment checks, rules, safe distance and the STOP command. The organiser must confirm the actual event and participant eligibility.',
      faq2Q:'Do I need my own sword, armour or sports kit?',faq2A:'Ask first: basic club practice equipment may be available for a confirmed session. Usually comfortable sportswear, closed shoes and water are enough to start. The instructor will check any equipment before use.',
      faq3Q:'Can I simply arrive on Monday or Saturday?',faq3A:'Please do not travel without an explicit date and venue confirmation. The regular 18:00 timetable is an indication, not proof that a session is going ahead. Your message is not a booking.',
      faq4Q:'Can I pay and register online right now?',faq4A:'No new paid HEMA reservations are open yet. Before any future payment, we must confirm the legal organiser, price, booking terms and activity-specific safety arrangements. Please do not transfer money without that confirmation.',
      faq5Q:'Can I try archery or a different weapon?',faq5A:'The foundation begins with safe movement, a controlled sword and shield, and teamwork. The archer route can be explored after the basic introduction and a safety check, in a separate supervised range.',
      faq6Q:'What if I do not want to spar?',faq6A:'You may refuse any bout, ask to slow down and call STOP at any time. Respect and controlled practice matter more than winning.',
      faq7Q:'How do I earn levels or club honours?',faq7A:'The Pěšák foundation has 12 topics. The internal milestone needs at least 9 distinct demonstrated topics and a supervised practical check. Combat, command and craft ranks are separate and need verified evidence; no automatic awards for payment or bookings.',
      faq8Q:'Can children or teenagers participate?',faq8A:'Please ask the organiser first. A minor needs the appropriate guardian agreement and event-specific confirmation of suitable instructors, safety and insurance. We do not promise eligibility from a general website.',
      pathEyebrow:'A simple start',pathTitle:'Three milestones, no pressure to compete',
      path1Label:'VISIT 01',path1Title:'One shared foundation',path1Desc:'Learn to stop safely, move, control a soft practice weapon and protect your partner.',
      path2Label:'VISIT 02',path2Title:'Explore your preferred path',path2Desc:'With instructor guidance, try shield-line basics or learn the safety rules for a supervised archery range.',
      path3Label:'VISITS 03–04+',path3Title:'Build confidence and get feedback',path3Desc:'Repeat what matters and practise with a partner. Four visits are not an automatic exam, qualification or mandatory package.',
      pathNote:'The training pathway is a pilot concept. Detailed specialisations are drafts; no paid reservation or rank is granted by this page.',
      pathHome:'← Club & visiting information',pathRanks:'See the verified rank rules →',
      rankSummaryTitle:'A fair system for different contributions',
      rankSummaryLead:'Fight safely, coordinate a team or build equipment — different talents count. Qualifications are earned from verified evidence, not purchased, invented from attendance or assigned automatically.',
      rankBTitle:'B · Combat',rankBText:'Practical skills, real training and verified battle days.',
      rankCTitle:'C · Command',rankCText:'Observed safe decision-making and leadership.',
      rankKTitle:'K · Craft',rankKText:'Inspected projects, repairs and knowledge sharing.',
      rankClarify:'A temporary command appointment (O) is not an earned C qualification. Junior / Senior (S) is a separate current participation tariff, not a combat rank. Earlier earned ranks remain valid.',
      rankVisit:'← Visit the club site',rankTree:'Explore the training paths →',
      rankCombat:'Combat',rankCommand:'Command',rankCraft:'Craft',rankAwards:'Achievements',
      rankSwipe:'← Swipe the table horizontally to read every requirement →'
    },
    cs: {
      pageTitle:'Hodnosti a úspěchy',rankSubtitle:'Schválená pravidla v1.1 · dobrovolný pilot od 1. listopadu 2026',
      photoAlt:'Účastníci skutečného tréninku Družiny cvičí s měkčenými meči a štíty',photoCaption:'Skutečný trénink Družiny · Brno',navAria:'Informace o klubu',factsAria:'Trénink v kostce',moreAria:'Další informace o klubu',rankAria:'Přeskočit na kategorii hodností',joinLink:'Zapojit se do družiny',navStart:'Začínáme',navSchedule:'Kdy a kde',navPath:'Výcvikové cesty',navRanks:'Hodnosti',navFaq:'Otázky',navAbout:'O nás',
      startEyebrow:'První krok',startTitle:'Zajímá tě šerm? U nás můžeš začít.',
      startLead:'K nezávaznému dotazu nepotřebuješ zkušenosti ani výbavu. Cvičíme bezpečně, s respektem a jako tým. Rozvrh je orientační — každý termín musí být potvrzen.',
      fact1Label:'Obvyklé dny',fact1Value:'Pondělí · sobota',
      fact2Label:'Obvyklý čas',fact2Value:'18:00 · délku potvrdíme',
      fact3Label:'Místo srazu',fact3Value:'Nová Zbrojovka · venku; přesný sraz potvrdíme',
      stepsEyebrow:'Jak probíhá první návštěva',step1Title:'Napiš, že máš zájem',step1Desc:'Zeptej se na budoucí termín. Samotnou zprávou nic neplatíš ani nerezervuješ.',
      step2Title:'Společně ověříme podrobnosti',step2Desc:'Potvrdíme, zda se trénink koná, místo, pořadatele, bezpečnost a podmínky. Počkej na písemné potvrzení.',
      step3Title:'Trénuj vlastním tempem',step3Desc:'Začneme povelem STOP, vzdáleností a kontrolovanými pohyby. Na cokoli se můžeš zeptat a sparring odmítnout.',
      actionTitle:'Nevíš, jaká zbraň nebo forma tréninku ti sedne?',actionDescription:'Stačí napsat, že jsi nováček. Rádi vysvětlíme možnosti. Nové placené rezervace tréninků jsou prozatím pozastavené.',
      contact:'Nezávazně napsat na WhatsApp ↗',linkTree:'Prohlédnout výcvikové cesty',linkJoin:'Jak se zapojit',linkRanks:'Jak fungují hodnosti',linkMedia:'Napsali o nás',linkChatWA:'Novinky na WhatsAppu',linkChatTG:'Novinky na Telegramu',
      faqOverline:'Dobré vědět',faqTitle:'Než přijdeš poprvé',
      faqLead:'Jasné odpovědi. Nezávazný dotaz není rezervace.',
      faq1Q:'Nikdy jsem nešermoval/a. Můžu přijít?',faq1A:'Ano, začátečníci se mohou nezávazně ozvat. Začíná se kontrolou vybavení, pravidly, bezpečným odstupem a povelem STOP. Konkrétní termín i podmínky účasti musí potvrdit pořadatel.',
      faq2Q:'Potřebuji vlastní meč nebo zbroj?',faq2A:'Nejdřív se zeptej. Základní klubové vybavení může být pro potvrzený trénink dostupné. Obvykle stačí sportovní oblečení, pevné uzavřené boty a voda. Vybavení před použitím kontroluje instruktor.',
      faq3Q:'Stačí přijít v pondělí nebo sobotu?',faq3A:'Bez výslovného potvrzení termínu a místa prosím necestuj. Běžný rozvrh od 18:00 je orientační. Odeslaná zpráva neznamená rezervaci.',
      faq4Q:'Můžu teď zaplatit a zaregistrovat se online?',faq4A:'Nové placené rezervace HEMA zatím nejsou otevřené. Před případnou platbou musí být potvrzen pořadatel, cena, rezervační podmínky a bezpečnost pro danou akci. Bez toho peníze neposílej.',
      faq5Q:'Můžu si vyzkoušet luk nebo jinou zbraň?',faq5A:'Společný začátek tvoří bezpečný pohyb, kontrolovaný meč a štít a spolupráce. Cestu lučištníka lze prozkoumat po úvodu a bezpečnostní kontrole na oddělené střelnici pod dohledem.',
      faq6Q:'Co když nechci sparrovat?',faq6A:'Souboj můžeš odmítnout, požádat o nižší intenzitu nebo kdykoli říct STOP. Respekt a kontrola mají přednost před vítězstvím.',
      faq7Q:'Jak se získávají úrovně a ocenění?',faq7A:'Základ Pěšák má 12 témat. Pro interní milník je třeba bezpečně zvládnout alespoň 9 různých témat a praktické ověření. Bojové, velitelské a řemeslné hodnosti se hodnotí zvlášť na základě důkazů; samotná platba ani rezervace nestačí.',
      faq8Q:'Mohou přijít děti nebo mladiství?',faq8A:'Nejdřív se zeptej pořadatele. U nezletilých je potřeba příslušný souhlas zákonného zástupce a potvrzení bezpečnosti, dozoru i pojištění konkrétní akce. Web sám účast nezaručuje.',
      pathEyebrow:'Jednoduchý začátek',pathTitle:'Tři kroky bez tlaku na soutěžení',
      path1Label:'NÁVŠTĚVA 01',path1Title:'Společný bezpečný základ',path1Desc:'Zastavit na povel, pohybovat se, ovládat měkčenou zbraň a chránit partnera.',
      path2Label:'NÁVŠTĚVA 02',path2Title:'Poznej svou cestu',path2Desc:'S instruktorem prozkoumej základy štítové linie nebo bezpečnost samostatně vedené lukostřelby.',
      path3Label:'NÁVŠTĚVY 03–04+',path3Title:'Trénink a zpětná vazba',path3Desc:'Vracej se k důležitým dovednostem a zkoušej spolupráci. Čtyři návštěvy nejsou automatická zkouška ani povinný balíček.',
      pathNote:'Výukové cesty jsou pilotní koncept. Pokročilé specializace jsou rozpracované. Tato stránka neumožňuje placenou rezervaci ani neuděluje hodnosti.',
      pathHome:'← Klub a informace pro návštěvu',pathRanks:'Ověřená pravidla hodností →',
      rankSummaryTitle:'Různé zásluhy, férové hodnocení',
      rankSummaryLead:'Někdo vyniká v boji, jiný vede tým nebo vyrábí výstroj. Kvalifikace se získávají ověřenými činy a dovednostmi — ne nákupem ani automaticky.',
      rankBTitle:'B · Boj',rankBText:'Praktické dovednosti, skutečné tréninky a ověřené bojové dny.',
      rankCTitle:'C · Velení',rankCText:'Pozorované bezpečné rozhodování a vedení.',
      rankKTitle:'K · Řemeslo',rankKText:'Zkontrolované výrobky, opravy a předávání znalostí.',
      rankClarify:'Dočasná velitelská funkce (O) není kvalifikace C. Junior / Senior (S) je samostatný aktuální tarif účasti, nikoli bojová hodnost. Již získané hodnosti platí dál.',
      rankVisit:'← Informace o klubu',rankTree:'Prohlédnout výcvikové cesty →',
      rankCombat:'Boj',rankCommand:'Velení',rankCraft:'Řemeslo',rankAwards:'Úspěchy',rankSwipe:'← Tabulku lze posunout do stran →'
    },
    ru: {
      pageTitle:'Звания и достижения',rankSubtitle:'Утверждённые правила v1.1 · добровольный пилот с 1 ноября 2026',
      photoAlt:'Участники настоящей тренировки Дружины учатся с мягкими мечами и щитами',photoCaption:'Настоящая тренировка Дружины · Брно',navAria:'Разделы о клубе',factsAria:'Кратко о занятиях',moreAria:'Подробнее о клубе',rankAria:'Переход к категории званий',joinLink:'Вступить в сообщество',navStart:'Новичкам',navSchedule:'Когда и где',navPath:'Пути развития',navRanks:'Звания',navFaq:'Вопросы',navAbout:'О клубе',
      startEyebrow:'Начать просто',startTitle:'Хочешь попробовать фехтование? Тебе сюда.',
      startLead:'Чтобы спросить о тренировке, не нужны опыт и своё снаряжение. Учимся безопасно, с уважением друг к другу. Расписание ориентировочное: каждый визит подтверждается отдельно.',
      fact1Label:'Обычно тренируемся',fact1Value:'Понедельник · суббота',
      fact2Label:'Время',fact2Value:'18:00 · длительность уточняется',
      fact3Label:'Место встречи',fact3Value:'Nová Zbrojovka · на улице; точку встречи уточним',
      stepsEyebrow:'Как попасть на первое занятие',step1Title:'Напиши нам',step1Desc:'Спроси о ближайшей подходящей дате. Сообщение ни к чему не обязывает и ничего не бронирует.',
      step2Title:'Мы уточним условия',step2Desc:'Проверим, состоится ли занятие, место, организатора, безопасность и условия. Дождись письменного подтверждения.',
      step3Title:'Осваивай навыки в своём темпе',step3Desc:'Сначала команда STOP, дистанция и контроль движений. Можно спрашивать, снижать темп или отказаться от спарринга.',
      actionTitle:'Не знаешь, какое оружие или направление выбрать?',actionDescription:'Просто скажи, что ты новичок. Объясним варианты. Новые платные бронирования тренировок пока приостановлены.',
      contact:'Написать в Telegram ↗',linkTree:'Посмотреть пути развития',linkJoin:'Как присоединиться',linkRanks:'Как устроены звания',linkMedia:'Дружина в СМИ',linkChatWA:'Новости в WhatsApp',linkChatTG:'Новости в Telegram',
      faqOverline:'Без сюрпризов',faqTitle:'Частые вопросы перед тренировкой',
      faqLead:'Понятные ответы: запрос даты — ещё не запись.',
      faq1Q:'Я никогда не фехтовал. Можно попробовать?',faq1A:'Да, новичкам можно написать и уточнить участие. Начинаем с проверки инвентаря, правил, безопасной дистанции и команды STOP. Дату и допуск должен подтвердить организатор.',
      faq2Q:'Нужен свой меч, доспех или форма?',faq2A:'Сначала уточни: на подтверждённом занятии может быть доступно базовое клубное снаряжение. Обычно достаточно спортивной одежды, закрытой обуви и воды. Всё используемое оружие проверяет инструктор.',
      faq3Q:'Можно просто прийти в понедельник или субботу?',faq3A:'Не приезжай без явного подтверждения даты и места. Время 18:00 — обычный ориентир, а не гарантия занятия. Одно сообщение не создаёт бронь.',
      faq4Q:'Можно сейчас оплатить и записаться через сайт?',faq4A:'Новые платные бронирования HEMA пока закрыты. Перед будущей оплатой должны быть подтверждены организатор, цена, правила записи и безопасность мероприятия. До этого деньги не переводи.',
      faq5Q:'Можно попробовать лук или другое оружие?',faq5A:'Начальный общий блок — безопасное движение, контроль меча и щита, командная работа. Стрельбу из лука можно изучать после вводного инструктажа и проверки безопасности, отдельно от общего боя и под наблюдением.',
      faq6Q:'А если я не хочу драться в спарринге?',faq6A:'Можно отказаться от боя без объяснений, попросить снизить интенсивность и в любой момент сказать STOP. Безопасность и уважение важнее победы.',
      faq7Q:'Как получают уровни и награды?',faq7A:'В основе Pěšák 12 тем. Для внутреннего рубежа нужны не менее 9 разных проверенных тем и практический зачёт. Боевые, командные и ремесленные звания проверяются отдельно; оплата и брони ничего автоматически не дают.',
      faq8Q:'Можно детям и подросткам?',faq8A:'Сначала нужно согласовать с организатором. Для несовершеннолетних требуется согласие законного представителя и подтверждение безопасности, подходящего инструктора и страхования конкретного мероприятия. Сам сайт не гарантирует допуск.',
      pathEyebrow:'С чего начать',pathTitle:'Три этапа без давления и обязательных дуэлей',
      path1Label:'ВИЗИТ 01',path1Title:'Общая безопасная база',path1Desc:'Команда STOP, движение, контроль мягкого оружия и безопасность партнёра.',
      path2Label:'ВИЗИТ 02',path2Title:'Попробуй своё направление',path2Desc:'С инструктором изучи основы строя со щитом или правила безопасной стрельбы из лука.',
      path3Label:'ВИЗИТЫ 03–04+',path3Title:'Практика и обратная связь',path3Desc:'Повторяй навыки и тренируйся с партнёром. Четыре посещения — не автоматический экзамен, ранг или обязательный пакет.',
      pathNote:'Учебные направления — пилотный проект. Продвинутые специализации пока в разработке; страница не открывает платные бронирования и не присваивает ранги.',
      pathHome:'← О клубе и первом визите',pathRanks:'Подтверждённые правила званий →',
      rankSummaryTitle:'Уважаем разные таланты',
      rankSummaryLead:'Можно развиваться в безопасном бою, управлении группой или ремесле. Квалификация подтверждается навыками и фактами — не деньгами, списками бронирований или самооценкой.',
      rankBTitle:'B · Бой',rankBText:'Навыки, реальные тренировки и подтверждённые дни битв.',
      rankCTitle:'C · Командование',rankCText:'Наблюдаемое безопасное принятие решений и руководство.',
      rankKTitle:'K · Ремесло',rankKText:'Проверенные изделия, ремонт и передача знаний.',
      rankClarify:'Временная командная должность (O) — не заслуженная квалификация C. Junior / Senior (S) — отдельный текущий тариф участия, не боевой ранг. Старые заслуженные звания сохраняются.',
      rankVisit:'← На главную страницу клуба',rankTree:'Изучить учебные направления →',
      rankCombat:'Бой',rankCommand:'Командование',rankCraft:'Ремесло',rankAwards:'Достижения',rankSwipe:'← Таблицу можно пролистывать в стороны →'
    },
    uk: {
      pageTitle:'Звання та досягнення',rankSubtitle:'Затверджені правила v1.1 · добровільний пілот з 1 листопада 2026',
      photoAlt:'Учасники тренування Дружини вправляються з м’якими мечами й щитами',photoCaption:'Справжнє тренування Дружини · Брно',navAria:'Розділи про клуб',factsAria:'Коротко про тренування',moreAria:'Докладніше про клуб',rankAria:'Перейти до категорії звань',joinLink:'Долучитися до спільноти',navStart:'Новачкам',navSchedule:'Коли та де',navPath:'Шляхи навчання',navRanks:'Звання',navFaq:'Запитання',navAbout:'Про клуб',
      startEyebrow:'Перший крок',startTitle:'Хочеш спробувати фехтування? Почни тут.',
      startLead:'Щоб запитати про тренування, не потрібні досвід або власне спорядження. Навчаємося безпечно й з повагою. Розклад орієнтовний — кожен візит підтверджується окремо.',
      fact1Label:'Звичайні дні',fact1Value:'Понеділок · субота',
      fact2Label:'Звичайний час',fact2Value:'18:00 · тривалість уточнюється',
      fact3Label:'Місце зустрічі',fact3Value:'Nová Zbrojovka · надворі; місце зустрічі уточнимо',
      stepsEyebrow:'Як проходить перший візит',step1Title:'Напиши нам',step1Desc:'Запитай про зручну дату. Повідомлення ні до чого не зобов’язує та не бронює місце.',
      step2Title:'Ми уточнимо умови',step2Desc:'Перевіримо, чи відбудеться заняття, місце, організатора, безпеку та правила. Дочекайся письмового підтвердження.',
      step3Title:'Рухайся у своєму темпі',step3Desc:'Спочатку команда STOP, дистанція та контроль рухів. Можна ставити запитання або відмовитися від спарингу.',
      actionTitle:'Не знаєш, яку зброю чи напрям вибрати?',actionDescription:'Просто скажи, що ти новачок. Пояснимо можливості. Нові платні бронювання тренувань наразі призупинені.',
      contact:'Запитати у WhatsApp ↗',linkTree:'Переглянути шляхи розвитку',linkJoin:'Як долучитися',linkRanks:'Як працюють звання',linkMedia:'Дружина у ЗМІ',linkChatWA:'Новини у WhatsApp',linkChatTG:'Новини у Telegram',
      faqOverline:'Корисно знати',faqTitle:'Запитання перед першим візитом',
      faqLead:'Чіткі відповіді: запит про дату ще не є бронюванням.',
      faq1Q:'Я ніколи не фехтував/ла. Можна спробувати?',faq1A:'Так, новачки можуть написати й уточнити участь. Початок — перевірка спорядження, правила, безпечна дистанція та команда STOP. Конкретну дату й допуск підтверджує організатор.',
      faq2Q:'Потрібен власний меч чи обладунки?',faq2A:'Спочатку уточни: для підтвердженого тренування може бути доступне базове клубне спорядження. Зазвичай достатньо спортивного одягу, закритого взуття та води. Обладнання перевіряє інструктор.',
      faq3Q:'Можна просто прийти у понеділок чи суботу?',faq3A:'Без підтвердження дати й місця не приїжджай. Звичайний початок о 18:00 — орієнтир, а не гарантія заняття. Повідомлення не є бронюванням.',
      faq4Q:'Можна вже сплатити й записатися онлайн?',faq4A:'Нові платні бронювання HEMA поки закриті. Перед майбутньою оплатою мають бути підтверджені організатор, ціна, правила запису та безпека заходу. До того гроші не переказуй.',
      faq5Q:'Можна спробувати лук чи іншу зброю?',faq5A:'Спільна основа — безпечний рух, контроль меча та щита, робота команди. Стрільбу з лука вивчають після вступу та перевірки безпеки, окремо від загального бою під наглядом.',
      faq6Q:'А якщо я не хочу спарингу?',faq6A:'Можна відмовитися від бою, попросити меншу інтенсивність і в будь-який момент сказати STOP. Безпека та повага важливіші за перемогу.',
      faq7Q:'Як отримати рівні та відзнаки?',faq7A:'Основний курс Pěšák містить 12 тем. Для внутрішнього рівня потрібно опанувати принаймні 9 різних підтверджених тем і пройти практичну перевірку. Бойові, командні та ремісничі звання перевіряють окремо; платежі не дають автоматичних нагород.',
      faq8Q:'Чи можуть брати участь діти й підлітки?',faq8A:'Спочатку звернися до організатора. Для неповнолітніх потрібна згода законного представника та підтвердження належного нагляду, безпеки й страхування конкретної події. Сайт не гарантує допуск.',
      pathEyebrow:'Легкий старт',pathTitle:'Три етапи без тиску та обов’язкових двобоїв',
      path1Label:'ВІЗИТ 01',path1Title:'Спільна безпечна база',path1Desc:'Команда STOP, рух, контроль м’якої зброї та безпека партнера.',
      path2Label:'ВІЗИТ 02',path2Title:'Спробуй свій напрям',path2Desc:'З інструктором вивчи основу щитового строю або правила безпечної стрільби з лука.',
      path3Label:'ВІЗИТИ 03–04+',path3Title:'Практика та зворотний зв’язок',path3Desc:'Повторюй уміння й працюй у парі. Чотири заняття — не автоматичний іспит, ранг чи обов’язковий пакет.',
      pathNote:'Шляхи навчання — пілотний проєкт. Просунуті спеціалізації поки в розробці. Сторінка не відкриває платні бронювання й не присвоює ранги.',
      pathHome:'← Про клуб і перший візит',pathRanks:'Затверджені правила звань →',
      rankSummaryTitle:'Різні таланти — справедлива оцінка',
      rankSummaryLead:'Можна розвиватися у безпечному бою, керуванні групою чи ремеслі. Кваліфікацію підтверджують уміння та факти, а не оплата чи бронювання.',
      rankBTitle:'B · Бій',rankBText:'Уміння, фактичні тренування та підтверджені дні битв.',
      rankCTitle:'C · Командування',rankCText:'Спостережуване безпечне ухвалення рішень та керівництво.',
      rankKTitle:'K · Ремесло',rankKText:'Перевірені вироби, ремонти та передавання знань.',
      rankClarify:'Тимчасова командна роль (O) — не здобута кваліфікація C. Junior / Senior (S) — окремий поточний тариф участі, не бойовий ранг. Раніше отримані звання зберігаються.',
      rankVisit:'← На сайт клубу',rankTree:'Переглянути навчальні напрями →',
      rankCombat:'Бій',rankCommand:'Командування',rankCraft:'Ремесло',rankAwards:'Досягнення',rankSwipe:'← Таблицю можна гортати вбік →'
    },
    be: {
      rankAria:'Катэгорыі званняў',joinLink:'Далучыцца да супольнасці',pageTitle:'Званні і дасягненні',rankSubtitle:'Зацверджаныя правілы v1.1 · добраахвотны пілот з 1 лістапада 2026',
      rankSummaryTitle:'Розныя таленты — справядлівая ацэнка',
      rankSummaryLead:'Бой, кіраўніцтва і рамяство — розныя шляхі развіцця. Кваліфікацыю пацвярджаюць рэальнымі навыкамі і доказамі, а не аплатай.',
      rankBTitle:'B · Бой',rankBText:'Правераныя навыкі, трэніроўкі і дні бітваў.',
      rankCTitle:'C · Камандаванне',rankCText:'Бяспечныя рашэнні і назіранае кіраўніцтва.',
      rankKTitle:'K · Рамяство',rankKText:'Правераныя вырабы, рамонты і навучанне іншых.',
      rankClarify:'Часовае камандаванне (O) не роўнае кваліфікацыі C. Junior / Senior (S) — асобны тарыф удзелу, а не баявое званне. Раней атрыманыя званні захоўваюцца.',
      rankVisit:'← Пра клуб',rankTree:'Шляхі навучання →',
      rankCombat:'Бой',rankCommand:'Камандаванне',rankCraft:'Рамяство',rankAwards:'Дасягненні',rankSwipe:'← Табліцу можна гартаць убок →'
    },
    sk: {
      rankAria:'Kategórie hodností',joinLink:'Zapojiť sa do komunity',pageTitle:'Hodnosti a úspechy',rankSubtitle:'Schválené pravidlá v1.1 · dobrovoľný pilot od 1. novembra 2026',
      rankSummaryTitle:'Rôzne schopnosti, spravodlivé hodnotenie',
      rankSummaryLead:'Boj, vedenie tímu aj remeslo sú rôzne cesty rozvoja. Kvalifikácia sa overuje reálnymi schopnosťami a dôkazmi, nie platbou.',
      rankBTitle:'B · Boj',rankBText:'Overené zručnosti, tréningy a dni bitiek.',
      rankCTitle:'C · Velenie',rankCText:'Pozorované bezpečné rozhodnutia a vedenie.',
      rankKTitle:'K · Remeslo',rankKText:'Skontrolované výrobky, opravy a odovzdávanie vedomostí.',
      rankClarify:'Dočasná veliteľská rola (O) nie je získaná kvalifikácia C. Junior / Senior (S) je samostatná aktuálna tarifa účasti, nie bojová hodnosť. Staršie získané hodnosti platia ďalej.',
      rankVisit:'← O klube',rankTree:'Výcvikové cesty →',
      rankCombat:'Boj',rankCommand:'Velenie',rankCraft:'Remeslo',rankAwards:'Úspechy',rankSwipe:'← Tabuľku možno posúvať do strán →'
    }
  };

  const fallback = translations.en;
  const code = () => { const c=(document.documentElement.lang||'en').slice(0,2).toLowerCase(); return translations[c]?c:'en'; };
  const get = (key) => (translations[code()]&&translations[code()][key]) || fallback[key] || '';
  function setPageTitle() {
    const lc=code();
    const seo={
      en:'Historical fencing & LARP in Brno | Družina Moravy',
      cs:'Historický šerm a LARP v Brně | Družina Moravy',
      ru:'Историческое фехтование и LARP в Брно | Družina Moravy',
      uk:'Історичне фехтування та LARP у Брно | Družina Moravy'
    };
    if(document.body.classList.contains('dm-ux-home'))document.title=seo[lc]||seo.en;
    else if(document.body.classList.contains('dm-ux-ranks'))document.title=(get('pageTitle')||'Ranks & achievements')+' | Družina Moravy';
  }
  const render = () => {
    setPageTitle();
    const heroContact=document.querySelector('#druzina .dm-hero-register');
    if(heroContact){
      heroContact.href=code()==='ru'?'https://t.me/Chareshneu':'https://wa.me/420702914842?text='+encodeURIComponent('Hello! I would like to ask about a possible Druzina Moravy session at least 48 hours in advance. Please confirm the exact date, time, venue, organiser, conditions and safety in writing. My message is an enquiry, not a booking.');
    }
    const introContact=document.querySelector('.dm-contact-button');
    if(introContact){const ru=code()==='ru';introContact.href=ru?'https://t.me/Chareshneu':'https://wa.me/420702914842?text='+encodeURIComponent('Hello, I would like to ask about a possible beginner Družina Moravy session. This is an enquiry, not a booking.');introContact.setAttribute('aria-label',get('contact'));}
    document.querySelectorAll('[data-dm-k]').forEach(el => {
      const value=get(el.dataset.dmK);
      if(value) el.textContent=value;
    });
    document.querySelectorAll('[data-dm-alt]').forEach(el => { const v=get(el.dataset.dmAlt);if(v)el.setAttribute('alt',v); });
    document.querySelectorAll('[data-dm-aria]').forEach(el => {
      const value=get(el.dataset.dmAria);
      if(value) el.setAttribute('aria-label',value);
    });
  };
  const rankHeads = () => {
    document.querySelectorAll('.panel[data-locale]').forEach(panel => {
      const hs=[...panel.querySelectorAll('h2')];
      if(hs.length>=6){
        ['combat','command','craft','awards'].forEach((part,i)=>{
          const node=hs[i+2];
          if(node)node.id='dm-rank-'+panel.dataset.locale+'-'+part;
        });
      }
    });
  };
  const moveRank = (e) => {
    const button=e.target.closest('button[data-dm-rank-to]');
    if(!button)return;
    const panel=document.querySelector('.panel[data-locale]:not([hidden])');
    const dest=panel?.querySelector('#dm-rank-'+panel.dataset.locale+'-'+button.dataset.dmRankTo);
    if(dest){dest.setAttribute('tabindex','-1');dest.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});try{dest.focus({preventScroll:true})}catch(_){}}
  };
  function revealHiddenAnchor(){
    if(!document.body.classList.contains('dm-ux-home') || !location.hash)return;
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch(_){return;}
    const target=document.getElementById(id);
    const parent=target?.closest('details.dm-disclosure');
    if(parent && !parent.open){
      parent.open=true;
      requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
    }
  }
  function init(){
    rankHeads();
    revealHiddenAnchor();
    window.addEventListener('hashchange',revealHiddenAnchor);
    document.addEventListener('click',e=>{
      const a=e.target.closest('a[href^="#"]');
      if(!a)return;
      let id;try{id=decodeURIComponent(a.hash.slice(1));}catch(_){return;}
      const target=document.getElementById(id);
      const parent=target?.closest('details.dm-disclosure');
      if(parent)parent.open=true;
    });
    render();
    document.addEventListener('site:language',render);
    document.addEventListener('click',e=>{
      moveRank(e);
      if(e.target.closest('#langSwitch button,.langbar button,.langs button[data-lang]')){
        queueMicrotask(render);
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();