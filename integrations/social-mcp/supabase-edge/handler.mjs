/**
 * Imperion Social MCP: isolated READ-ONLY remote smoke-test adapter.
 * No credentials, customer records, Telegram calls, WhatsApp sends or CRM writes.
 * This staged endpoint must never acquire publish tools or secrets without a new
 * independent authorization/security review of the production bridge.
 */
const PROTOCOL = '2025-11-25';
const TOOLSET = Object.freeze([
  {
    name: 'publication_status',
    description: 'Read-only deployment status. No access to CRM or posting credentials.',
    inputSchema: {type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:false}
  },
  {
    name: 'whatsapp_group_capabilities',
    description: 'Read-only official WhatsApp group publishing capability summary. No message sending.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,openWorldHint:false}
  }
]);
const reply=(id,result)=>({jsonrpc:'2.0',id,result});
const error=(id,code,message)=>({jsonrpc:'2.0',id:id??null,error:{code,message}});
const toolResult=(x)=>({content:[{type:'text',text:JSON.stringify(x)}]});
function jsonResponse(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function rpcHandler(body){
  if(!body || Array.isArray(body) || typeof body!=='object' || body.jsonrpc!=='2.0')return error(null,-32600,'Invalid Request');
  const {id,method,params={}}=body;
  if(id===undefined)return null;
  if(method==='initialize')return reply(id,{protocolVersion:PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:{name:'imperion-social-mcp-stage',version:'0.1.0'}});
  if(method==='ping')return reply(id,{});
  if(method==='tools/list')return reply(id,{tools:TOOLSET});
  if(method==='tools/call'){
    if(!params || typeof params.name!=='string')return error(id,-32602,'Invalid params');
    if(params.name==='publication_status')return reply(id,toolResult({ok:true,mode:'READ_ONLY_STAGING',provider:'Supabase Edge',telegramPublishing:false,whatsappPublishing:false,crmAccess:false,canonicalQueue:'existing SocialPublishing',networkCalls:0}));
    if(params.name==='whatsapp_group_capabilities')return reply(id,toolResult({ok:true,officialCloudApiForOrdinaryPersonalGroups:false,manualShareOnly:true,automaticPosts:0,doNotTreatPreviewAsSent:true}));
    return error(id,-32601,'Tool unavailable in staging');
  }
  return error(id,-32601,'Method not found');
}
export async function handleStageRequest(req){
  const u=new URL(req.url);
  if(u.pathname.endsWith('/health') && req.method==='GET') return jsonResponse({ok:true,service:'imperion-social-mcp-stage',mode:'READ_ONLY_STAGING',publishing:false});
  if(req.method!=='POST')return jsonResponse({ok:false,code:'method_not_allowed'},405);
  const mime=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(mime!=='application/json')return jsonResponse({ok:false,code:'json_required'},415);
  const contentLength=Number(req.headers.get('content-length')||0);
  if(contentLength>65536)return jsonResponse({ok:false,code:'request_too_large'},413);
  let raw;
  try{raw=await req.text();}catch{return jsonResponse(error(null,-32700,'Read error'),400);}
  if(raw.length>65536)return jsonResponse({ok:false,code:'request_too_large'},413);
  let parsed;
  try{parsed=JSON.parse(raw);}catch{return jsonResponse(error(null,-32700,'Parse error'),400);}
  const result=await rpcHandler(parsed);
  if(result===null)return new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});
  return jsonResponse(result);
}
