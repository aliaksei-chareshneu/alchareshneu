import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";

/**
 * Privileged, pull-only Google Apps Script intake bridge.
 * Credentials live in Supabase Vault and Google Script Properties, NEVER in
 * public registration pages, source control or a spreadsheet cell.
 */
const S_URL=Deno.env.get("SUPABASE_URL")||"";
const S_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const HEADER={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
function reply(value:unknown,status=200):Response{
  return new Response(JSON.stringify(value),{status,headers:HEADER});
}
function validIds(input:unknown):string[]|null{
  if(!Array.isArray(input)||input.length>100)return null;
  const ids=input.map(v=>typeof v==="string"?v:"");
  if(ids.some(id=>!/^[-0-9a-f]{36}$/i.test(id)))return null;
  return Array.from(new Set(ids));
}
Deno.serve(async (req:Request):Promise<Response>=>{
  if(!["GET","POST"].includes(req.method))return reply({error:"method_not_allowed"},405);
  if(!S_URL||!S_KEY)return reply({error:"server_configuration"},503);
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")||auth.length!==71)return reply({error:"unauthorized"},401);
  const key=auth.slice(7);
  if(!/^[0-9a-f]{64}$/i.test(key))return reply({error:"unauthorized"},401);
  const api=createClient(S_URL,S_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await api.rpc("verify_imperion_intake_bridge_token",{p_token:key});
  if(verified.error||verified.data!==true)return reply({error:"forbidden"},403);

  try{
    if(req.method==="GET"){
      const [rsvp,enquiry]=await Promise.all([
        api.from("imperion_rsvp_submissions")
          .select("id,event_id,first_name,last_name,email,phone,age_group,guardian_name,guardian_phone,rsvp_status,safety_acknowledged,safety_version,photo_choice,marketing_requested,data_controller,language,source,status,created_at,retention_until")
          .is("crm_synced_at",null).order("created_at",{ascending:true}).limit(40),
        api.from("imperion_rsvp_enquiries")
          .select("id,first_name,last_name,contact,contact_kind,visit_type,preferred_day,preferred_date,adult_confirmed,safety_acknowledged,safety_version,language,data_controller,source,status,created_at,retention_until")
          .is("crm_synced_at",null).order("created_at",{ascending:true}).limit(40),
      ]);
      if(rsvp.error||enquiry.error)throw Error("pending read");
      return reply({
        ok:true,protocol:"imperion-intake-bridge-v1",
        rsvps:rsvp.data||[],enquiries:enquiry.data||[],
        max_per_type:40,read_only:true
      });
    }

    const length=Number(req.headers.get("content-length")||"0");
    if(length>10000)return reply({error:"payload_too_large"},413);
    const payload=await req.json().catch(()=>null);
    const rsvps=validIds(payload?.rsvps),enquiries=validIds(payload?.enquiries);
    if(payload?.action!=="ack"||rsvps===null||enquiries===null)
      return reply({error:"invalid_ack"},400);
    const now=new Date().toISOString();
    let ra=0,ea=0;
    if(rsvps.length){
      const out=await api.from("imperion_rsvp_submissions").update({crm_synced_at:now})
        .in("id",rsvps).is("crm_synced_at",null).select("id");
      if(out.error)throw Error("rsvp ack");
      ra=out.data?.length||0;
    }
    if(enquiries.length){
      const out=await api.from("imperion_rsvp_enquiries").update({crm_synced_at:now})
        .in("id",enquiries).is("crm_synced_at",null).select("id");
      if(out.error)throw Error("enquiry ack");
      ea=out.data?.length||0;
    }
    return reply({ok:true,acked:{rsvps:ra,enquiries:ea},idempotent:true});
  }catch(error){
    console.error("intake_bridge_error",error instanceof Error?error.message:"unknown");
    return reply({error:"intake_unavailable"},503);
  }
});
