/**
 * Optional, read-only public TED API field probe. No secrets, customer data,
 * persistence, CRM, publication, application, costs or outbound contact.
 * Run explicitly in draft-PR QA; never use as a production delivery receipt.
 */
import {tedRequest,parseTedResponse,closingDate} from '../supabase/functions/imperion-deal-hunter/core.mjs';

const url='https://api.ted.europa.eu/v3/notices/search';
const payload={...tedRequest('72000000'),limit:20};
const response=await fetch(url,{
  method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(20000),redirect:'error'
});
const text=await response.text();
if(!response.ok||response.redirected)throw Error('TED_LIVE_HTTP_'+response.status+' '+text.slice(0,200));
if(text.length>1800000)throw Error('TED_LIVE_OVERSIZE');
const body=JSON.parse(text);
if(!Array.isArray(body.notices)||body.notices.length>20||body.notices.length===0)
  throw Error('TED_LIVE_RESPONSE_INVALID_OR_EMPTY');
const now=new Date();
const examined=body.notices.map(n=>({
  publication_number:String(n['publication-number']||'').slice(0,26),
  closing_source:closingDate(n,now).source,
  closing_date:closingDate(n,now).date,
  present_fields:['deadline-receipt-tender-date-lot','deadline-receipt-request-date-lot','deadline']
    .filter(k=>Object.hasOwn(n,k))
}));
const parsed=parseTedResponse(body,'IT',now);
const verifiedIndex=examined.filter(x=>x.closing_source!=='NOT_VERIFIED');
console.log(JSON.stringify({
  status:'PUBLIC_TED_SOURCE_READBACK',
  request_fields:payload.fields,
  received:body.notices.length,
  explicit_date_fields_in_raw_notices:verifiedIndex.length,
  parsed_candidates:parsed.items.length,
  parsed_candidates_with_date:parsed.items.filter(x=>x.deadline_on).length,
  sample:examined.slice(0,10),
  owner_approval_required:true,
  submissions:0,messages:0,payments:0
}));
if(!verifiedIndex.length)throw Error('TED_LOT_DEADLINES_NOT_OBSERVED__HOLD_PRODUCTION');
