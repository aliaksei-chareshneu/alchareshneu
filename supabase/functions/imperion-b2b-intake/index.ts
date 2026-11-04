/**
 * OSVC corporate enquiry intake. Not an accepted order, payment or email marketing opt-in.
 * Personal data is kept in a service-role-only table, never returned by this API.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const ORIGIN = 'https://aliaksei-chareshneu.github.io';
const URL = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const api = URL && KEY ? createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;
const encoder = new TextEncoder();
const OFFERS = new Set(['AI_WORKSHOP','DATA_PILOT','SCIENTIFIC_CONSULTING','HEMA_CORPORATE']);
const BANDS = new Set(['<15000','15000-30000','30000-70000','70000+','unknown']);
function headers(origin:string|null) {
 const h:Record<string,string> = {
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff','Vary':'Origin'
 };
 if (origin===ORIGIN) {
   h['Access-Control-Allow-Origin']=ORIGIN;
   h['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
   h['Access-Control-Allow-Headers']='content-type';
 }
 return h;
}
function reply(payload:object,code:number,origin:string|null) {
 return new Response(JSON.stringify(payload),{status:code,headers:headers(origin)});
}
function field(o:Record<string,unknown>,name:string,max=150) {
 const x=o[name]; return typeof x==='string' ? x.trim().slice(0,max+1) : '';
}
async function boundedBody(req:Request) {
 const reader=req.body?.getReader();
 if(!reader)throw Error('body');
 const decoder=new TextDecoder();let size=0,raw='';
 while(true){
   const part=await reader.read();if(part.done)break;
   size+=part.value.byteLength;
   if(size>8192){await reader.cancel();throw Error('size');}
   raw+=decoder.decode(part.value,{stream:true});
 }
 return raw+decoder.decode();
}
async function digest(s:string) {
 const buf=await crypto.subtle.digest('SHA-256',encoder.encode(s));
 return Array.from(new Uint8Array(buf)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function allowed(scope:string,key:string,limit:number) {
 if (!api) return false;
 const hash=await digest(KEY+'|osvc_b2b_v1|'+scope+'|'+key);
 const {data,error}=await api.rpc('imperion_rsvp_allow_request',{p_key:hash,p_limit:limit});
 if (error) { console.error('rate limit unavailable'); throw Error('rate unavailable'); }
 return data===true;
}
Deno.serve(async(req:Request):Promise<Response>=>{
 const origin=req.headers.get('origin');
 try{
 if(req.method==='OPTIONS')return origin===ORIGIN
   ? new Response(null,{status:204,headers:headers(origin)})
   : reply({error:'forbidden_origin'},403,null);
 if(req.method==='GET')return reply({ok:true,service:'osvc_b2b_intake_v1',accepting:!!api,bookingConfirmed:false,paymentCollected:false},api?200:503,origin);
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405,origin);
 // CORS alone is not authentication, but strict origin checks reduce accidental abuse.
 if(origin!==ORIGIN)return reply({error:'forbidden_origin'},403,null);
 if(!api)return reply({error:'temporarily_unavailable'},503,origin);
 if(Number(req.headers.get('content-length')||0)>8192||!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
   return reply({error:'invalid_request'},400,origin);
 let body:Record<string,unknown>;
 try{
   const raw=await boundedBody(req);
   body=JSON.parse(raw);
   if(!body||typeof body!=='object'||Array.isArray(body))throw Error('body');
 }catch{return reply({error:'invalid_request'},400,origin);}
 // Hidden field: disarm bots, never persist fabricated data.
 if(body.website)return reply({error:'please_check_required_fields'},400,origin);
 const company=field(body,'company',150), contact_name=field(body,'contactName',110);
 const email=field(body,'email',180).toLowerCase(),phone=field(body,'phone',42);
 const offer=field(body,'offer',35),summary=field(body,'summary',1300);
 const budget_band=field(body,'budgetBand',32),preferred_timeframe=field(body,'timeframe',90);
 const source=field(body,'source',65),team_size=body.teamSize===null||body.teamSize===''||body.teamSize===undefined?null:Number(body.teamSize);
 if(company.length<2||company.length>150||contact_name.length<2||contact_name.length>110||
   !/^[^\s@]{1,80}@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>180||
   phone.length>42||!OFFERS.has(offer)||summary.length<15||summary.length>1300||
   !BANDS.has(budget_band)||preferred_timeframe.length<2||preferred_timeframe.length>90||
   (team_size!==null&&(!Number.isInteger(team_size)||team_size<1||team_size>500))||
   body.privacyAcknowledged!==true)return reply({error:'please_check_required_fields'},400,origin);
 const safeSource=/^[a-zA-Z0-9_-]{2,65}$/.test(source)?source:'corporate_website';
 const ip=String(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,80);
 if(ip && !(await allowed('ip',ip,12)))return reply({error:'too_many_requests'},429,origin);
 if(!(await allowed('email',email,5)))return reply({error:'too_many_requests'},429,origin);
 const utm = (name:string) => {
   const value=field(body,name,64);
   return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)?value:null;
 };
 // Bind deduplication to the complete enquiry: guessed email/offer must not reveal another UUID.
 const idempotency_key=await digest(KEY+'|b2b-content-v2|'+JSON.stringify([
   email,offer,company,contact_name,phone,summary,budget_band,preferred_timeframe,team_size
 ]));
 const {data,error}=await api.from('imperion_b2b_inquiries').insert({
    company,contact_name,email,phone:phone||null,offer,summary,
    budget_band,preferred_timeframe,team_size,source:safeSource,
    privacy_acknowledged:true,idempotency_key,
    utm_source:utm('utmSource'),utm_medium:utm('utmMedium'),utm_campaign:utm('utmCampaign')
 }).select('id').single();
 if(error){
   // Only return a receipt after reading the canonical persisted row.
   if(error.code==='23505'){
     const existing=await api.from('imperion_b2b_inquiries').select('id')
       .eq('idempotency_key',idempotency_key).single();
     if(!existing.error&&existing.data?.id)return reply({ok:true,status:'RECEIVED_UNCONFIRMED',
       confirmed:false,duplicate:true,reference:existing.data.id},200,origin);
   }
   console.error('private intake write failed',error.code);
   return reply({error:'temporarily_unavailable'},503,origin);
 }
 if(!data?.id)return reply({error:'temporarily_unavailable'},503,origin);
 return reply({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,reference:data.id,
   message:'Request received for review. No booking, payment, or contract is formed.'},200,origin);
 }catch{
   console.error('private intake unavailable');
   return reply({error:'temporarily_unavailable'},503,origin);
 }
});