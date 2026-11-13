/** Public OSVC Academy programme enquiry intake. NO booking, invoice, marketing opt-in or payment. */
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
const ORIGIN = "https://aliaksei-chareshneu.github.io";
const S_URL = Deno.env.get("SUPABASE_URL") || "";
const S_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const api = S_URL && S_KEY ? createClient(S_URL,S_KEY,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
const PRODS = new Set(["UNI","MED","A2","CER","CAREER","DEFENSE","EXEC","LIFE","LESSON","CONSULT","PACK5","PACK10","PACK20"]);
const LOCALES = new Set(["en","cs","ru","uk"]);
const enc = new TextEncoder();
function headers(origin:string|null):Record<string,string>{
  const h:Record<string,string>={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"};
  if(origin===ORIGIN){h["Access-Control-Allow-Origin"]=ORIGIN;h["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";h["Access-Control-Allow-Headers"]="content-type";}
  return h;
}
function reply(obj:object,status:number,origin:string|null){return new Response(JSON.stringify(obj),{status,headers:headers(origin)});}
function field(data:Record<string,unknown>,key:string,cap:number){const val=data[key];return typeof val==="string"?val.trim().slice(0,cap+1):"";}
function tracking(x:string){return /^[a-zA-Z0-9_-]{1,64}$/.test(x)?x:"";}
async function hash(input:string){const b=await crypto.subtle.digest("SHA-256",enc.encode(input));return Array.from(new Uint8Array(b)).map(v=>v.toString(16).padStart(2,"0")).join("");}
async function allow(scope:string,value:string,limit:number){
 if(!api)return false;
 const key=await hash(S_KEY.slice(0,48)+"|osvc_academy_v1|"+scope+"|"+value);
 const r=await api.rpc("imperion_rsvp_allow_request",{p_key:key,p_limit:limit});
 if(r.error){console.error("rate_limit_check_error",r.error.code);return false;}
 return r.data===true;
}
Deno.serve(async(req:Request):Promise<Response>=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return origin===ORIGIN?new Response(null,{status:204,headers:headers(origin)}):reply({error:"forbidden_origin"},403,null);
 if(req.method==="GET")return reply({ok:true,service:"academy_enquiry_v1",accepting:!!api,bookingConfirmed:false,paymentCollected:false},api?200:503,origin);
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
 if(origin!==ORIGIN)return reply({error:"forbidden_origin"},403,null);
 if(!api)return reply({error:"temporarily_unavailable"},503,origin);
 if(Number(req.headers.get("content-length")||0)>6144||!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return reply({error:"invalid_request"},400,origin);
 let body:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>6144)throw Error("length");body=JSON.parse(raw);if(!body||typeof body!=="object"||Array.isArray(body))throw Error("json");}
 catch{return reply({error:"invalid_request"},400,origin);}
 // Honeypot drops obvious spam without disclosing the decision.
 if(body.website)return reply({ok:true,status:"RECEIVED_UNCONFIRMED",confirmed:false,bookingConfirmed:false},200,origin);
 const first_name=field(body,"firstName",110);
 const email=field(body,"email",180).toLowerCase();
 const product_code=field(body,"programme",20);
 const goal=field(body,"goal",500);
 const deadline=field(body,"deadline",400);
 const locale=field(body,"locale",8);
 const utm_source=tracking(field(body,"utmSource",64)),utm_medium=tracking(field(body,"utmMedium",64)),utm_campaign=tracking(field(body,"utmCampaign",64));
 if(first_name.length<2||first_name.length>110||email.length>180||
    !/^[^\s@]{1,80}@[^\s@]+\.[^\s@]{2,}$/.test(email)||!PRODS.has(product_code)||
    goal.length>500||deadline.length>400||!LOCALES.has(locale)||
    body.privacyAcknowledged!==true||body.adultOrGuardianConfirmed!==true)
    return reply({error:"please_check_required_fields"},400,origin);
 const ip=String(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim().slice(0,90);
 if(ip&&!(await allow("ip",ip,12)))return reply({error:"too_many_requests"},429,origin);
 if(!(await allow("email",email,4)))return reply({error:"too_many_requests"},429,origin);
 const idempotency_key=await hash(S_KEY.slice(0,48)+"|dedup|"+new Date().toISOString().slice(0,10)+"|"+email+"|"+product_code+"|"+goal+"|"+deadline);
 const {data,error}=await api.from("imperion_academy_inquiries").insert({
  first_name,email,product_code,goal,deadline,locale,utm_source,utm_medium,utm_campaign,
  source:["LESSON","CONSULT","PACK5","PACK10","PACK20"].includes(product_code)?"academy_standard_20261113":"academy_programmes_20261105",privacy_acknowledged:true,adult_or_guardian_confirmed:true,
  idempotency_key
 }).select("id").single();
 if(error){if(error.code==="23505")return reply({ok:true,status:"RECEIVED_UNCONFIRMED",confirmed:false,duplicate:true,bookingConfirmed:false},200,origin);console.error("insert_failed",error.code);return reply({error:"temporarily_unavailable"},503,origin);}
 if(!data?.id)return reply({error:"temporarily_unavailable"},503,origin);
 return reply({ok:true,status:"RECEIVED_UNCONFIRMED",confirmed:false,reference:data.id,bookingConfirmed:false,paymentCollected:false},200,origin);
});
