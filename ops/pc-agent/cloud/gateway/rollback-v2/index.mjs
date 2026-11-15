// Cloud adapter only; existing Hub, n8n, Supabase tables and 5-agent operator stay canonical.
// No scheduler, new CRM, browser, payment, email or publishing capability.
import {generateFreeDraft} from "./free-core.mjs";
const json=(status,data)=>new Response(JSON.stringify(data),{status,
  headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff"}});
const equals=(a,b)=>{
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
};
Deno.serve(async request=>{
  if(request.method!=="POST")return json(405,{status:"METHOD_NOT_ALLOWED"});
  // Supabase service-role key is already held only by trusted server-side workflows.
  // Gateway JWT is also verified by Supabase (verify_jwt=true).
  const serverKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth=request.headers.get("authorization");
  if(!serverKey||!equals(auth,"Bearer "+serverKey))return json(401,{status:"UNAUTHORIZED"});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))
    return json(415,{status:"JSON_REQUIRED"});
  const raw=await request.text();
  if(raw.length>9000)return json(413,{status:"PAYLOAD_TOO_LARGE"});
  let input;try{input=JSON.parse(raw)}catch(_){return json(400,{status:"INVALID_JSON"})}
  // Explicit free-plan acknowledgements and provider keys are OFF by default.
  // No keys are included in response, code, logs, GitHub or model prompts.
  const names=["GROQ_API_KEY","IMPERION_GROQ_FREE_VERIFIED","OPENROUTER_API_KEY",
    "IMPERION_OPENROUTER_FREE_VERIFIED","OPENROUTER_FREE_MODEL"];
  const env=Object.fromEntries(names.map(name=>[name,Deno.env.get(name)||""]));
  const result=await generateFreeDraft(input,env);
  return json(result.status==="DRAFT_ONLY"?200:result.status.startsWith("BLOCKED")?423:503,result);
});
