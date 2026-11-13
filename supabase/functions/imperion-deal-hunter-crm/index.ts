import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";

/**
 * Private, pull-only candidate -> EXISTING Community Hub bridge.
 * Reuses the already installed Apps Script private intake credential for service authentication,
 * but does not touch/pretend to be the inbound B2B form or trigger applicant receipts.
 * No mail, no contact discovery, no applications, no payments. JWT disabled ONLY because
 * credential is checked via dedicated authenticated service role RPC.
 */
const S_URL=Deno.env.get("SUPABASE_URL")||"";
const S_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const HEADER={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
function reply(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:HEADER});}
function validIds(x:unknown):string[]|null{
 if(!Array.isArray(x)||x.length>15)return null;
 if(x.some(i=>typeof i!=="string"||!/^TED:[0-9]{6,8}-20[0-9]{2}$/.test(i)))return null;
 return [...new Set(x)] as string[];
}
Deno.serve(async(req:Request):Promise<Response>=>{
 if(!["GET","POST"].includes(req.method))return reply({ok:false,error:"method_not_allowed"},405);
 if(!S_URL||!S_KEY)return reply({ok:false,error:"server_config"},503);
 const auth=req.headers.get("authorization")||"";
 if(!/^Bearer [a-f0-9]{64}$/.test(auth))return reply({ok:false,error:"unauthorized"},401);
 const api=createClient(S_URL,S_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const verified=await api.rpc("verify_imperion_intake_bridge_token",{p_token:auth.slice(7)});
 if(verified.error||verified.data!==true)return reply({ok:false,error:"forbidden"},403);
 try{
  if(req.method==="GET"){
   const out=await api.from("imperion_deal_hunter_candidates")
    .select("source_key,title,buyer,source_url,fit_score,published_on,economics_gate,evidence_classification")
    .is("crm_synced_at",null).gte("fit_score",40)
    .order("fit_score",{ascending:false}).order("first_seen_at",{ascending:true}).limit(15);
   if(out.error)throw Error("READ_FAILED");
   return reply({ok:true,source:"TED_OFFICIAL",entity:"OSVC",pending:out.data||[],
      max_pending:15,owner_approval_required:true,application_submitted:false});
  }
  if(Number(req.headers.get("content-length")||0)>3200)return reply({ok:false,error:"oversized"},413);
  const payload=await req.json().catch(()=>null);
  const ids=validIds(payload?.ids);
  if(!payload||payload.action!=="ack"||ids===null)return reply({ok:false,error:"bad_ack"},400);
  if(!ids.length)return reply({ok:true,acked:0});
  const now=new Date().toISOString();
  let acked=0;
  for(const key of ids){
   const result=await api.from("imperion_deal_hunter_candidates")
      .update({crm_synced_at:now,crm_target_id:"OPP-"+key.replace(":","-")})
      .eq("source_key",key).is("crm_synced_at",null).select("source_key");
   if(result.error)throw Error("ACK_FAILED");
   acked+=result.data?.length||0;
  }
  return reply({ok:true,acked,submitted:0,messages_sent:0});
 }catch(error){
  console.error("deal_hunter_crm_bridge",error instanceof Error?error.message:"unknown");
  return reply({ok:false,error:"bridge_unavailable"},503);
 }
});
