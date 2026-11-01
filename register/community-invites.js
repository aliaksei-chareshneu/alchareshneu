/* Public, informational community channels only. Never put gated participant chats here.
 * This helper is loaded by the existing four-language RSVP pages after an accepted POST.
 * It does not enroll people, send messages or change contact/marketing permissions.
 */
(function (root) {
  'use strict';
  const links = Object.freeze({
    druzina: Object.freeze({
      Telegram: 'https://t.me/druzinamoravy_news',
      WhatsApp: 'https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu'
    }),
    walkers: Object.freeze({
      Telegram: 'https://t.me/pochody_brno_news',
      WhatsApp: 'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0'
    })
  });
  const copy = Object.freeze({
    cs: {
      title: 'Chcete dostávat novinky z komunity',
      cta: 'Přidat se přes',
      tg: 'Připojení je dobrovolné. Na Telegramu si předem zkontrolujte nastavení soukromí. Účast na akci zatím není potvrzená.',
      wa: 'Připojení je dobrovolné. Ve WhatsApp skupině mohou ostatní členové vidět vaše telefonní číslo. Účast na akci zatím není potvrzená.'
    },
    en: {
      title: 'Want updates from the',
      cta: 'Join updates on',
      tg: 'Joining is optional. Check your Telegram privacy settings before joining. Your event attendance is not confirmed yet.',
      wa: 'Joining is optional. Other WhatsApp group members may see your phone number. Your event attendance is not confirmed yet.'
    },
    ru: {
      title: 'Хотите получать новости сообщества',
      cta: 'Подписаться через',
      tg: 'Вступление добровольное. Проверьте настройки приватности Telegram. Участие в мероприятии ещё не подтверждено.',
      wa: 'Вступление добровольное. В WhatsApp участники группы могут видеть ваш номер. Участие ещё не подтверждено.'
    },
    uk: {
      title: 'Хочете отримувати новини спільноти',
      cta: 'Приєднатися через',
      tg: 'Приєднання добровільне. Перевірте налаштування приватності Telegram. Участь у події ще не підтверджена.',
      wa: 'Приєднання добровільне. У WhatsApp учасники групи можуть бачити ваш номер. Участь у події ще не підтверджена.'
    }
  });
  function resolve(community, language, ageGroup, rsvp) {
    if (ageGroup !== 'adult' || (rsvp !== 'YES' && rsvp !== 'MAYBE')) return null;
    if (!Object.prototype.hasOwnProperty.call(copy, language)) return null;
    const normalized = String(community || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isDruzina = normalized.includes('druzina moravy');
    const isWalkers = normalized.includes('brnowalkers');
    // Unknown or mixed ownership: fail closed rather than inviting to the wrong group.
    if (isDruzina === isWalkers) return null;
    const key = isDruzina ? 'druzina' : 'walkers';
    const name = isDruzina ? 'Družina Moravy' : 'BrnoWalkers';
    const platform = (language === 'ru' || language === 'uk') ? 'Telegram' : 'WhatsApp';
    const words = copy[language];
    return Object.freeze({
      platform: platform,
      url: links[key][platform],
      title: words.title + ' ' + name + '?',
      cta: words.cta + ' ' + platform,
      note: platform === 'Telegram' ? words.tg : words.wa
    });
  }
  const api = Object.freeze({ resolve: resolve });
  root.IMPERION_COMMUNITY_INVITES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
