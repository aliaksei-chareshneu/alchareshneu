import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";

// Read-only public Apps Script feed used by /calendar/. Never accept caller URLs.
const FEED="https://script.google.com/macros/s/AKfycbzKdIEwIF4gH9Cku3IQPC8uTrvR1CtHjMAOIzexrR3Mz9nDSLQ1znfT8Y2SS873jCtsLg/exec";
const CALLBACK="imperionCatalogSync";
const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const trim=(v:unknown,max:number):string=>String(v??"").trim().slice(0,max);
const errMessage=(error:unknown)=>error instanceof Error?trim(error.message,130):"unknown failure";

Deno.serve(async(req:Request):Promise<Response>=>{
  if(req.method!=="POST")return send({error:"method_not_allowed"},405);
  const token=req.headers.get("x-cron-token")||"";
  if(token.length<24 || token.length>250)return send({error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return send({error:"server_misconfigured"},503);
  const api=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:valid,error:authError}=await api.rpc("verify_operator_cron_token",{p_token:token});
  if(authError||valid!==true)return send({error:"forbidden"},403);

  try{
    const response=await fetch(FEED+"?callback="+encodeURIComponent(CALLBACK),{
      method:"GET",redirect:"follow",
      headers:{"Accept":"application/javascript, text/javascript, text/plain"},
      signal:AbortSignal.timeout(22000),
    });
    if(!response.ok)throw new Error("public feed unavailable: HTTP "+response.status);
    const raw=await response.text();
    if(raw.length>320000)throw new Error("public feed payload too large");
    const prefix=CALLBACK+"(";
    const body=raw.trim();
    if(!body.startsWith(prefix)||!body.endsWith(");"))throw new Error("public feed format mismatch");
    const data=JSON.parse(body.slice(prefix.length,-2));
    if(!data||!Array.isArray(data.events)||data.events.length>120)
      throw new Error("public feed event list invalid");
    const generatedAt=new Date(data.generatedAt);
    if(!Number.isFinite(generatedAt.getTime())||
       generatedAt.getTime()<Date.now()-36*3600000||generatedAt.getTime()>Date.now()+3600000)
       throw new Error("public feed timestamp stale");
    const ids=new Set<string>();
    const events=data.events.map((ev:any)=>{
      if(!ev||typeof ev!=="object"||Array.isArray(ev))throw new Error("invalid event");
      const id=trim(ev.id,100);
      if(!/^PUB-[A-Z0-9-]{4,90}$/.test(id)||ids.has(id))throw new Error("duplicate or unsupported event id");
      ids.add(id);
      const title=trim(ev.title,180),community=trim(ev.community,100),
            category=trim(ev.category,100),
            venue=trim(ev.locationName,300);
      const begin=new Date(ev.startISO);
      if(title.length<3||community.length<3||category.length<2||venue.length<3||
        !Number.isFinite(begin.getTime()))
        throw new Error("invalid event metadata");
      const priceKnown=Number.isInteger(ev.priceCzk)&&ev.priceCzk>=0&&ev.priceCzk<=999999;
      const price=priceKnown?ev.priceCzk:0;
      return {event_id:id,title,community,category,
              begins_at:begin.toISOString(),venue,price_czk:price,
              price_verified:priceKnown,
              contact_activity:/hema|fencing|archery|battle|larp|combat|quest|children/i.test(category)};
    });
    // Transactional, idempotent, service-role-only SQL RPC. Never auto-open paid registrations.
    const {data:result,error}=await api.rpc("imperion_catalog_apply_feed",{
      p_events:events,p_generated_at:generatedAt.toISOString()
    });
    if(error)throw new Error("catalog apply failed: "+trim(error.code||error.message,100));
    console.log("imperion-catalog-sync",JSON.stringify(result));
    return send(result);
  }catch(e){
    const message=errMessage(e);
    // Errors are operational only. No attendee records, contacts or secrets in this table.
    const {error}=await api.from("imperion_catalog_sync_state")
      .update({last_error_at:new Date().toISOString(),last_error:message,updated_at:new Date().toISOString()})
      .eq("id",1);
    if(error)console.error("catalog sync error log failed",error.code);
    console.error("imperion catalog sync failed",message);
    return send({ok:false,error:"catalog_sync_unavailable"},503);
  }
});
