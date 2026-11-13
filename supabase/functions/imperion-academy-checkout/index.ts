/**
 * IMPERION OSVC Academy checkout v1. Public lead intake, private evidence,
 * never an automatic paid booking. Reuses the existing Academy enquiries table.
 * Neither a transfer screenshot nor a booking request verifies bank receipt.
 */
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const ORIGIN="https://aliaksei-chareshneu.github.io";
const URL=Deno.env.get("SUPABASE_URL")||"";
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const DB=URL&&SECRET?createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const BUCKET="imperion-academy-payment-proofs";
const enc=new TextEncoder();
const SERVICES=new Set(["czech","english","math","physics","chemistry","biology","biochemistry","natural-sciences","python","data","fitness","calisthenics","fencing","archery","medical","offices","legal"]);
const LOCALES=new Set(["cs","en","ru","uk"]);
const EMAIL=/^[^\s@]{1,80}@[^\s@]{1,100}\.[^\s@]{2,}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cors(origin:string|null){
 const h:Record<string,string>={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Vary":"Origin"};
 if(origin===ORIGIN){h["Access-Control-Allow-Origin"]=ORIGIN;h["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";h["Access-Control-Allow-Headers"]="content-type";}
 return h;
}
function reply(value:Record<string,unknown>,status=200,origin:string|null=null){return new Response(JSON.stringify(value),{status,headers:cors(origin)});}
function field(x:Record<string,unknown>,key:string,n:number){let v=x[key];return typeof v==="string"?v.trim().slice(0,n+1):"";}
function asciiTracking(v:string){return /^[a-zA-Z0-9_-]{1,64}$/.test(v)?v:"";}
async function sha256(v:string|Uint8Array){
 const bytes=typeof v==="string"?enc.encode(v):v;
 const b=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function rateLimit(scope:string,value:string,limit:number){
 if(!DB)return false;
 const key=await sha256(SECRET.slice(0,50)+"|academy_checkout_v1|"+scope+"|"+value);
 const r=await DB.rpc("imperion_rsvp_allow_request",{p_key:key,p_limit:limit});
 if(r.error){console.error("checkout_rls_rate_error",r.error.code);return false;}
 return r.data===true;
}
function emailValid(s:string){return s.length<=180&&EMAIL.test(s);}
function continuation(){
 const v=crypto.getRandomValues(new Uint8Array(32));
 return btoa(String.fromCharCode(...v)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function authorize(x:Record<string,unknown>){
 const id=field(x,"reference",40),email=field(x,"email",180).toLowerCase(),code=field(x,"continuationCode",128);
 if(!DB||!UUID.test(id)||!emailValid(email)||!/^[-_A-Za-z0-9]{43}$/.test(code))return null;
 const h=await sha256(SECRET.slice(0,50)+"|checkout-continuation|"+code);
 const {data,error}=await DB.from("imperion_academy_inquiries")
  .select("id,email,service_key,service_variant,requested_session_at,quoted_amount_czk,quote_recipient,quote_account,quote_locked_at,quote_expires_at,payment_quote_status,payment_evidence_status,payment_proof_received_at,bank_verified_at,booking_confirmed_at,payment_token_hash,retention_until")
  .eq("id",id).eq("email",email).eq("payment_token_hash",h).limit(1).maybeSingle();
 return error?null:data;
}
async function order(raw:Record<string,unknown>,req:Request,origin:string|null){
 if(!DB)return reply({error:"temporarily_unavailable"},503,origin);
 if(raw.website)return reply({ok:true,status:"RECEIVED_UNCONFIRMED",paymentCollected:false,bookingConfirmed:false},200,origin);
 const service=field(raw,"serviceKey",50),variant=field(raw,"serviceVariant",12);
 const first=field(raw,"firstName",110),email=field(raw,"email",180).toLowerCase();
 const goal=field(raw,"goal",350),locale=field(raw,"locale",8);
 const when=field(raw,"requestedSession",45);
 const dt=when?Date.parse(when):NaN;
 const preferred=when?new Date(dt):null;
 const available=preferred&&Number.isFinite(dt)&&dt>Date.now()&&dt<Date.now()+90*86400000;
 if(!SERVICES.has(service)||!/^v[1-3]$/.test(variant)||first.length<2||first.length>110||!emailValid(email)||goal.length>350||
    !LOCALES.has(locale)||!available||
    raw.privacyAcknowledged!==true||raw.adultOrGuardianConfirmed!==true)
   return reply({error:"please_check_required_fields"},400,origin);
 const ip=String(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim().slice(0,90);
 if(ip&&!(await rateLimit("ip",ip,12)))return reply({error:"too_many_requests"},429,origin);
 if(!(await rateLimit("email",email,4)))return reply({error:"too_many_requests"},429,origin);
 const code=continuation();
 const idempotency=await sha256(SECRET.slice(0,50)+"|order|"+new Date().toISOString().slice(0,10)+"|"+email+"|"+service+"|"+variant+"|"+preferred.toISOString()+"|"+goal);
 const tokenHash=await sha256(SECRET.slice(0,50)+"|checkout-continuation|"+code);
 const extra="["+service+" / "+variant+"] "+goal;
 const {data,error}=await DB.from("imperion_academy_inquiries").insert({
  first_name:first,email,product_code:"LESSON",goal:extra.slice(0,500),
  deadline:"Preferred (not reserved): "+preferred.toISOString(),
  locale,source:"academy_checkout_20261113",
  utm_source:asciiTracking(field(raw,"utmSource",64)),
  utm_medium:asciiTracking(field(raw,"utmMedium",64)),
  utm_campaign:asciiTracking(field(raw,"utmCampaign",64)),
  idempotency_key:idempotency,privacy_acknowledged:true,adult_or_guardian_confirmed:true,
  service_key:service,service_variant:variant,requested_session_at:preferred.toISOString(),
  requested_duration_min:60,booking_status:"REQUESTED",payment_quote_status:"NOT_QUOTED",
  payment_evidence_status:"NOT_REQUIRED",payment_token_hash:tokenHash
 }).select("id").single();
 if(error){if(error.code==="23505")return reply({ok:true,status:"DUPLICATE_ENQUIRY",duplicate:true,bookingConfirmed:false,paymentCollected:false},200,origin);
  console.error("academy_checkout_insert",error.code);return reply({error:"temporarily_unavailable"},503,origin);}
 return reply({ok:true,status:"RECEIVED_UNCONFIRMED",reference:data.id,continuationCode:code,bookingConfirmed:false,paymentCollected:false,bankVerified:false},200,origin);
}
function approvedQuote(x:Record<string,unknown>){
 if(x.payment_quote_status!=="APPROVED"||!x.quote_locked_at||
    !(Number(x.quoted_amount_czk)>0)||!(typeof x.quote_recipient==="string"&&x.quote_recipient.length>=3)||
    !(typeof x.quote_account==="string"&&x.quote_account.length>=8))return false;
 if(x.quote_expires_at&&Date.parse(String(x.quote_expires_at))<Date.now())return false;
 return true;
}
async function quote(raw:Record<string,unknown>,req:Request,origin:string|null){
 const ip=String(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim().slice(0,90);
 if(ip&&!(await rateLimit("status_ip",ip,30)))return reply({error:"too_many_requests"},429,origin);
 const item=await authorize(raw);
 if(!item)return reply({error:"invalid_reference"},404,origin);
 const state=String(item.payment_evidence_status||"NOT_REQUIRED");
 const ok=approvedQuote(item);
 const bankVerified=!!item.bank_verified_at;
 const confirmed=bankVerified&&!!item.booking_confirmed_at;
 // No personal bank details until the organiser independently approves the exact offer.
 return reply({
  ok:true,reference:item.id,serviceKey:item.service_key,serviceVariant:item.service_variant,
  requestedSession:item.requested_session_at,quoteApproved:ok,
  amountCzk:ok?item.quoted_amount_czk:null,
  payee:ok?item.quote_recipient:null,bankAccount:ok?item.quote_account:null,
  paymentMessage:ok?"ACADEMY "+String(item.id).slice(0,8).toUpperCase():null,
  quoteExpiresAt:ok?item.quote_expires_at:null,
  proofRequired:ok&&state==="AWAITING_PROOF",paymentEvidenceStatus:state,
  evidenceReceived:state==="PROOF_RECEIVED"||state==="BANK_VERIFIED",
  bankVerified,bookingConfirmed:confirmed,
  status:confirmed?"CONFIRMED":bankVerified?"BANK_VERIFIED":state==="PROOF_RECEIVED"?"PROOF_RECEIVED":ok?"QUOTE_APPROVED":"REQUEST_REVIEW"
 },200,origin);
}
async function proof(req:Request,origin:string|null){
 if(!DB)return reply({error:"temporarily_unavailable"},503,origin);
 let body:FormData;
 try{body=await req.formData();}catch{return reply({error:"invalid_multipart"},400,origin);}
 const details={reference:body.get("reference"),email:body.get("email"),continuationCode:body.get("continuationCode")};
 const item=await authorize(details);
 if(!item)return reply({error:"invalid_reference"},404,origin);
 if(!approvedQuote(item)||item.payment_evidence_status!=="AWAITING_PROOF"||item.bank_verified_at)
   return reply({error:"quote_not_authorized_or_proof_not_needed"},409,origin);
 const file=body.get("paymentProof");
 if(!(file instanceof File)||file.size<100||file.size>2097152)return reply({error:"invalid_file_size"},400,origin);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const signature=(...v:number[])=>v.every((n,i)=>bytes[i]===n);
 let mime="",ext="";
 if(signature(0x25,0x50,0x44,0x46,0x2d)){mime="application/pdf";ext="pdf";}
 else if(signature(137,80,78,71,13,10,26,10)){mime="image/png";ext="png";}
 else if(signature(255,216,255)){mime="image/jpeg";ext="jpg";}
 else return reply({error:"unsupported_file_format"},400,origin);
 const digest=await sha256(bytes);
 const expiry=String(item.retention_until||"").slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry))return reply({error:"retention_configuration_unavailable"},503,origin);
 const path=expiry+"/"+crypto.randomUUID()+"."+ext;
 const saved=await DB.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"0"});
 if(saved.error){console.error("academy_private_upload",saved.error.message);return reply({error:"private_upload_unavailable"},503,origin);}
 const {data,error}=await DB.from("imperion_academy_inquiries")
  .update({payment_proof_path:path,payment_proof_sha256:digest,payment_proof_mime:mime,
    payment_proof_received_at:new Date().toISOString(),payment_evidence_status:"PROOF_RECEIVED"})
  .eq("id",item.id).eq("payment_evidence_status","AWAITING_PROOF").is("bank_verified_at",null)
  .select("id").maybeSingle();
 if(error||!data?.id){
   // Roll back a private upload on an unexpected race/DB failure.
   await DB.storage.from(BUCKET).remove([path]);
   return reply({error:"private_receipt_update_unavailable"},409,origin);
 }
 return reply({ok:true,status:"PROOF_RECEIVED",reference:item.id,evidenceReceived:true,bankVerified:false,bookingConfirmed:false},200,origin);
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return origin===ORIGIN?new Response(null,{status:204,headers:cors(origin)}):reply({error:"forbidden_origin"},403,null);
 if(req.method==="GET")return reply({ok:true,service:"academy_checkout_v1",accepting:!!DB,publicLiveSlots:false,
   bankVerifiedAutomatically:false,bookingConfirmedAutomatically:false},DB?200:503,origin);
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
 if(origin!==ORIGIN)return reply({error:"forbidden_origin"},403,null);
 if(!DB)return reply({error:"temporarily_unavailable"},503,origin);
 const size=Number(req.headers.get("content-length")||0);
 if(size>2300000)return reply({error:"payload_too_large"},413,origin);
 const contentType=(req.headers.get("content-type")||"").toLowerCase();
 if(contentType.startsWith("multipart/form-data"))return proof(req,origin);
 if(!contentType.startsWith("application/json")||size>8192)return reply({error:"invalid_content_type"},400,origin);
 let raw:Record<string,unknown>;
 try{const text=await req.text();if(text.length>8192)throw Error("length");const value=JSON.parse(text);
     if(!value||typeof value!=="object"||Array.isArray(value))throw Error("object");raw=value;}
 catch{return reply({error:"invalid_request"},400,origin);}
 const action=field(raw,"action",20);
 if(action==="order")return order(raw,req,origin);
 if(action==="status")return quote(raw,req,origin);
 return reply({error:"invalid_action"},400,origin);
});
