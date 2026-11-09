/** OSVC Academy paid-lesson booking: public slots, private PDF proof, BANK UNVERIFIED. */
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const ORIGIN = "https://aliaksei-chareshneu.github.io";
const BUCKET = "imperion-academy-payment-proofs";
const LIMIT = 4 * 1024 * 1024;
const URL = Deno.env.get("SUPABASE_URL") || "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const api = URL && KEY ? createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
const SUBJECTS = new Set(["CZECH","ENGLISH","GERMAN","MATHS","PHYSICS","CHEMISTRY","BIOLOGY","PROGRAMMING","OTHER"]);
const LANGS = new Set(["en","cs","ru","uk"]);
const ACTIVE = ["PENDING_BANK_CHECK","PAYMENT_VERIFIED","BOOKING_CONFIRMED"];
const encoder = new TextEncoder();

function headers(origin:string|null):Record<string,string> {
 const h:Record<string,string>={"Content-Type":"application/json; charset=utf-8",
   "Cache-Control":"no-store","Vary":"Origin","X-Content-Type-Options":"nosniff"};
 if(origin===ORIGIN) Object.assign(h,{"Access-Control-Allow-Origin":ORIGIN,
   "Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"content-type"});
 return h;
}
function respond(payload:unknown,status:number,origin:string|null) {
 return new Response(JSON.stringify(payload),{status,headers:headers(origin)});
}
async function sha(input:string):Promise<string>{
 const value=await crypto.subtle.digest("SHA-256",encoder.encode(input));
 return Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,"0")).join("");
}
async function allowed(scope:string,value:string,max:number):Promise<boolean>{
 if(!api)return false;
 const hashed=await sha(KEY.slice(0,48)+"|academy_book_v1|"+scope+"|"+value);
 const r=await api.rpc("imperion_rsvp_allow_request",{p_key:hashed,p_limit:max});
 if(r.error) {console.error("rate_limit_error",r.error.code);return false;}
 return r.data===true;
}
async function boundedForm(req:Request):Promise<FormData> {
 const type=req.headers.get("content-type")||"";
 if(!/^multipart\/form-data\s*;/i.test(type))throw Error("invalid_content_type");
 const reported=Number(req.headers.get("content-length")||"0");
 if(reported>LIMIT+65536)throw Error("oversize");
 if(!req.body)throw Error("missing_body");
 const reader=req.body.getReader();
 const pieces:Uint8Array[]=[];
 let total=0;
 while(true){
  const {value,done}=await reader.read();
  if(done)break;
  total+=(value?.byteLength||0);
  if(total>LIMIT+65536){await reader.cancel();throw Error("oversize");}
  if(value)pieces.push(value);
 }
 const envelope=new Request(req.url,{method:"POST",headers:{"Content-Type":type},
   body:new Blob(pieces)});
 return await envelope.formData();
}
function value(form:FormData,key:string,max:number):string {
 const v=form.get(key);
 return typeof v==="string"?v.trim().slice(0,max+1):"";
}
async function available(origin:string|null){
 if(!api)return respond({error:"unavailable"},503,origin);
 const now=Date.now();
 const from=new Date(now+2*3600*1000).toISOString();
 const to=new Date(now+45*24*3600*1000).toISOString();
 const r=await api.from("imperion_academy_slots")
  .select("id,starts_at,ends_at,service_code,delivery_mode")
  .eq("is_open",true).not("owner_approved_at","is",null)
  .gte("starts_at",from).lte("starts_at",to)
  .order("starts_at",{ascending:true}).limit(100);
 if(r.error){console.error("slot_list_failed",r.error.code);return respond({error:"temporarily_unavailable"},503,origin);}
 const slots=r.data||[];
 if(!slots.length)return respond({ok:true,slots:[],server_now:new Date(now).toISOString(),timezone:"Europe/Prague",
   rates_czk:{LESSON:1000,CONSULT:250},late_surcharge_pct:25,bank_payment_verified:false},200,origin);
 const claimed=await api.from("imperion_academy_inquiries")
   .select("slot_id").in("status",ACTIVE).in("slot_id",slots.map(s=>s.id)).limit(150);
 if(claimed.error){console.error("claims_list_failed",claimed.error.code);return respond({error:"temporarily_unavailable"},503,origin);}
 const taken=new Set((claimed.data||[]).map(s=>s.slot_id));
 return respond({ok:true,slots:slots.filter(s=>!taken.has(s.id)),server_now:new Date(now).toISOString(),
   timezone:"Europe/Prague",rates_czk:{LESSON:1000,CONSULT:250},late_surcharge_pct:25,
   bank_payment_verified:false},200,origin);
}
Deno.serve(async(req:Request):Promise<Response>=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return origin===ORIGIN?
   new Response(null,{status:204,headers:headers(origin)}):
   respond({error:"forbidden_origin"},403,null);
 if(req.method==="GET")return await available(origin);
 if(req.method!=="POST")return respond({error:"method_not_allowed"},405,origin);
 if(origin!==ORIGIN)return respond({error:"forbidden_origin"},403,null);
 if(!api)return respond({error:"temporarily_unavailable"},503,origin);
 let form:FormData;
 try{form=await boundedForm(req);}
 catch(e){return respond({error:e instanceof Error&&e.message==="oversize"?"pdf_too_large":"invalid_request"},400,origin);}
 if(form.get("website"))return respond({ok:true,status:"PENDING_BANK_CHECK",confirmed:false},200,origin);
 const slot=value(form,"slot",50),name=value(form,"name",110);
 const email=value(form,"email",180).toLowerCase();
 const subject=value(form,"subject",20),locale=value(form,"locale",8);
 const goal=value(form,"goal",500),requestId=value(form,"requestId",50);
 const privacy=form.get("privacy")==="yes";
 const adult=form.get("adultOrGuardian")==="yes";
 const pdf=form.get("receipt");
 if(!/^[a-f0-9-]{36}$/i.test(slot)||name.length<2||name.length>110||
    !/^[^\s@]{1,80}@[^\s@]+\.[^\s@]{2,}$/.test(email)||
    !SUBJECTS.has(subject)||!LANGS.has(locale)||goal.length>500||
    !/^[a-f0-9-]{36}$/i.test(requestId)||!privacy||!adult||
    !(pdf instanceof File)||pdf.size<50||pdf.size>LIMIT||
    !/\.pdf$/i.test(pdf.name)||pdf.type!=="application/pdf")
   return respond({error:"invalid_fields_or_pdf"},400,origin);

 const firstFive=new Uint8Array(await pdf.slice(0,5).arrayBuffer());
 if(firstFive.join(",")!=="37,80,68,70,45")
   return respond({error:"not_a_pdf"},400,origin);
 const ip=String(req.headers.get("cf-connecting-ip")||"").slice(0,100);
 if(ip&&!(await allowed("ip",ip,16)))return respond({error:"rate_limited"},429,origin);
 if(!(await allowed("email",email,5)))return respond({error:"rate_limited"},429,origin);

 const idempotency=await sha(KEY.slice(0,48)+"|academy_booking|"+requestId+"|"+email);
 const path="proofs/"+crypto.randomUUID()+".pdf";
 const {error:uploadError}=await api.storage.from(BUCKET).upload(path,
   new Uint8Array(await pdf.arrayBuffer()),{contentType:"application/pdf",upsert:false,cacheControl:"0"});
 if(uploadError){console.error("private_upload_failed",uploadError.message);
   return respond({error:"upload_unavailable"},503,origin);}
 let keep=false;
 try{
  const response=await api.rpc("imperion_academy_claim_slot",{
   p_slot:slot,p_name:name,p_email:email,p_subject:subject,p_locale:locale,
   p_goal:goal,p_receipt_path:path,p_idempotency:idempotency,
   p_privacy:privacy,p_adult_or_guardian:adult
  });
  if(response.error){
   const unavailable=response.error.message?.includes("slot_unavailable")||
     response.error.code==="23505";
   if(!unavailable)console.error("booking_save_failed",response.error.code);
   return respond({error:unavailable?"slot_unavailable":"temporarily_unavailable"},unavailable?409:503,origin);
  }
  const result=response.data;
  if(!result?.reference)return respond({error:"temporarily_unavailable"},503,origin);
  keep=result.duplicate!==true;
  return respond({ok:true,reference:result.reference,status:result.status,
   total_czk:result.total_czk,surcharge_czk:result.surcharge_czk,
   payment_verified:false,booking_confirmed:false,
   notice:"PDF received. The transfer is not bank-verified. A time slot is not confirmed until organizer approval."},200,origin);
 }catch(e){console.error("booking_unexpected",e instanceof Error?e.name:"unknown");
   return respond({error:"temporarily_unavailable"},503,origin);
 }finally{
  if(!keep){const cleanup=await api.storage.from(BUCKET).remove([path]);
   if(cleanup.error)console.error("orphan_proof_cleanup_failed",cleanup.error.message);}
 }
});
