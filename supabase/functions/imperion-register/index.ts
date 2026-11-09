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
// Participant-reported first discovery is optional and never a marketing opt-in.
// Campaign codes are short ASCII tokens: no URLs, IP addresses, emails or click IDs.
const DISCOVERY_CHOICES=['FACEBOOK','INSTAGRAM','WHATSAPP','TELEGRAM','FRIEND',
  'GOTOBRNO','IS_MUNI','SPOLEK_MUNI','OTHER_SITE','OTHER'] as const;
function discoveryCode(v:unknown):string|null {
  const s=text(v,30).toUpperCase();
  return DISCOVERY_CHOICES.includes(s as typeof DISCOVERY_CHOICES[number])?s:null;
}
function campaignCode(v:unknown,max:number):string|null {
  const s=text(v,max+1);
  return s.length>0&&s.length<=max&&/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s)?s:null;
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
const INVITE_LINK = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{22}$/;

// Canonical community announcement links (Drive 00 READ FIRST, checked 2026-11-01).
// Chat invitation links are NEVER returned by an anonymous registration endpoint.
const COMMUNITY_UPDATES = {
  druzina: {
    whatsapp: 'https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu',
    telegram: 'https://t.me/druzinamoravy_news',
  },
  brnowalkers: {
    whatsapp: 'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0',
    telegram: 'https://t.me/pochody_brno_news',
  },
} as const;
const TG_PUBLIC_LINK = /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/;
function communityChannels(community: string, locale: string, age: string, rsvp: string) {
  // A submitted RSVP is NOT attendance/booking confirmation or marketing opt-in.
  if (age !== 'adult' || rsvp === 'NO') return null;
  const name = community.normalize('NFKC').trim().toLowerCase();
  const key = name === 'družina moravy' || name === 'druzina moravy'
    ? 'druzina'
    : name === 'brnowalkers' || name === 'brnowalkers / osvč'
      ? 'brnowalkers' : null;
  if (!key) return null; // Never mix organizers or guess from an event category.
  const platform = locale === 'cs' || locale === 'en' ? 'whatsapp'
    : locale === 'ru' || locale === 'uk' ? 'telegram' : null;
  if (!platform) return null;
  return {
    platform,
    informationUrl: COMMUNITY_UPDATES[key][platform],
    chatAccess: key === 'druzina' ? 'AFTER_ATTENDANCE_AND_NEXT_TRAINING_PAYMENT' : 'AFTER_ATTENDANCE',
  };
}

const EVENT_COLS='event_id,title,community,category,begins_at,ends_at,venue,price_czk,data_controller,rules_url,contact_activity,is_open,registration_mode,action_url,public_note,price_verified,end_time_verified,source_active,training_price_scheme,training_confirmed_count,training_quote_locked_at,training_operational_go_at,training_payment_open,training_payment_recipient,training_payment_account';
const PROOF_BUCKET='imperion-training-payment-proofs';
const MAX_PDF_BYTES=2*1024*1024;
const MAX_MULTIPART_BYTES=MAX_PDF_BYTES+15000;
const LATE_WINDOW_MS=48*60*60*1000;
type TrainingEvent={event_id:string;community:string;category:string;begins_at:string;ends_at:string;price_verified:boolean;end_time_verified:boolean;source_active:boolean;is_open:boolean;registration_mode:string;training_price_scheme:string;training_confirmed_count:number|null;training_quote_locked_at:string|null;training_operational_go_at:string|null;training_payment_open:boolean;training_payment_recipient:string|null;training_payment_account:string|null};
function trainingQuote(e:TrainingEvent,now=Date.now()){
  if(e.community!=='Družina Moravy'||e.category!=='HEMA Training'||e.training_price_scheme!=='GROUP_SHARED')return null;
  const n=e.training_confirmed_count;
  const eligible=Number.isInteger(n)&&n!==null&&n>=3&&n<=200;
  const ready=!!(eligible&&e.training_quote_locked_at&&e.training_operational_go_at
    &&e.training_payment_open&&e.is_open&&e.registration_mode==='FORM'
    &&e.source_active&&e.price_verified&&e.end_time_verified
    &&String(e.training_payment_recipient||'').trim().length>=3
    &&String(e.training_payment_account||'').trim().length>=8);
  const base=ready?Math.ceil((1000+160*((n as number)-1))/(n as number)):null;
  const late=Date.parse(e.begins_at)-now<LATE_WINDOW_MS;
  const surcharge=base===null?null:late?Math.ceil(base*0.25):0;
  return {status:ready?'PAYMENT_OPEN':'AWAITING_VERIFIED_GROUP',confirmedCount:eligible?n:null,
    baseCzk:base,surchargeCzk:surcharge,totalCzk:base===null?null:base+(surcharge as number),
    late48h:late,proofRequired:ready,quoteLockedAt:ready?e.training_quote_locked_at:null,
    recipient:ready?e.training_payment_recipient:null,account:ready?e.training_payment_account:null};
}
async function readSmallMultipart(req:Request,contentType:string){
  if(!req.body)throw new Error('empty');
  const reader=req.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  while(true){const item=await reader.read();if(item.done)break;
    length+=item.value.byteLength;if(length>MAX_MULTIPART_BYTES){await reader.cancel();throw new Error('size');}
    chunks.push(item.value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new Request('https://upload.invalid/',{method:'POST',headers:{'content-type':contentType},body:bytes}).formData();
}
async function pdfInfo(file:File){
  if(file.size<100||file.size>MAX_PDF_BYTES||!file.name.toLowerCase().endsWith('.pdf')
    ||(file.type&&file.type!=='application/pdf'))throw new Error('invalid_pdf');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('invalid_pdf');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return {hash:Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join(''),bytes};
}

// 02 Nov 2026 decision: the minimum attendance threshold is met.
// Orel 14 Nov workshop accepts preliminary RSVPs until the event begins,
// 14 Nov 2026 12:00 Europe/Prague; acceptance is NOT a confirmed place.
// Keep this cutoff aligned with begins_at and do not change unrelated events.
const REGISTRATION_CLOSES_AT = Object.freeze({
  'PUB-OREL-20261114': Date.parse('2026-11-14T12:00:00+01:00'),
});
function registrationStillOpen(eventId: string, atMs: number = Date.now()): boolean {
  const cutoff = REGISTRATION_CLOSES_AT[eventId as keyof typeof REGISTRATION_CLOSES_AT];
  return cutoff === undefined || (Number.isFinite(cutoff) && atMs < cutoff);
}

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
      .eq('public_listing',true).eq('source_active',true)
      .gt('begins_at',new Date().toISOString()).order('begins_at',{ascending:true}).limit(120);
    if (error) return reply({error:'temporarily_unavailable'},503,origin);
    return reply({events:(data||[]).filter(e=>registrationStillOpen(e.event_id)).map(e=>{
      const {training_payment_recipient,training_payment_account,...safe}=e;
      return {...safe,trainingPayment:trainingQuote(e)};
    }),version:'2026-11-09-training-quotes-v1',bookingConfirmed:false},200,origin);
  }
  // POST requires a real browser origin. A non-browser script can forge it,
  // so we also validate strictly and rate-limit server-side.
  if (origin!==ALLOWED_ORIGIN) return reply({error:'forbidden_origin'},403,origin);
  const len=Number(req.headers.get('content-length')||'0');
  const contentType=(req.headers.get('content-type')||'').toLowerCase();
  if(len>MAX_MULTIPART_BYTES)return reply({error:'payload_too_large'},413,origin);
  let body:Record<string,unknown>;let proof:File|null=null;
  try{
    if(contentType.startsWith('multipart/form-data;')){
      const fields=await readSmallMultipart(req,req.headers.get('content-type')||'');
      const raw=fields.get('payload'),file=fields.get('paymentProof');
      if(typeof raw!=='string'||raw.length>8192)throw new Error('payload');
      body=JSON.parse(raw);
      if(file instanceof File)proof=file;
      if(fields.get('paymentProof')&&!proof)throw new Error('file');
    }else if(contentType.startsWith('application/json')){
      const raw=await req.text();if(raw.length>8192)throw new Error('size');
      body=JSON.parse(raw);
    }else throw new Error('type');
    if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('type');
  }catch{return reply({error:'invalid_request'},400,origin);}
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
    discovery:string|null;utmSource:string|null;utmMedium:string|null;utmCampaign:string|null;
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
      discovery:discoveryCode(body.discoverySource),
      utmSource:campaignCode(body.utmSource,48),
      utmMedium:campaignCode(body.utmMedium,24),
      utmCampaign:campaignCode(body.utmCampaign,64),
    };
    v.eventId=text(body.eventId,100);
    if (!/^[A-Za-z0-9-]{2,100}$/.test(v.eventId)) throw new Error('event');
    if (age==='under18' && (v.guardianName||'').length<3) throw new Error('guardian');
    if (body.safety!==true) throw new Error('safety');
    if (age==='under18') v.photo='NO';
  } catch {return reply({error:'please_check_required_fields'},400,origin);}
  if (!registrationStillOpen(v.eventId)) return reply({error:'event_not_available'},400,origin);
  const {data:event,error:eventError}=await api.from('imperion_rsvp_events')
    .select(EVENT_COLS+',updates_group_url').eq('event_id',v.eventId).eq('is_open',true)
    .eq('registration_mode','FORM').eq('source_active',true)
    .eq('price_verified',true).eq('end_time_verified',true)
    .eq('public_listing',true)
    .gt('begins_at',new Date().toISOString()).maybeSingle();
  if (eventError) return reply({error:'temporarily_unavailable'},503,origin);
  if (!event) return reply({error:'event_not_available'},400,origin);
  if (event.contact_activity && !/\/druzina\/(safety|rules)\//.test(String(event.rules_url)))
    return reply({error:'event_not_available'},400,origin);
  const ip=String(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
    req.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,100);
  if (ip && !(await allow('ip',ip,12))) return reply({error:'too_many_requests'},429,origin);
  if (!(await allow('email',v.email,8))) return reply({error:'too_many_requests'},429,origin);
  // A direct POST must not bypass the calendar registration cutoff even when
  // the sheet feed still says is_open=true. Recheck after database read.
  if (!registrationStillOpen(v.eventId)) return reply({error:'event_not_available'},400,origin);
  const quote=trainingQuote(event);
  const evidenceRequired=quote?.status==='PAYMENT_OPEN'&&v.rsvp==='YES';
  let proofHash:string|null=null;let proofBytes:Uint8Array|null=null;
  if(evidenceRequired){
    if(!proof)return reply({error:'payment_pdf_required'},400,origin);
    try{
      const parsed=await pdfInfo(proof);proofHash=parsed.hash;proofBytes=parsed.bytes;
      if(body.quotedTotalCzk!==quote.totalCzk||
        body.quoteLockedAt!==quote.quoteLockedAt||
        body.quotedConfirmedCount!==quote.confirmedCount)
        return reply({error:'quote_changed',trainingPayment:quote},409,origin);
    }catch{return reply({error:'invalid_payment_pdf'},400,origin);}
  }else if(proof)return reply({error:'payment_not_open'},400,origin);
  const expiry=new Date(new Date(event.ends_at).getTime()+90*86400000);
  const pdfPath=evidenceRequired?expiry.toISOString().slice(0,10)+'/'+crypto.randomUUID()+'.pdf':null;
  const {data:inserted,error:writeError}=await api.from('imperion_rsvp_submissions').insert({
    event_id:v.eventId,first_name:v.first,last_name:v.last,email:v.email,phone:v.phone,
    age_group:v.age,guardian_name:v.guardianName,guardian_phone:v.guardianPhone,
    rsvp_status:v.rsvp,safety_acknowledged:true,safety_version:'2026-10-25-v1',
    photo_choice:v.photo,marketing_requested:v.future,data_controller:event.data_controller,
    language:v.locale,retention_until:expiry.toISOString(),
    discovery_source:v.discovery,utm_source:v.utmSource,
    utm_medium:v.utmMedium,utm_campaign:v.utmCampaign,
    ...(evidenceRequired?{status:'PENDING_UPLOAD',quoted_base_czk:quote!.baseCzk,
      quoted_late_fee_czk:quote!.surchargeCzk,quoted_total_czk:quote!.totalCzk,
      quoted_confirmed_count:quote!.confirmedCount,quoted_late_48h:quote!.late48h}:{}),
  }).select('id').single();
  // A duplicate is deliberately indistinguishable to avoid an identity oracle
  // and must never mutate existing contact information or consents.
  if (writeError && writeError.code!=='23505') return reply({error:'temporarily_unavailable'},503,origin);
  if(!writeError&&evidenceRequired&&inserted?.id&&pdfPath&&proofBytes&&proofHash){
    const upload=await api.storage.from(PROOF_BUCKET).upload(pdfPath,proofBytes,{
      contentType:'application/pdf',upsert:false,cacheControl:'0'
    });
    if(upload.error){
      await api.from('imperion_rsvp_submissions').delete().eq('id',inserted.id).eq('status','PENDING_UPLOAD');
      return reply({error:'proof_storage_unavailable'},503,origin);
    }
    const saved=await api.from('imperion_rsvp_submissions').update({
      payment_pdf_path:pdfPath,payment_pdf_sha256:proofHash,
      payment_evidence_status:'PROOF_RECEIVED',payment_evidence_received_at:new Date().toISOString(),
      status:'RECEIVED_UNCONFIRMED',
    }).eq('id',inserted.id).eq('status','PENDING_UPLOAD').select('id').single();
    if(saved.error||!saved.data){
      await api.storage.from(PROOF_BUCKET).remove([pdfPath]);
      await api.from('imperion_rsvp_submissions').delete().eq('id',inserted.id).eq('status','PENDING_UPLOAD');
      return reply({error:'proof_storage_unavailable'},503,origin);
    }
  }
  if (!writeError && v.future) {
    const {error:inviteError}=await api.from('imperion_rsvp_invite_requests').insert({
      data_controller:event.data_controller,email:v.email,first_name:v.first,
      confirmation_status:'PENDING_CONFIRMATION',
    });
    // RSVP remains valid; an opt-in request is NEVER an active mailing list entry.
    if (inviteError && inviteError.code!=='23505') console.error('Invitation request storage unavailable');
  }
  // Event-specific logistics only, never marketing; intentionally excluded from
  // the anonymous GET catalog. Minors do not receive a public group invite.
  const channels = communityChannels(String(event.community||''), v.locale, v.age, v.rsvp);
  const rawEventGroup = typeof event.updates_group_url === 'string' ? event.updates_group_url : '';
  // Event-specific logistics invitations remain POST-only and must match locale.
  const invite = channels && (
    (channels.platform === 'whatsapp' && INVITE_LINK.test(rawEventGroup)) ||
    (channels.platform === 'telegram' && TG_PUBLIC_LINK.test(rawEventGroup))
  ) ? rawEventGroup : null;
  return reply({ok:true,status:'RECEIVED',confirmed:false,
    ...(evidenceRequired&&!writeError?{paymentEvidenceStatus:'PROOF_RECEIVED',bankVerified:false,
      quotedTotalCzk:quote?.totalCzk}:{}),
    ...(channels ? {communityChannels:channels} : {}),
    ...(invite ? {updatesGroupUrl:invite} : {}),
    message:'Your RSVP request was received; the organizer must confirm participation separately.'},200,origin);
});
