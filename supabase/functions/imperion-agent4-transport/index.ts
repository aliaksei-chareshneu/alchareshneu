import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";

/**
 * Private, zero-PII transport for EXISTING OCI Agent4 -> EXISTING GAS importer.
 * Not a CRM, not a bot, not a publisher; no customer sends or third-party LLM.
 * Service-role key remains in Supabase secrets. Public bearer rejected by default.
 */
const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "";
const PROJECT_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HDR = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const sourcePattern = /^IMP4-TG-[0-9a-f]{24}$/;
const caseOsPattern = /^LEAD-AG4-[0-9a-f]{24}$/;
const caseNgPattern = /^DM-[0-9]{3,6}$/;
type Controller="OSVC"|"DRUZINA_MORAVY_ZS";
function reply(obj:Record<string,unknown>, status=200){
 return new Response(JSON.stringify(obj),{status,headers:HDR});
}
function validSource(value:unknown):value is string {
 return typeof value==="string"&&sourcePattern.test(value);
}
function validEntity(x:unknown):x is Controller{
 return x==="OSVC"||x==="DRUZINA_MORAVY_ZS";
}
function validCase(k:string,entity:Controller,c:string){
 return entity==="OSVC"?caseOsPattern.test(c)&&c.slice("LEAD-AG4-".length)===k.slice("IMP4-TG-".length):
 caseNgPattern.test(c);
}
async function digestToken(v:string){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function sourceRecord(x:unknown){
 if(!x||typeof x!=="object"||Array.isArray(x))return null;
 const d=x as Record<string,unknown>;
 const allowed=["source_key","source","legal_entity","local_job_id","inbound_at",
  "stage","identity_match","crm_person_id","provider_send_status","privacy","owner_selftest"];
 if(Object.keys(d).some(k=>!allowed.includes(k)))return null;
 if(!validSource(d.source_key)||d.source!=="telegram-agent4"||!validEntity(d.legal_entity)||
  !Number.isSafeInteger(d.local_job_id)||(d.local_job_id as number)<1||
  (d.local_job_id as number)>1000000000||d.stage!=="INBOUND_UNQUALIFIED"||
  d.identity_match!=="NOT_VERIFIED"||d.crm_person_id!==null||d.owner_selftest!==false||
  d.privacy!=="NO_MESSAGE_TEXT_NO_PHONE_NO_NAME"||
  !["NO_CONFIRMED_SEND","API_ACCEPTED_NOT_DELIVERY"].includes(String(d.provider_send_status)))
  return null;
 if(typeof d.inbound_at!=="string"||d.inbound_at.length>35)return null;
 const timestamp=Date.parse(d.inbound_at.endsWith("Z")||/[+-]\d\d:\d\d$/.test(d.inbound_at)?
  d.inbound_at:d.inbound_at.replace(" ","T")+"Z");
 if(!Number.isFinite(timestamp)||timestamp>Date.now()+300000||
     timestamp<Date.now()-90*86400000)return null;
 return {source_key:d.source_key as string,legal_entity:d.legal_entity as Controller,
  local_job_id:d.local_job_id as number,inbound_at:new Date(timestamp).toISOString(),
  provider_send_status:d.provider_send_status as string};
}
Deno.serve(async(req)=>{
 try{
  if(!["GET","POST"].includes(req.method))return reply({error:"method_not_allowed"},405);
  if(!PROJECT_URL||!PROJECT_KEY)return reply({error:"service_not_configured"},503);
  const auth=req.headers.get("authorization")||"";
  const bearer=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!/^[0-9a-f]{64}$/i.test(bearer))return reply({error:"unauthorized"},401);
  const api=createClient(PROJECT_URL,PROJECT_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const hash=await digestToken(bearer);
  const key=await api.from("imperion_agent4_transport_auth")
    .select("token_sha256").eq("token_sha256",hash).eq("role","WINDOWS_AGENT4").eq("active",true).maybeSingle();
  let role:keyof {WINDOWS:true;GAS:true}|null=key.data&&!key.error?"WINDOWS":null;
  if(!role){
   const pass=await api.rpc("verify_imperion_intake_bridge_token",{p_token:bearer});
   if(!pass.error&&pass.data===true)role="GAS";
  }
  if(!role)return reply({error:"unauthorized"},401);
  const url=new URL(req.url);
  const table=api.from("imperion_agent4_transport");
  if(req.method==="GET"){
    if(role!=="WINDOWS")return reply({error:"forbidden"},403);
    const source=url.searchParams.get("source_key");
    if(!validSource(source))return reply({error:"invalid_source"},400);
    const record=await table.select("source_key,legal_entity,crm_case_id,crm_synced_at")
      .eq("source_key",source).maybeSingle();
    if(record.error)return reply({error:"source_unavailable"},503);
    if(!record.data)return reply({ok:true,status:"MISSING",source_key:source});
    return reply({ok:true,status:record.data.crm_synced_at?"SYNCED":"STAGED",
      source_key:source,legal_entity:record.data.legal_entity,
      case_id:record.data.crm_synced_at?record.data.crm_case_id:null});
  }
  const bodyLength=Number(req.headers.get("content-length")||"0");
  if(bodyLength>4096)return reply({error:"body_too_large"},413);
  const raw=await req.text();
  if(raw.length>4096)return reply({error:"body_too_large"},413);
  let body:Record<string,unknown>;
  try{const b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=="object")throw Error("bad");body=b;}
  catch{return reply({error:"invalid_json"},400);}
  if(role==="WINDOWS"){
    if(body.action!=="submit"||Object.keys(body).some(x=>!["action","data"].includes(x)))
      return reply({error:"forbidden_action"},403);
    const row=sourceRecord(body.data);
    if(!row)return reply({error:"untrusted_source_metadata"},400);
    const saved=await table.insert(row).select("source_key").maybeSingle();
    if(saved.error&&saved.error.code!=="23505")return reply({error:"source_stage_failed"},503);
    const check=await table.select("source_key,legal_entity,local_job_id,inbound_at,provider_send_status,crm_synced_at")
       .eq("source_key",row.source_key).maybeSingle();
    if(check.error||!check.data)return reply({error:"source_readback_failed"},503);
    if(check.data.legal_entity!==row.legal_entity||check.data.local_job_id!==row.local_job_id||
      check.data.provider_send_status!==row.provider_send_status||
      Date.parse(check.data.inbound_at)!==Date.parse(row.inbound_at))
      return reply({error:"source_id_collides"},409);
    return reply({ok:true,status:check.data.crm_synced_at?"SYNCED":saved.error?"ALREADY_STAGED":"STAGED",
      source_key:row.source_key});
  }
  if(role!=="GAS")return reply({error:"forbidden"},403);
  if(body.action==="pull"&&Object.keys(body).length===1){
    const q=await table.select("source_key,legal_entity,local_job_id,inbound_at,provider_send_status")
      .is("crm_synced_at",null).order("created_at",{ascending:true}).limit(10);
    if(q.error)return reply({error:"private_pull_failed"},503);
    const rows=(q.data||[]).map((row)=>({
      source_key:row.source_key,legal_entity:row.legal_entity,
      source:"telegram-agent4",local_job_id:row.local_job_id,inbound_at:row.inbound_at,
      stage:"INBOUND_UNQUALIFIED",identity_match:"NOT_VERIFIED",
      crm_person_id:null,provider_send_status:row.provider_send_status,
      privacy:"NO_MESSAGE_TEXT_NO_PHONE_NO_NAME",owner_selftest:false
    }));
    return reply({ok:true,protocol:"imperion-agent4-transport-v1",rows});
  }
  if(body.action==="ack"&&Object.keys(body).every(x=>["action","source_key","legal_entity","case_id"].includes(x))
    &&Object.keys(body).length===4){
    const source=body.source_key,entity=body.legal_entity,c=body.case_id;
    if(!validSource(source)||!validEntity(entity)||typeof c!=="string"||
      !validCase(source,entity,c))return reply({error:"invalid_remote_receipt"},400);
    const current=await table.select("source_key,legal_entity,crm_case_id,crm_synced_at")
       .eq("source_key",source).maybeSingle();
    if(current.error||!current.data||current.data.legal_entity!==entity)
      return reply({error:"source_not_found"},404);
    if(current.data.crm_synced_at){
      if(current.data.crm_case_id!==c)return reply({error:"conflicting_receipt"},409);
      return reply({ok:true,status:"ACK_ALREADY_VERIFIED",source_key:source,case_id:c});
    }
    const updated=await table.update({crm_case_id:c,crm_synced_at:new Date().toISOString()})
      .eq("source_key",source).eq("legal_entity",entity).is("crm_synced_at",null)
      .select("source_key,crm_case_id,crm_synced_at").maybeSingle();
    if(updated.error||!updated.data||updated.data.crm_case_id!==c||!updated.data.crm_synced_at)
      return reply({error:"remote_ack_readback_required"},503);
    return reply({ok:true,status:"REMOTE_CRM_ACK_VERIFIED",source_key:source,case_id:c});
  }
  return reply({error:"forbidden_action"},403);
 }catch(_){return reply({error:"private_transport_unavailable"},503);}
});
