/* Public RSVP event catalogue presentation translations.
 * Source-of-truth event IDs, times, prices, booking statuses and payment terms
 * remain on the server; only display titles and venue descriptions are localized.
 * Keys are exact catalogue strings, so a changed source is never silently
 * overridden with an obsolete location or programme.
 */
(function (root) {
  'use strict';
  const TITLES = {
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
  root.ImperionEventI18n = Object.freeze({
    title: (event,lang) => localized(event,lang,'title'),
    venue: (event,lang) => localized(event,lang,'venue')
  });
})(window);
