#!/usr/bin/env node
/**
 * Read-only by default. Allows a guarded Telegram webhook attach only after
 * verifying bot identity, an empty/same webhook, group administrator rights,
 * and a separate explicit setup gate. Does not turn on Welcome Engine LIVE.
 */
import process from 'node:process';
import {pathToFileURL} from 'node:url';

export const WEBHOOK_URL = 'https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-welcome-engine';
const REQUIRED_UPDATES = ['message','chat_member'];
const SECRET_FORMAT = /^[A-Za-z0-9_-]{20,256}$/;
const TOKEN_FORMAT = /^\d+:[A-Za-z0-9_-]{20,}$/;
const USERNAME_FORMAT = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
const CHAT_ID_FORMAT = /^-\d{5,20}$/;

export function planWebhook(info, target = WEBHOOK_URL) {
  if (!info || typeof info.url !== 'string') return {status:'INVALID_INFO',canApply:false};
  // Never steal a bot from an existing Telegram handler.
  if (info.url && info.url !== target) return {status:'BLOCKED_OTHER_WEBHOOK',canApply:false};
  const old = Array.isArray(info.allowed_updates)
    ? info.allowed_updates.filter(v => typeof v === 'string' && /^[a-z_]+$/.test(v)) : [];
  const updates = [...new Set([...old,...REQUIRED_UPDATES])];
  return {status: info.url ? 'SAME_ENDPOINT' : 'NO_WEBHOOK',canApply:true,
    allowed_updates:updates,pending_update_count: info.pending_update_count ?? null};
}
function parseGroups(raw) {
  let groups;
  try { groups=JSON.parse(raw); } catch { return null; }
  if (!groups || typeof groups !== 'object' || Array.isArray(groups))return null;
  const ids=Object.keys(groups);
  if (!ids.length || ids.length>20 || ids.some(id=>!CHAT_ID_FORMAT.test(id)))return null;
  return ids;
}

export async function reconcileWebhook({env=process.env,fetchImpl=fetch,apply=false}={}) {
  const token=env.WELCOME_TELEGRAM_BOT_TOKEN||'';
  if (!TOKEN_FORMAT.test(token))return {status:'BLOCKED_MISSING_BOT_TOKEN',sideEffects:0};
  const username=(env.WELCOME_EXPECTED_BOT_USERNAME||'').replace(/^@/,'');
  if(!USERNAME_FORMAT.test(username))return {status:'BLOCKED_BOT_IDENTITY_NOT_CONFIRMED',sideEffects:0};
  const groups=parseGroups(env.WELCOME_GROUPS_JSON||'');
  if(!groups)return {status:'BLOCKED_GROUP_IDS_NOT_CONFIGURED',sideEffects:0};
  async function api(method, payload={}) {
    // Never print or return the token or the full API URL.
    const response=await fetchImpl('https://api.telegram.org/bot'+token+'/'+method,{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
    });
    const result=await response.json();
    if(!response.ok || result.ok!==true)throw Error('Telegram '+method+' did not succeed');
    return result.result;
  }
  const bot=await api('getMe');
  if (!bot || !Number.isSafeInteger(bot.id) || String(bot.username||'').toLowerCase()!==username.toLowerCase()) {
    return {status:'BLOCKED_BOT_IDENTITY_MISMATCH',sideEffects:0};
  }
  const current=await api('getWebhookInfo');
  const plan=planWebhook(current);
  if(!plan.canApply)return {status:plan.status,bot:'@'+bot.username,sideEffects:0};
  for (const chat_id of groups) {
    const member=await api('getChatMember',{chat_id,user_id:bot.id});
    if (!member || !['administrator','creator'].includes(member.status)
      || member.can_send_welcome_messages===false) {
      return {status:'BLOCKED_GROUP_ADMIN_PERMISSION',bot:'@'+bot.username,sideEffects:0};
    }
  }
  if(!apply)return {status:'PREVIEW_SAFE_TO_ATTACH',bot:'@'+bot.username,groups_checked:groups.length,
    webhook:plan.status,allowed_updates:plan.allowed_updates,sideEffects:0};
  if(plan.status==='NO_WEBHOOK' && env.WELCOME_NO_POLLING_CONFIRMED!=='yes') {
    return {status:'BLOCKED_POLLING_STATUS_UNVERIFIED',sideEffects:0};
  }
  if(env.WELCOME_ATTACH_GO!=='yes')return {status:'BLOCKED_ATTACH_GO_MISSING',sideEffects:0};
  const secret=env.WELCOME_TELEGRAM_WEBHOOK_SECRET||'';
  if(!SECRET_FORMAT.test(secret))return {status:'BLOCKED_MISSING_WEBHOOK_SECRET',sideEffects:0};
  await api('setWebhook',{url:WEBHOOK_URL,allowed_updates:plan.allowed_updates,
    secret_token:secret,drop_pending_updates:false,max_connections:1});
  const readback=await api('getWebhookInfo');
  if(readback.url!==WEBHOOK_URL || !REQUIRED_UPDATES.every(x=>readback.allowed_updates?.includes(x)))
    return {status:'WEBHOOK_READBACK_FAILED',sideEffects:1};
  return {status:'WEBHOOK_ATTACHED_DRY_RUN',bot:'@'+bot.username,sideEffects:1,
    groups_checked:groups.length,allowed_updates:readback.allowed_updates,
    pending_update_count:readback.pending_update_count??null};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const apply=process.argv.includes('--apply');
  reconcileWebhook({apply})
    .then(x=>{process.stdout.write(JSON.stringify(x)+'\n');if(x.status.startsWith('BLOCKED_')||x.status.endsWith('FAILED'))process.exitCode=2;})
    .catch(e=>{process.stderr.write('Webhook check failed (credentials not displayed): '+e.message+'\n');process.exitCode=1;});
}
