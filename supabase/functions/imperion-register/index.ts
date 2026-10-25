/**
 * Anonymous public event RSVP endpoint. No Supabase privileged key is sent to
 * the browser. All writes are server-side and RLS denies public DB access.
 * POST is request-for-contact, NOT an approved booking or sports waiver.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const ALLOWED_ORIGIN = 'https://aliaksei-chareshneu.github.io';
const SERVICE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const controller = new TextEncoder();
const api = SERVICE_URL && SERVICE_KEY ? createClient(SERVICE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

function headers(origin: string | null): Record<string,string> {
  const common: Record<string,string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };
  if (origin === ALLOWED_ORIGIN) {
    common['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
    common['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    common['Access-Control-Allow-Headers'] = 'content-type';
    common['Access-Control-Max-Age'] = '600';
  }
  return common;
}
function reply(json: object, status: number, origin: string | null) {
  return new Response(JSON.stringify(json), {status, headers:headers(origin)});
}
function text(v: unknown, max: number): string {
  return String(v ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0,max);
}
function safeName(v: unknown): string {
  const s=text(v,80);
  if (s.length<2 || /^[=+@-]/.test(s)) throw new Error('name');
  return s;
}
function safeEmail(v: unknown): string {
  const s=text(v,254).toLowerCase();
  if (s.length<5 || /^[=+@-]/.test(s) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new Error('email');
  return s;
}
function safePhone(v: unknown): string {
  const s=text(v,35),d=s.replace(/\D/g,'');
  if (d.length<7 || d.length>15 || !/^\+?[\d\s().-]+$/.test(s)) throw new Error('phone');
  return s;
}
function safeEnum(v: unknown, allowed: readonly string[]): string {
  const s=String(v??'');
  if (!allowed.includes(s)) throw new Error('option');
  return s;
}
async function hashedBucket(label: string, value: string): Promise<string> {
  // HMAC prevents later dictionary lookup of identifiable IP/email values.
  // Inputs are NOT written to request logs or the rate-limit table.
  const key = await crypto.subtle.importKey('raw',controller.encode(SERVICE_KEY),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const d = await crypto.subtle.sign('HMAC',key,
    controller.encode(`${new Date().toISOString().slice(0,10)}|${label}|${value}`));
  return Array.from(new Uint8Array(d)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function allow(label: string, raw: string, max: number): Promise<boolean> {
  if (!api) return false;
  const key=await hashedBucket(label,raw);
  const {data,error}=await api.rpc('imperion_rsvp_allow_request',{p_key:key,p_limit:max});
  if (error) return false;
  return data === true;
}
const EVENT_COLS='event_id,title,community,category,begins_at,ends_at,venue,price_czk,data_controller,rules_url,contact_activity,is_open,registration_mode,action_url,public_note,price_verified,end_time_verified';

Deno.serve(async (req:Request):Promise<Response>=>{
  const origin=req.headers.get('origin');
  if (req.method === 'OPTIONS') return origin===ALLOWED_ORIGIN
    ? new Response(null,{status:204,headers:headers(origin)})
    : reply({error:'forbidden_origin'},403,origin);
  if (origin && origin!==ALLOWED_ORIGIN) return reply({error:'forbidden_origin'},403,null);
  if (req.method!=='GET' && req.method!=='POST') return reply({error:'method_not_allowed'},405,origin);
  if (!api) return reply({error:'service_not_configured'},503,origin);
  if (req.method==='GET') {
    const {data,error}=await api.from('imperion_rsvp_events').select(EVENT_COLS)
      .eq('public_listing',true)
      .gt('begins_at',new Date().toISOString()).order('begins_at',{ascending:true}).limit(120);
    if (error) return reply({error:'temporarily_unavailable'},503,origin);
    return reply({events:data||[],version:'2026-10-25-catalog-v3',bookingConfirmed:false},200,origin);
  }
  // POST requires a real browser origin. A non-browser script can forge it,
  // so we also validate strictly and rate-limit server-side.
  if (origin!==ALLOWED_ORIGIN) return reply({error:'forbidden_origin'},403,origin);
  const len=Number(req.headers.get('content-length')||'0');
  if (len>8192 || !req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return reply({error:'invalid_request'},400,origin);
  let body:Record<string,unknown>;
  try {
    const raw=await req.text();
    if (raw.length>8192) throw new Error('size');
    body=JSON.parse(raw);
    if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error('type');
  } catch {return reply({error:'invalid_request'},400,origin);}
  if (body.website) return reply({ok:true,status:'RECEIVED'},200,origin); // anti-bot honeypot

  // A short, genuine contact REQUEST for adult Druzina participants.
  // This is deliberately NOT a reservation and cannot bypass is_open gates
  // for actual events. Uses the existing RSVP security/rate-limit envelope.
  if (body.intent==='DRUZINA_ENQUIRY') {
    let entry: {
      first:string;last:string;contact:string;kind:'email'|'phone';
      type:string;day:string;date:string|null;lang:string;
    };
    try {
      const type=safeEnum(body.visitType,['FIRST','RETURNING']);
      const day=safeEnum(body.preferredDay,['NEXT','MON','SAT','DATE']);
      const lang=safeEnum(body.language||'cs',['cs','en','ru','uk']);
      const rawContact=text(body.contact,254);
      const kind: 'email'|'phone'=rawContact.includes('@')?'email':'phone';
      const contact=kind==='email'?safeEmail(rawContact):safePhone(rawContact);
      if (body.adultConfirmed!==true || body.safety!==true) throw new Error('consent');
      let date:string|null=null;
      if (day==='DATE') {
        date=text(body.preferredDate,10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date');
        const valid=new Date(date+'T12:00:00.000Z');
        if (!Number.isFinite(valid.getTime()) || valid.toISOString().slice(0,10)!==date ||
          valid.getTime()<Date.now()-86400000 ||
          valid.getTime()>Date.now()+366*86400000) throw new Error('date');
      } else if (body.preferredDate) {
        throw new Error('date');
      }
      entry={first:safeName(body.firstName),last:safeName(body.lastName),
        contact,kind,type,day,date,lang};
    } catch {
      return reply({error:'please_check_required_fields'},400,origin);
    }
    const ip=String(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
      req.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,100);
    if (ip && !(await allow('druzina_ip',ip,10)))
      return reply({error:'too_many_requests'},429,origin);
    if (!(await allow('druzina_contact',entry.contact,5)))
      return reply({error:'too_many_requests'},429,origin);
    const {data, error}=await api.from('imperion_rsvp_enquiries').insert({
      first_name:entry.first,last_name:entry.last,contact:entry.contact,
      contact_kind:entry.kind,visit_type:entry.type,preferred_day:entry.day,
      preferred_date:entry.date,adult_confirmed:true,safety_acknowledged:true,
      safety_version:'2026-10-25-v2',language:entry.lang,
      data_controller:'Družina Moravy, z. s.',
      source:'site-druzina-first-visit',status:'RECEIVED_UNCONFIRMED',
    }).select('id').single();
    if (error || !data?.id) return reply({error:'temporarily_unavailable'},503,origin);
    return reply({
      ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:data.id,
      message:'Enquiry received, not a confirmed training place or payment request.'
    },200,origin);
  }
  let v: {
    eventId:string;first:string;last:string;email:string;phone:string;age:string;
    guardianName:string|null;guardianPhone:string|null;photo:string;
    future:boolean;rsvp:string;locale:string;
  };
  try {
    const age=safeEnum(body.ageGroup,['adult','under18']);
    v={
      eventId:text(body.eventId,100),
      first:safeName(body.firstName),last:safeName(body.lastName),
      email:safeEmail(body.email),phone:safePhone(body.phone),age,
      guardianName:age==='under18'?safeName(body.guardianName):null,
      guardianPhone:age==='under18'?safePhone(body.guardianPhone):null,
      photo:safeEnum(body.photo||'NO',['YES','NO']),
      future:age==='adult'&&body.futureUpdates===true,
      rsvp:safeEnum(body.rsvp,['YES','MAYBE','NO']),
      locale:safeEnum(body.language||'en',['en','cs','ru','uk']),
    };
    v.eventId=text(body.eventId,100);
    if (!/^[A-Za-z0-9-]{2,100}$/.test(v.eventId)) throw new Error('event');
    if (age==='under18' && (v.guardianName||'').length<3) throw new Error('guardian');
    if (body.safety!==true) throw new Error('safety');
    if (age==='under18') v.photo='NO';
  } catch {return reply({error:'please_check_required_fields'},400,origin);}
  const {data:event,error:eventError}=await api.from('imperion_rsvp_events')
    .select(EVENT_COLS).eq('event_id',v.eventId).eq('is_open',true)
    .eq('registration_mode','FORM').eq('source_active',true)
    .eq('price_verified',true).eq('public_listing',true)
    .gt('begins_at',new Date().toISOString()).maybeSingle();
  if (eventError) return reply({error:'temporarily_unavailable'},503,origin);
  if (!event) return reply({error:'event_not_available'},400,origin);
  if (event.contact_activity && !/\/druzina\/(safety|rules)\//.test(String(event.rules_url)))
    return reply({error:'event_not_available'},400,origin);
  const ip=String(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
    req.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,100);
  if (ip && !(await allow('ip',ip,12))) return reply({error:'too_many_requests'},429,origin);
  if (!(await allow('email',v.email,8))) return reply({error:'too_many_requests'},429,origin);
  const expiry=new Date(new Date(event.ends_at).getTime()+90*86400000);
  const {error:writeError}=await api.from('imperion_rsvp_submissions').insert({
    event_id:v.eventId,first_name:v.first,last_name:v.last,email:v.email,phone:v.phone,
    age_group:v.age,guardian_name:v.guardianName,guardian_phone:v.guardianPhone,
    rsvp_status:v.rsvp,safety_acknowledged:true,safety_version:'2026-10-25-v1',
    photo_choice:v.photo,marketing_requested:v.future,data_controller:event.data_controller,
    language:v.locale,retention_until:expiry.toISOString(),
  });
  // A duplicate is deliberately indistinguishable to avoid an identity oracle
  // and must never mutate existing contact information or consents.
  if (writeError && writeError.code!=='23505') return reply({error:'temporarily_unavailable'},503,origin);
  if (!writeError && v.future) {
    const {error:inviteError}=await api.from('imperion_rsvp_invite_requests').insert({
      data_controller:event.data_controller,email:v.email,first_name:v.first,
      confirmation_status:'PENDING_CONFIRMATION',
    });
    // RSVP remains valid; an opt-in request is NEVER an active mailing list entry.
    if (inviteError && inviteError.code!=='23505') console.error('Invitation request storage unavailable');
  }
  return reply({ok:true,status:'RECEIVED',confirmed:false,
    message:'Your RSVP request was received; the organizer must confirm participation separately.'},200,origin);
});
