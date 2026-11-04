/** IMPERION Welcome Engine: conservative, platform-compliant policy core. */
const ACTIVE = new Set(['member', 'administrator', 'creator']);
export const PLATFORM_POLICY = Object.freeze({
  telegram: { group_join: 'GROUP_GREETING', private_start: 'USER_INITIATED_REPLY' },
  whatsapp: { ordinary_group_join: 'NO_STANDARD_GROUP_WEBHOOK', inbound: 'OPT_IN_AND_OFFICIAL_API_REQUIRED' },
  instagram: { follow: 'NO_GENERAL_FOLLOW_DM', inbound: 'OFFICIAL_BUSINESS_MESSAGING_ONLY' },
  facebook: { friend: 'NO_PERSONAL_FRIEND_DM', follow: 'NO_FOLLOW_DM', page_inbound: 'OFFICIAL_PAGE_MESSAGING_ONLY' },
  tiktok: { follow: 'NATIVE_FOLLOW_WELCOME_IF_ELIGIBLE', inbound: 'BUSINESS_MESSAGING_ONLY' },
  youtube: { subscribe: 'NO_PRIVATE_MESSAGING_API' }
});
const SUBJECTS = new Set(['druzina', 'brnowalkers', 'osvc']);
const LANGS = new Set(['ru', 'ua']);
export function routePlatformEvent(platform, kind, options = {}) {
  const route = PLATFORM_POLICY[platform]?.[kind] ?? 'UNSUPPORTED';
  if (options.optedOut === true) return {status: 'BLOCKED_OPT_OUT', send: false};
  if (platform === 'telegram' && kind === 'group_join') return {status:'ELIGIBLE_FOR_GROUP_WELCOME',send:true,mode:'group_only'};
  if (platform === 'telegram' && kind === 'private_start') return {status:'ELIGIBLE_FOR_PRIVATE_REPLY',send:true,mode:'user_initiated'};
  return {status:route, send:false, mode:'native_or_manual'};
}
function newlyJoined(change) {
  if (!change?.old_chat_member || !change?.new_chat_member) return false;
  const old = change.old_chat_member;
  const next = change.new_chat_member;
  const wasMember = ACTIVE.has(old.status) || (old.status === 'restricted' && old.is_member === true);
  const isMember = ACTIVE.has(next.status) || (next.status === 'restricted' && next.is_member === true);
  return !wasMember && isMember && Number.isSafeInteger(next.user?.id);
}
function validConfig(config) {
  return config && SUBJECTS.has(config.subject) && LANGS.has(config.language) &&
    typeof config.text === 'string' && config.text.length >= 10 && config.text.length <= 1000 &&
    config.text.includes('https://aliaksei-chareshneu.github.io/alchareshneu/');
}
/** Only inbound Telegram /start can generate a private reply. Group joins never generate private DMs. */
export function parseTelegramUpdate(update, groups = {}, privateStarts = {}) {
  if (!update || !Number.isSafeInteger(update.update_id)) return {status:'INVALID_UPDATE'};
  if (update.chat_member) {
    const change = update.chat_member;
    if (!newlyJoined(change)) return {status:'NOT_A_NEW_MEMBER'};
    const chat = change.chat;
    if (!chat || !['group','supergroup'].includes(chat.type) || !Number.isSafeInteger(chat.id)) return {status:'INVALID_GROUP'};
    const config = groups[String(chat.id)];
    if (!validConfig(config)) return {status:'GROUP_NOT_APPROVED'};
    return {status:'READY', action:'GROUP_GREETING',platform:'telegram',subject:config.subject,
      language:config.language,chatId:chat.id,actorId:change.new_chat_member.user.id,
      text:config.text,updateId:update.update_id};
  }
  const m = update.message;
  if (!m || m.chat?.type !== 'private' || !/^\/start(?:@\w+)?(?:\s|$)/.test(m.text || '') ||
      !Number.isSafeInteger(m.from?.id) || !Number.isSafeInteger(m.chat?.id) || m.from.id !== m.chat.id) {
    return {status:'NOT_AN_ELIGIBLE_EVENT'};
  }
  const config = privateStarts.default;
  if (!validConfig(config)) return {status:'PRIVATE_START_NOT_CONFIGURED'};
  return {status:'READY',action:'USER_INITIATED_REPLY',platform:'telegram',subject:config.subject,
    language:config.language,chatId:m.chat.id,actorId:m.from.id,text:config.text,updateId:update.update_id};
}
export async function digestKey(pepper, decision) {
  if (typeof pepper !== 'string' || pepper.length < 24) throw Error('missing_pepper');
  const raw = ['welcome-v1', pepper, decision.platform, decision.action, decision.subject,
    String(decision.chatId), String(decision.actorId)].join('|');
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
/** Atomic reservation is required for LIVE mode. On retries never send twice. */
export async function processTelegramUpdate(update, opts) {
  const decision = parseTelegramUpdate(update, opts.groups, opts.privateStarts);
  if (decision.status !== 'READY') return {status:decision.status,externalSend:false};
  if (opts.mode !== 'live') return {status:'DRY_RUN',action:decision.action,subject:decision.subject,externalSend:false};
  if (!opts.store?.reserve || !opts.store?.complete || !opts.sender?.send || !opts.pepper) {
    return {status:'BLOCKED_CONFIG',externalSend:false};
  }
  const key = await digestKey(opts.pepper,decision);
  const reserved = await opts.store.reserve({dedupe_key:key, platform:'telegram', subject:decision.subject, action:decision.action});
  if (reserved === 'duplicate') return {status:'DUPLICATE',externalSend:false};
  if (reserved !== 'reserved') return {status:'BLOCKED_STORAGE',externalSend:false};
  let sent;
  try {
    sent = await opts.sender.send(decision.chatId,decision.text);
    if (!Number.isSafeInteger(sent?.message_id)) throw Error('provider_acceptance_missing');
  } catch (error) {
    await opts.store.complete(key,'FAILED',{reason:'provider_send_failed'}).catch(()=>{});
    return {status:'FAILED_REVIEW_REQUIRED',externalSend:false};
  }
  try {
    await opts.store.complete(key,'API_ACCEPTED',{provider_message_id:sent.message_id});
    return {status:'API_ACCEPTED',externalSend:true,providerMessageId:sent.message_id};
  } catch {
    // Provider accepted a message; failure to save our receipt cannot reverse it.
    return {status:'API_ACCEPTED_RECEIPT_UNVERIFIED',externalSend:true,providerMessageId:sent.message_id};
  }
}
