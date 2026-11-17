/* Public RSVP event catalogue presentation translations.
 * Source-of-truth event IDs, times, prices, booking statuses and payment terms
 * remain on the server; only display titles and venue descriptions are localized.
 * Keys are exact catalogue strings, so a changed source is never silently
 * overridden with an obsolete location or programme.
 */
(function (root) {
  'use strict';
  const TITLES = {
  'Družina Moravy · HEMA — práce ve dvojicích (23.11.)': {
    cs: 'Družina Moravy · HEMA — práce ve dvojicích (po 23. 11.)',
    en: 'Družina Moravy · HEMA — partner drills (Mon 23 Nov)',
    ru: 'Družina Moravy · HEMA — работа в парах (пн, 23.11)',
    uk: 'Družina Moravy · HEMA — робота в парах (пн, 23.11)'
  },
  'Družina Moravy · HEMA — sobotní trénink (28.11.)': {
    cs: 'Družina Moravy · HEMA — sobotní trénink (28. 11.)',
    en: 'Družina Moravy · HEMA — Saturday training (28 Nov)',
    ru: 'Družina Moravy · HEMA — субботняя тренировка (28.11)',
    uk: 'Družina Moravy · HEMA — суботнє тренування (28.11)'
  },

    'Morava v pohybu · Kalistenika I — základy zdarma': {
      cs: 'Morava v pohybu · Kalistenika I — základy zdarma',
      en: 'Morava v pohybu · Calisthenics I — free beginner workshop',
      ru: 'Morava v pohybu · Калистеника I — бесплатные основы',
      uk: 'Morava v pohybu · Калістеніка I — безкоштовні основи'
    },
    'Morava v pohybu · Kalistenika II — síla zdarma': {
      cs: 'Morava v pohybu · Kalistenika II — síla zdarma',
      en: 'Morava v pohybu · Calisthenics II — free strength workshop',
      ru: 'Morava v pohybu · Калистеника II — бесплатное занятие на силу',
      uk: 'Morava v pohybu · Калістеніка II — безкоштовне силове заняття'
    },
    'Družina — техника и тактика (план)': {
      cs: 'Družina — technika a taktika (předběžný plán)',
      en: 'Družina — technique and tactics (tentative)',
      ru: 'Družina — техника и тактика (план)',
      uk: 'Družina — техніка й тактика (попередній план)'
    },
    'Družina — групповой бой и строй (план)': {
      cs: 'Družina — skupinový boj a formace (předběžný plán)',
      en: 'Družina — group combat and formations (tentative)',
      ru: 'Družina — групповой бой и строй (план)',
      uk: 'Družina — груповий бій і стрій (попередній план)'
    },
    'Družina — техника и работа в паре (план)': {
      cs: 'Družina — technika a cvičení ve dvojicích (předběžný plán)',
      en: 'Družina — technique and partner drills (tentative)',
      ru: 'Družina — техника и работа в паре (план)',
      uk: 'Družina — техніка й робота в парі (попередній план)'
    },
    'Družina — сценарии и тактика (план)': {
      cs: 'Družina — scénáře a taktika (předběžný plán)',
      en: 'Družina — scenarios and tactics (tentative)',
      ru: 'Družina — сценарии и тактика (план)',
      uk: 'Družina — сценарії й тактика (попередній план)'
    },
    'Družina — групповой бой (план)': {
      cs: 'Družina — skupinový boj (předběžný plán)',
      en: 'Družina — group combat (tentative)',
      ru: 'Družina — групповой бой (план)',
      uk: 'Družina — груповий бій (попередній план)'
    },
    'Družina — техника (план)': {
      cs: 'Družina — technika (předběžný plán)',
      en: 'Družina — technique (tentative)',
      ru: 'Družina — техника (план)',
      uk: 'Družina — техніка (попередній план)'
    },
    'Družina — сценарии (план)': {
      cs: 'Družina — scénáře (předběžný plán)',
      en: 'Družina — scenarios (tentative)',
      ru: 'Družina — сценарии (план)',
      uk: 'Družina — сценарії (попередній план)'
    },
    'Advanced HEMA — workshop I (площадка не подтверждена)': {
      cs: 'Pokročilé HEMA — workshop I (místo nepotvrzeno)',
      en: 'Advanced HEMA — workshop I (venue unconfirmed)',
      ru: 'Продвинутый HEMA — мастер-класс I (площадка не подтверждена)',
      uk: 'Поглиблений HEMA — воркшоп I (місце не підтверджено)'
    },
    'Advanced HEMA — workshop II (площадка не подтверждена)': {
      cs: 'Pokročilé HEMA — workshop II (místo nepotvrzeno)',
      en: 'Advanced HEMA — workshop II (venue unconfirmed)',
      ru: 'Продвинутый HEMA — мастер-класс II (площадка не подтверждена)',
      uk: 'Поглиблений HEMA — воркшоп II (місце не підтверджено)'
    },
    'BrnoWalkers — Brno, které zmizelo | историческая экскурсия': {
      cs: 'BrnoWalkers — Brno, které zmizelo | historická prohlídka',
      en: 'BrnoWalkers — The Brno That Disappeared | historical city tour',
      ru: 'BrnoWalkers — Исчезнувшее Брно | историческая экскурсия',
      uk: 'BrnoWalkers — Зникле Брно | історична екскурсія'
    },
    'BrnoWalkers — Červený kopec → Kamenná kolonie (18+)': {
      cs: 'BrnoWalkers — Červený kopec → Kamenná kolonie (18+)',
      en: 'BrnoWalkers — Červený kopec to Kamenná kolonie (18+)',
      ru: 'BrnoWalkers — Червены копец → Каменна колоние (18+)',
      uk: 'BrnoWalkers — Червений копець → Каменна колоніє (18+)'
    },
    'BrnoWalkers · Green Walk & Talk — Nature & New Friends (15 Nov)': {
      cs: 'BrnoWalkers · Zelená procházka a povídání — příroda a noví přátelé',
      en: 'BrnoWalkers · Green Walk & Talk — nature and new friends',
      ru: 'BrnoWalkers · Прогулка на природе и общение — новые знакомства',
      uk: 'BrnoWalkers · Прогулянка на природі та спілкування — нові знайомства'
    },
    'BrnoWalkers · Brno After Dark — City Stories & Walk & Talk (18 Nov)': {
      cs: 'BrnoWalkers · Brno po setmění — městské příběhy a procházka',
      en: 'BrnoWalkers · Brno After Dark — city stories and walk & talk',
      ru: 'BrnoWalkers · Брно после заката — истории города и прогулка',
      uk: 'BrnoWalkers · Брно після заходу сонця — історії міста й прогулянка'
    },
    'BrnoWalkers — Obřany → Bílovice nad Svitavou | Free community hike': {
      cs: 'BrnoWalkers — Obřany → Bílovice nad Svitavou | bezplatný komunitní výlet',
      en: 'BrnoWalkers — Obřany to Bílovice nad Svitavou | free community hike',
      ru: 'BrnoWalkers — Обраны → Биловице-над-Свитавоу | бесплатный поход',
      uk: 'BrnoWalkers — Обжани → Біловіце-над-Світавою | безкоштовний похід'
    }
  };
  const VENUES = {
    'Nová Zbrojovka, Brno — přesný sraz po potvrzení': {
      cs: 'Nová Zbrojovka, Brno — přesný sraz po potvrzení',
      en: 'Nová Zbrojovka, Brno — meeting point only after confirmation',
      ru: 'Nová Zbrojovka, Брно — точка сбора после подтверждения',
      uk: 'Nová Zbrojovka, Брно — місце збору після підтвердження'
    },
    'Nová Zbrojovka, Brno (точка не подтверждена)': {
      cs: 'Nová Zbrojovka, Brno (přesné místo srazu nepotvrzeno)',
      en: 'Nová Zbrojovka, Brno (exact meeting point unconfirmed)',
      ru: 'Nová Zbrojovka, Брно (точка встречи не подтверждена)',
      uk: 'Nová Zbrojovka, Брно (точку зустрічі не підтверджено)'
    },
    'Brno, площадка подбирается (MENDELU B1/B2 недоступны)': {
      cs: 'Brno, místo se hledá (MENDELU B1/B2 nejsou dostupné)',
      en: 'Brno, venue not secured (MENDELU B1/B2 unavailable)',
      ru: 'Брно, площадка подбирается (MENDELU B1/B2 недоступны)',
      uk: 'Брно, місце ще шукають (MENDELU B1/B2 недоступні)'
    },
    'Центр Брно (сбор после подтверждения минимальной группы)': {
      cs: 'Centrum Brna (sraz až po potvrzení minimální skupiny)',
      en: 'Central Brno (meeting point after minimum group confirmation)',
      ru: 'Центр Брно (место сбора после подтверждения минимальной группы)',
      uk: 'Центр Брна (місце збору після підтвердження мінімальної групи)'
    },
    'OUTSIDE Jurkovičova vila': {
      cs: 'Před Jurkovičovou vilou',
      en: 'Outside Jurkovičova vila',
      ru: 'Снаружи у Jurkovičova vila',
      uk: 'Зовні біля Jurkovičova vila'
    },
    'OUTSIDE Dům umění města Brna': {
      cs: 'Před Domem umění města Brna',
      en: 'Outside Dům umění města Brna',
      ru: 'Снаружи у Dům umění města Brna',
      uk: 'Зовні біля Dům umění města Brna'
    },
    'Brno hlavní nádraží — main entrance': {
      cs: 'Brno hlavní nádraží — hlavní vchod',
      en: 'Brno main railway station — main entrance',
      ru: 'Главный вокзал Брно — главный вход',
      uk: 'Головний вокзал Брна — головний вхід'
    }
  };
  const UNKNOWN = {
    cs: {title:'Podrobnosti akce upřesní pořadatel',venue:'Místo upřesní pořadatel'},
    en: {title:'Event details to be confirmed by the organiser',venue:'Venue to be confirmed by the organiser'},
    ru: {title:'Детали мероприятия уточнит организатор',venue:'Место уточнит организатор'},
    uk: {title:'Подробиці події уточнить організатор',venue:'Місце уточнить організатор'}
  };
  function localized(event, locale, field) {
    if (!event) return '';
    const lang = Object.prototype.hasOwnProperty.call(UNKNOWN,locale) ? locale : 'cs';
    const original = String(event[field] || '').trim();
    // Forward-compatible: the API can later provide structured locale fields.
    const multi = event[field + '_i18n'] || event[field + '_translations'];
    if (multi && typeof multi === 'object' && typeof multi[lang] === 'string' && multi[lang].trim()) {
      return multi[lang].trim();
    }
    const direct = event[field + '_' + lang];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const known = (field === 'title' ? TITLES : VENUES)[original];
    if (known && known[lang]) return known[lang];
    // Prevent a future Russian-only catalogue record leaking into CZ/EN/UA.
    if (lang !== 'ru' && /[\u0400-\u052f]/u.test(original)) {
      return (event.community ? String(event.community) + ' — ' : '') + UNKNOWN[lang][field];
    }
    return original;
  }
  const NOTES = {
  'PUB-HEMA-20261123': {
    check: 'ORGANIZAČNÍ GO PRO TERMÍN',
    cs: 'Pondělí 23. 11. 18:00–20:00: nezávazné přihlášky jsou otevřené. Termín schválil pořadatel; přesný bezpečný sraz, kapacita, dostupnost vybavení a místo každého účastníka vyžadují osobní písemné potvrzení. Do té doby neplaťte ani nejezděte.',
    en: 'Monday 23 Nov 18:00–20:00: preliminary registration is open. The organiser has approved this date; the safe meeting point, capacity, loan equipment and each place still require personal written confirmation. Please do not pay or travel before then.',
    ru: 'Понедельник, 23.11, 18:00–20:00: предварительная запись открыта. Организатор согласовал дату; место сбора, безопасность, вместимость, выдачу снаряжения и участие подтвердим лично письменно. До этого не платите и не приезжайте.',
    uk: 'Понеділок, 23.11, 18:00–20:00: попередній запис відкрито. Організатор погодив дату; місце збору, безпеку, кількість місць, спорядження та участь підтвердимо особисто письмово. До цього не платіть і не приїжджайте.'
  },
  'PUB-HEMA-20261128': {
    check: 'ORGANIZAČNÍ GO PRO TERMÍN',
    cs: 'Sobota 28. 11. 18:00–20:00: nezávazné přihlášky jsou otevřené po souhlasu pořadatele. Konání závisí na bezpečné ploše, vybavení a instruktorovi. Přesný sraz a jednotlivá místa potvrdíme písemně; zatím neplaťte ani nejezděte.',
    en: 'Saturday 28 Nov 18:00–20:00: preliminary registration is open with the organiser’s approval. The session depends on a safe training area, equipment and instructor availability. We will confirm the meeting point and each place in writing; please do not pay or travel before then.',
    ru: 'Суббота, 28.11, 18:00–20:00: предварительная запись открыта по согласованию с организатором. Проведение зависит от безопасного места, снаряжения и тренера; точку сбора и участие подтвердим письменно. Пока не платите и не приезжайте.',
    uk: 'Субота, 28.11, 18:00–20:00: попередній запис відкрито за згодою організатора. Проведення залежить від безпечного місця, спорядження та тренера; місце збору й участь підтвердимо письмово. Поки не платіть і не приїжджайте.'
  },

    'PUB-MVP-CALI-20261124': {
      check: 'NEZÁVAZNÁ PŘIHLÁŠKA NA BEZPLATNÝ WORKSHOP.',
      cs: 'Bezplatná kalistenika I pro mládež: nezávazná přihláška online. Přesný sraz, počasí, bezpečnost povrchu, vedení a osobní účast potvrdíme jednotlivě. Nejezděte bez potvrzení; nezletilí potřebují souhlas rodiče. Žádná platba.',
      en: 'Free youth calisthenics I: submit an online participation request. Exact meeting point, weather, safe ground, adult supervision and individual places require confirmation. Do not travel without confirmation; minors need parental consent. No payment.',
      ru: 'Бесплатная калистеника I для молодёжи: отправьте заявку на сайте. Точка сбора, погода, безопасность, взрослые руководители и участие подтверждаются индивидуально. Не приезжайте без подтверждения; несовершеннолетним нужно согласие родителей.',
      uk: 'Безкоштовна калістеніка I для молоді: подайте заявку на сайті. Місце збору, погода, безпека та участь підтверджуються індивідуально. Не приїжджайте без підтвердження; неповнолітнім потрібна згода батьків.'
    },
    'PUB-MVP-CALI-20261126': {
      check: 'NEZÁVAZNÁ PŘIHLÁŠKA NA BEZPLATNÝ WORKSHOP.',
      cs: 'Bezplatná kalistenika II pro mládež: nezávazná přihláška online. Přesný sraz, počasí, bezpečnost povrchu, vedení a osobní účast potvrdíme jednotlivě. Nejezděte bez potvrzení; nezletilí potřebují souhlas rodiče. Žádná platba.',
      en: 'Free youth calisthenics II: submit an online participation request. Exact meeting point, weather, safe ground, adult supervision and individual places require confirmation. Do not travel without confirmation; minors need parental consent. No payment.',
      ru: 'Бесплатная калистеника II для молодёжи: отправьте заявку на сайте. Точка сбора, погода, безопасность, взрослые руководители и участие подтверждаются индивидуально. Не приезжайте без подтверждения; несовершеннолетним нужно согласие родителей.',
      uk: 'Безкоштовна калістеніка II для молоді: подайте заявку на сайті. Місце збору, погода, безпека та участь підтверджуються індивідуально. Не приїжджайте без підтвердження; неповнолітнім потрібна згода батьків.'
    },
    'PUB-WALK-20261117': {
      check: 'Ранние места 390 Kč / стандарт 490 Kč',
      cs: 'Placená vycházka 18+. Zvýhodněná místa za 390 Kč, běžná cena 490 Kč; nejvýše 18 účastníků. Koná se od 8 skutečně platících osob. Zájem vyjádřený e-mailem není rezervace; organizace a platba se domlouvají zvlášť.',
      en: 'Paid guided walk, ages 18+. Early places CZK 390; standard price CZK 490, maximum 18 participants. Runs with at least 8 paying participants. Email interest does not reserve a place; payment and arrangements are agreed separately.',
      ru: 'Коммерческий маршрут 18+. Ранние места 390 Kč / стандарт 490 Kč, максимум 18, проведение от 8 оплаченных. Интерес по email не гарантирует место; оплата и организация отдельно.',
      uk: 'Платна прогулянка 18+. Перші місця за 390 Kč, звичайна ціна 490 Kč, максимум 18 осіб. Проводиться від 8 учасників, які оплатили. Зацікавленість електронною поштою не є бронюванням; оплату й організацію узгоджують окремо.'
    },
    'PUB-WALK-20261129': {
      check: 'Экскурсия 450 Kč с человека',
      cs: 'Historická prohlídka za 450 Kč na osobu. Koná se od 8 skutečně platících účastníků. E-mailový zájem není rezervace; místo srazu, právní podmínky a platba budou upřesněny před převodem peněz.',
      en: 'Historical city tour: CZK 450 per person. Runs with at least 8 paying participants. Email interest is not a booking. Meeting point, legal terms and payment are confirmed before any transfer.',
      ru: 'Экскурсия 450 Kč с человека. Проводится от 8 реально оплативших. Выражение интереса по email не является бронью. Точка сбора, легальные условия и оплата уточняются до получения денег.',
      uk: 'Історична екскурсія: 450 Kč з особи. Проводиться від 8 учасників, які оплатили. Зацікавленість електронною поштою не є бронюванням; місце збору, юридичні умови й оплату уточнюють до переказу коштів.'
    },
    'PUB-ADV-HEMA-20261125-A': {
      check: 'HOLD: зал недоступен',
      cs: 'POZASTAVENO: sál není dostupný, workshop není potvrzen. Datum je orientační, registrace zatím není povolena.',
      en: 'ON HOLD: the venue is unavailable and the workshop is not confirmed. Date is tentative; registration is not currently permitted.',
      ru: 'ПРИОСТАНОВЛЕНО: зал недоступен, воркшоп не подтверждён. Дата ориентировочная; регистрация пока закрыта.',
      uk: 'ПРИЗУПИНЕНО: зал недоступний, воркшоп не підтверджено. Дата орієнтовна; реєстрація наразі закрита.'
    },
    'PUB-ADV-HEMA-20261125-B': {
      check: 'HOLD: независимое второе занятие',
      cs: 'POZASTAVENO: druhý samostatný workshop je možný až po potvrzení místa a programu. Registrace zatím není otevřena.',
      en: 'ON HOLD: a second independent workshop is possible only after the venue and programme are confirmed. Registration is not open.',
      ru: 'ПРИОСТАНОВЛЕНО: второй самостоятельный воркшоп возможен только после подтверждения площадки и программы. Регистрации пока нет.',
      uk: 'ПРИЗУПИНЕНО: другий окремий воркшоп можливий лише після підтвердження місця й програми. Реєстрацію не відкрито.'
    }
  };
  const HEMA_NOTE = {
    cs: 'Přijímáme pouze nezávazné žádosti o trénink. Odeslání není rezervace, závazek k platbě ani potvrzení konání. Termín, místo, bezpečnost a cenu musí pořadatel před účastí individuálně písemně potvrdit. Do té doby neplaťte ani necestujte.',
    en: 'Training enquiries only: submitting is not a reservation, payment obligation or confirmation that the session will take place. The organiser must individually confirm date, place, safety and price in writing. Do not pay or travel before confirmation.',
    ru: 'Принимаются только предварительные заявки на тренировку. Заявка не означает бронирование, оплату или подтверждение проведения. Дата, место, безопасность и цена подтверждаются организатором письменно. До подтверждения не платите и не приезжайте.',
    uk: 'Приймаємо лише попередні запити на тренування. Запит не означає бронювання, оплату або підтвердження проведення. Дату, місце, безпеку та ціну організатор підтверджує письмово. До підтвердження не платіть і не приїжджайте.'
  };
  const HIKE_NOTE = {
    cs: 'Bezplatný komunitní výlet s průvodcem. Přihláška je předběžná, dokud pořadatel osobně nepotvrdí místo.',
    en: 'Free guided community hike. Your registration is provisional until the organiser personally confirms a place.',
    ru: 'Бесплатный групповой поход с ведущим. Заявка предварительная до личного подтверждения организатором.',
    uk: 'Безкоштовний спільний похід із супроводом. Заявка попередня до особистого підтвердження організатором.'
  };
  function note(event,locale) {
    if (!event) return '';
    const lang = Object.prototype.hasOwnProperty.call(UNKNOWN,locale) ? locale : 'cs';
    const raw = String(event.public_note || '').trim();
    const special = NOTES[event.event_id];
    if (special && raw.includes(special.check)) return special[lang];
    if (event.category === 'HEMA Training' && raw.startsWith('Přijímáme NEZÁVAZNÉ přihlášky')) return HEMA_NOTE[lang];
    if (event.event_id === 'PUB-HIKE-20261128' && raw.startsWith('Free guided community hike.')) return HIKE_NOTE[lang];
    if (lang !== 'ru' && /[\u0400-\u052f]/u.test(raw)) {
      return ({
        cs:'Účast a případnou platbu předem písemně ověřte u pořadatele.',
        en:'Confirm attendance and any payment terms in writing with the organiser first.',
        uk:'Спочатку письмово уточніть участь і будь-які умови оплати в організатора.'
      })[lang];
    }
    return raw;
  }
  root.ImperionEventI18n = Object.freeze({
    title: (event,lang) => localized(event,lang,'title'),
    venue: (event,lang) => localized(event,lang,'venue'),
    note: (event,lang) => note(event,lang)
  });
})(window);
