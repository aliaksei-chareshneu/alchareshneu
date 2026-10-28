/**
 * IMPERION Telegram Business / Secretary Mode inbound reply policy.
 * Pure, no network. Integration target: existing n8n owner-bot-router / Google Apps Script.
 * Personal messages MUST stay inside explicitly selected Telegram Business chats.
 * Caller must check deduplication and send only after owner-approved scope.
 * No LLM involved for trivial FAQ. Default AUTO-REPLY: OFF.
 */
"use strict";

const REGISTRATION = "https://aliaksei-chareshneu.github.io/alchareshneu/register/";
const CALENDAR = "https://aliaksei-chareshneu.github.io/alchareshneu/calendar/";

const INTENTS = [
  { key: "registration", re: /\b(registr(?:ation|er|arse)?|sign[\s-]?up|enrol|apply)\b|(?:как|где)\s+(?:мне\s+)?(?:записаться|зарегистрироваться)|(?:как|где)\s+(?:записаться|регистрироваться)|(?:jak|kde)\s+(?:se\s+)?(?:přihlásit|registrovat)|(?:як|де)\s+(?:зареєструватися|записатися)/iu },
  { key: "schedule", re: /\b(schedule|timetable|calendar|when are (?:the )?(?:sessions|trainings))\b|(?:где|какое|график)\s+(?:расписание|тренировок)|расписани[ея]|(?:kde|jaký)\s+(?:je\s+)?(?:rozvrh|kalendář)|(?:kdy jsou)\s+tréninky|(?:де|який)\s+розклад|розклад\s+занять/iu },
];

// Event statuses and date-specific public announcements must be confirmed live.
const HUMAN_REVIEW = /(?:платёж|оплат|возврат|скидк|цена|стоимост|договор|счёт|банк|персональн|медицин|болезн|травм|помощь|конфликт|жалоб|небезопасн|страхов|несовершеннолет|дет[ьи]|1\s*ноябр|1\s*listopad|1\s*november|1\s*nov\b|hády|hady|refund|price|cost|discount|payment|invoice|agreement|injur|child|minor|health|privacy|personal|cancel|cancellation|complain|safety|insurance|zdarma|cena|platba|faktura|sleva|storno|úraz|zdrav|ochran|dítě|děti|bezpeč|листопад)/iu;

function replyFor(intent, message) {
  const s = String(message);
  const hasCyrillic = /[\u0400-\u052f]/u.test(s);
  const ukrainian = /\b(?:як|де|записатися|зареєструватися|розклад)\b/iu.test(s);
  const czech = /\b(?:jak|kde|se|přihlásit|registrovat|rozvrh|kalendář|tréninky)\b/iu.test(s);
  if (intent === "registration") {
    if (ukrainian) return "Реєстрація на заходи тут: " + REGISTRATION + "\nОберіть подію та заповніть форму. Якщо реєстрація недоступна, напишіть мені.";
    if (hasCyrillic) return "Регистрация на мероприятия здесь: " + REGISTRATION + "\nВыберите мероприятие и заполните форму. Если регистрация недоступна, напишите мне.";
    if (czech) return "Registrace na akce je zde: " + REGISTRATION + "\nVyberte akci a vyplňte formulář. Pokud registrace není dostupná, napište mi.";
    return "Event registration: " + REGISTRATION + "\nChoose the event and complete the form. If registration is unavailable, please tell me.";
  }
  if (ukrainian) return "Актуальні події та розклад: " + CALENDAR + "\nЯкщо потрібної події немає, напишіть мені.";
  if (hasCyrillic) return "Актуальное расписание и мероприятия: " + CALENDAR + "\nЕсли нужного мероприятия нет, напишите мне.";
  if (czech) return "Aktuální kalendář akcí: " + CALENDAR + "\nPokud tam konkrétní akci nenajdete, napište mi.";
  return "Current schedule and events: " + CALENDAR + "\nIf the event is missing, please let me know.";
}

function decide(update, policy = {}) {
  const msg = update && update.business_message;
  if (!msg) return { decision: "IGNORE", reason: "NOT_BUSINESS_MESSAGE" };
  if (msg.chat?.type !== "private" || msg.from?.is_bot || msg.sender_business_bot) return { decision: "IGNORE", reason: "NON_PRIVATE_OR_BOT" };
  if (!msg.business_connection_id || !Number.isSafeInteger(msg.chat?.id)) return { decision: "IGNORE", reason: "INVALID_CONNECTION_OR_CHAT" };
  const incomingText = typeof msg.text === "string" ? msg.text.trim() : "";
  if (!incomingText || incomingText.length > 1500) return { decision: "REVIEW", reason: "NO_SAFE_TEXT" };
  const age = (policy.nowSeconds ?? Math.floor(Date.now() / 1000)) - msg.date;
  if (!Number.isFinite(age) || age < -60 || age > 23 * 3600) return { decision: "REVIEW", reason: "STALE_OR_INVALID_DATE" };
  if (!policy.scopeApprovedByOwner) return { decision: "REVIEW", reason: "SCOPE_NOT_APPROVED" };
  if (policy.businessConnectionId !== msg.business_connection_id) return { decision: "REVIEW", reason: "CONNECTION_NOT_MATCHED" };
  const excluded = new Set((policy.excludeChatIds || []).map(String));
  const allowed = new Set((policy.allowChatIds || []).map(String));
  if (excluded.has(String(msg.chat.id))) return { decision: "IGNORE", reason: "EXCLUDED_CHAT" };
  if (!allowed.has(String(msg.chat.id)) && policy.allowTelegramSelectedChats !== true) return { decision: "REVIEW", reason: "CHAT_NOT_ALLOWLISTED" };
  if (policy.isDuplicate) return { decision: "IGNORE", reason: "DUPLICATE_UPDATE" };
  if (HUMAN_REVIEW.test(incomingText)) return { decision: "REVIEW", reason: "SENSITIVE_OR_DATE_SPECIFIC" };
  const intents = INTENTS.filter((item) => item.re.test(incomingText));
  if (intents.length !== 1) return { decision: "REVIEW", reason: "UNKNOWN_OR_MULTIPLE_INTENTS" };
  const prepared = replyFor(intents[0].key, incomingText);
  if (!policy.autoReplyApproved) return { decision: "DRAFT", intent: intents[0].key, text: prepared };
  return {
    decision: "AUTO_REPLY",
    intent: intents[0].key,
    text: prepared,
    telegramPayload: {
      chat_id: msg.chat.id,
      business_connection_id: msg.business_connection_id,
      text: prepared,
      reply_parameters: { message_id: msg.message_id },
    },
  };
}

module.exports = { decide, REGISTRATION, CALENDAR };
