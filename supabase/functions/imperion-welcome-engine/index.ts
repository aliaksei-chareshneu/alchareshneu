import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {processTelegramUpdate} from './core.mjs';
import {validWebhookSecret,decodeAllowlist} from './security.mjs';
/*
 * Telegram webhook entrypoint. Opt-in, allowlisted, and OFF by default.
 * DO NOT deploy as live unless site/group owner explicitly authorizes messages.
 * DO NOT use for unsolicited DMs or private-user scraping.
 */
const header = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:header});
const env=(key:string)=>Deno.env.get(key)||'';
const sbUrl=env('SUPABASE_URL');
const sbKey=env('SUPABASE_SERVICE_ROLE_KEY');
function dbHeaders(extra:Record<string,string>={}) {
  return {'apikey':sbKey,'Authorization':'Bearer '+sbKey,'Content-Type':'application/json',...extra};
}
function storeAdapter() {
  if(!sbUrl||!sbKey)throw Error('db_not_configured');
  const url=sbUrl+'/rest/v1/imperion_welcome_receipts';
  const suppressionUrl=sbUrl+'/rest/v1/imperion_welcome_suppressions';
  return {
    async reserve(value:{dedupe_key:string;platform:string;subject:string;action:string}) {
      const body={...value,state:'RESERVED',retention_until:new Date(Date.now()+90*86400e3).toISOString()};
      const res=await fetch(url+'?on_conflict=dedupe_key',{method:'POST',headers:dbHeaders({'Prefer':'resolution=ignore-duplicates,return=representation'}),body:JSON.stringify(body)});
      if(!res.ok)throw Error('receipt_reservation_error');
      const data=await res.json();
      return Array.isArray(data) && data.length===1 ? 'reserved':'duplicate';
    },
    async complete(key:string,state:string,receipt:Record<string,unknown>) {
      const res=await fetch(url+'?dedupe_key=eq.'+encodeURIComponent(key),{method:'PATCH',headers:dbHeaders({'Prefer':'return=minimal'}),body:JSON.stringify({state,receipt,updated_at:new Date().toISOString()})});
      if(!res.ok)throw Error('receipt_update_error');
    },
    async isSuppressed(key:string) {
      const res=await fetch(suppressionUrl+'?suppress_key=eq.'+encodeURIComponent(key)+'&select=suppress_key&limit=1',{headers:dbHeaders()});
      if(!res.ok)throw Error('suppression_lookup_error');
      const data=await res.json();
      return Array.isArray(data) && data.length>0;
    },
    async suppress(value:{suppress_key:string;platform:string;subject:string}) {
      const res=await fetch(suppressionUrl+'?on_conflict=suppress_key',{method:'POST',headers:dbHeaders({'Prefer':'resolution=ignore-duplicates,return=representation'}),body:JSON.stringify(value)});
      if(!res.ok)throw Error('suppression_store_error');
      const data=await res.json();
      return Array.isArray(data)&&data.length===1?'saved':'duplicate';
    },
    async unsuppress(key:string) {
      const res=await fetch(suppressionUrl+'?suppress_key=eq.'+encodeURIComponent(key),{method:'DELETE',headers:dbHeaders({'Prefer':'return=representation'})});
      if(!res.ok)throw Error('unsuppress_error');
      const data=await res.json();
      return Array.isArray(data)&&data.length===1?'removed':'already';
    }
  };
}
function telegramAdapter() {
  const token=env('WELCOME_TELEGRAM_BOT_TOKEN');
  if(!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))throw Error('telegram_token_not_configured');
  return {async send(chatId:number,text:string) {
    const res=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text,disable_notification:true,link_preview_options:{is_disabled:true}}),
      signal:AbortSignal.timeout(10000)
    });
    if(!res.ok)throw Error('telegram_api_error');
    const body=await res.json();
    if(body.ok!==true || !Number.isSafeInteger(body.result?.message_id))throw Error('telegram_not_accepted');
    return {message_id:body.result.message_id};
  }};
}
Deno.serve(async(req:Request)=>{
  if(req.method==='GET')return reply({service:'imperion-welcome-engine',mode:env('WELCOME_ENGINE_MODE')==='live'?'live':'dry-run',noMessagesSentByHealth:true});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  if(!validWebhookSecret(req.headers.get('x-telegram-bot-api-secret-token'),env('WELCOME_TELEGRAM_WEBHOOK_SECRET')))
    return reply({error:'unauthorized'},401);
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))return reply({error:'invalid_content_type'},415);
  if(Number(req.headers.get('content-length')||0)>32768)return reply({error:'payload_too_large'},413);
  let body:unknown;
  try {const raw=await req.text();if(raw.length>32768)return reply({error:'payload_too_large'},413);body=JSON.parse(raw);}
  catch{return reply({error:'invalid_json'},400);}
  const groups=decodeAllowlist(env('WELCOME_GROUPS_JSON'));
  const privateStarts={default:decodeAllowlist(env('WELCOME_PRIVATE_START_JSON')).default};
  const mode=env('WELCOME_ENGINE_MODE')==='live'?'live':'dry-run';
  let store:ReturnType<typeof storeAdapter>|undefined;
  let sender:ReturnType<typeof telegramAdapter>|undefined;
  try{if(mode==='live'){store=storeAdapter();sender=telegramAdapter();}}
  catch {return reply({ok:false,status:'BLOCKED_CONFIGURATION',externalSend:false},503);}
  try{
    const result=await processTelegramUpdate(body,{groups,privateStarts,mode,store,sender,pepper:env('WELCOME_RECEIPT_PEPPER')});
    return reply({ok:true,...result});
  }catch{return reply({ok:false,status:'RETRYABLE_STORAGE_ERROR',externalSend:false},503);}
});
