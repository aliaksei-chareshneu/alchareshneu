'use strict';
/**
 * IMPERION B2B prospect monitor - public EU TED procurement notices only.
 * No CRM mutations, private data, outbound contacts, LLM calls, spending, or publications.
 * Requires a separate Gmail/SENT/CRM/opt-out check before any application or message.
 */
const fs = require('node:fs');
const path = require('node:path');

const API = 'https://api.ted.europa.eu/v3/notices/search';
const DOCS = 'https://docs.ted.europa.eu/api/latest/search.html';
const FIELDS = Object.freeze([
  'publication-number', 'publication-date', 'notice-title', 'buyer-name',
  'buyer-country', 'classification-cpv', 'form-type',
  'deadline-receipt-tender-date-lot', 'total-value', 'total-value-cur'
]);
const HEADERS = Object.freeze([
  'Opportunity_ID', 'Found_At', 'Platform', 'Working_Title_From_URL',
  'Direct_Job_URL', 'Evidence_Category_URL', 'Focus', 'Fit_Score_Heuristic',
  'Status', 'Application_Route', 'Budget_Verified', 'Existing_Contact',
  'Next_Action', 'Owner', 'Evidence_Classification'
]);
const DEFAULT_LANES = Object.freeze([
  {id:'CZ_IT_DATA', country:'buyer-country=CZE', cpv:'classification-cpv=72*', focus:'AI_DATA_PYTHON'},
  {id:'CZ_RESEARCH', country:'buyer-country=CZE', cpv:'classification-cpv=73*', focus:'RESEARCH'},
  {id:'CZ_TRAINING', country:'buyer-country=CZE', cpv:'classification-cpv=805*', focus:'CORPORATE_TRAINING'},
  {id:'NEIGHBOUR_IT_DATA', country:'buyer-country IN (AUT DEU POL SVK)', cpv:'classification-cpv=72*', focus:'AI_DATA_PYTHON'}
]);
// Require a concrete match in the buyer-written scope, not in TED's broad CPV label.
const SUBJECT_MATCH = Object.freeze({
  AI_DATA_PYTHON: /(?:python|machine learning|artificial intelligence|\bai\b|automatiz|automatis|automation|anal[yý]z|analyse|data analytics|datov[ýaée]|open data|bpmn|process[ -]modell|procesn[íi]|workflow|digitaliz|digitalis|digit[aá]ln[íi]|web[ -]plat|webov[áé]? aplik|software development|softwarov[ée] [řr]e[sš]en|custom software|port[aá]l|information system|informa[čc]n[íi] syst[eé]m|vývoj software|entwicklung einer web)/iu,
  RESEARCH: /(?:v[ýy]zkum|research|experiment[aá]ln|applied science|vývoj|forschung|wissenschaft|r&d)/iu,
  CORPORATE_TRAINING: /(?:anglick[ée]ho jazyk|english[ -]language|business english|python|um[eě]l[aá] inteligence|artificial intelligence|digital|digit[aá]ln|data analys|anal[yý]za dat|programov[aá]n|automatiz|automatis|information technolog|it training|corporate training|management training)/iu
});
const HARD_EXCLUSIONS = /(?:without digital skills|non-digital|bez digit[aá]ln[ií]ch dovednost[ií]|\bcisco\b|\bcheck point\b|\boracle css\b|\bsap sybase\b|maintenance k produkt|software maintenance|p[řr]edplatn[eé]ho bezpe[čc]nost|klimatizac|v[ýy]m[eě]n[ií]k[ůu]|po[žz][aá]rn[ií] ochran|po[řr]adatelsk[eé] slu[žz]b|serverov[eé]|\bsan\b|\braid\b|\biaas\b|datacent(?:er|re)|data center|kolokac|cloud hosting|z[aá]lohov[aá]n[ií] dat|firewall|tender for hardware|network equipment|s[ií]ťov[ée] bezpe[čc]nost|hardware|new passenger coaches|railway coaches|tramvaj[ií]|dod[aá]vka server|printer|diskov[aá] pole|licenc[ei]|subskripc)/iu;

function text(value, max=300) {
  if (typeof value === 'string') return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
  if (Array.isArray(value)) return text(value.find(v => text(v, max)) ?? '',max);
  if (value && typeof value === 'object') {
    for (const key of ['eng','en','cze','ces','deu','ger','fra','pol','slk',...Object.keys(value)]) {
      if (Object.hasOwn(value,key)) {
        const candidate=text(value[key],max);
        if(candidate) return candidate;
      }
    }
  }
  return '';
}
function day(value) {
  const v=text(value,60);
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d=v.slice(0,10);
  return Number.isFinite(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d ? d : null;
}
function earliestDeadline(v) {
  const found=[];
  const visit=(x,depth=0)=>{
    if(depth>5 || found.length>30) return;
    if(typeof x==='string') {const d=day(x);if(d)found.push(d);}
    else if(Array.isArray(x)) x.slice(0,30).forEach(y=>visit(y,depth+1));
    else if(x && typeof x==='object') Object.values(x).slice(0,30).forEach(y=>visit(y,depth+1));
  };
  visit(v);return found.sort()[0]||null;
}
function yyyyMMdd(date) {return new Date(date).toISOString().slice(0,10).replaceAll('-','');}
function payloads(now=new Date(), days=21) {
  if(!Number.isFinite(now.getTime()) || !Number.isInteger(days) || days<1 || days>90)throw Error('BAD_WINDOW');
  const since=new Date(now.getTime()-days*86400000);
  return DEFAULT_LANES.map(l=>({
    lane:l.id,focus:l.focus,request:{
      query:`publication-date>=${yyyyMMdd(since)} AND form-type=competition AND ${l.country} AND ${l.cpv} SORT BY publication-date DESC`,
      fields:[...FIELDS],limit:40,page:1,scope:'ACTIVE',paginationMode:'PAGE_NUMBER',checkQuerySyntax:false
    }
  }));
}
function normalize(n,lane,now=new Date()) {
  if(!n || typeof n!=='object' || Array.isArray(n))return null;
  const num=text(n['publication-number'],35);
  if(!/^\d{1,8}-20\d{2}$/.test(num))return null;
  const title=text(n['notice-title'],220),buyer=text(n['buyer-name'],140);
  const published=day(n['publication-date']);
  if(!title || !buyer || !published)return null;
  const minDate=new Date(now.getTime()-32*86400000).toISOString().slice(0,10);
  if(published<minDate || published>new Date(now.getTime()+86400000).toISOString().slice(0,10))return null;
  const deadline=earliestDeadline(n['deadline-receipt-tender-date-lot']);
  if(deadline && deadline<now.toISOString().slice(0,10))return null;
  const cpv=text(n['classification-cpv'],100),country=text(n['buyer-country'],10);
  const parts=title.split(' – ');
  const buyerScope=parts.length>=3?parts.slice(2).join(' – '):title;
  // A broad CPV category match is NOT a consulting job. Require buyer scope fit.
  if(HARD_EXCLUSIONS.test(buyerScope) || !SUBJECT_MATCH[lane.focus]?.test(buyerScope))return null;
  const focus=lane.focus;
  const score=Math.min(90,40+(country==='CZE'?12:0)+20+(deadline?6:0)+
    (/(?:python|automatiz|automatis|automation|anal[yý]z|bpmn|open data|anglick[ée]ho jazyk|english language)/iu.test(buyerScope)?8:0));
  const url='https://ted.europa.eu/en/notice/-/detail/'+num;
  const reason=`OFFICIAL_TED_INDEX; published=${published}; buyer=${buyer}; buyer_country=${country||'NOT_VERIFIED'}; deadline=${deadline||'NOT_VERIFIED'}; CPV=${cpv||'NOT_VERIFIED'}; scope=ACTIVE; buyer-written scope matched conservatively; eligibility, subcontracting, budget for this consultant and tender status require independent notice review. No contact permission, application, contract or payment confirmed.`;
  return {id:'TED:'+num,publication_number:num,publication_date:published,buyer_name:buyer,
    title,source_url:url,source:'TED_API_V3',focus,fit_score:score,
    deadline:deadline||null, country:country||null, evidence_classification:reason,
    classification:'PUBLIC_NOTICE_UNVERIFIED_SALES_FIT',status:'INDEXED_NEEDS_LIVE_CHECK',
    crm_contact_history:'NOT_CHECKED', budget_verified:'NOT_VERIFIED',
    owner_entity:'OSVC',sent:false,paid:false};
}
function uniqueAndNew(groups,prior={},now=new Date()) {
  if(!Array.isArray(groups) || groups.some(g=>!Array.isArray(g.notices)))throw Error('INVALID_SOURCE_GROUPS');
  const seen=new Map();
  const excluded=new Set(Array.isArray(prior?.seen)?prior.seen.filter(v=>typeof v==='string'):[]);
  for(const g of groups){
    if(!g.lane || !Array.isArray(g.notices) || g.notices.length>50)throw Error('INVALID_API_RESULT');
    for(const raw of g.notices){
      const candidate=normalize(raw,g.lane,now);
      if(candidate && (!seen.has(candidate.id) || seen.get(candidate.id).fit_score<candidate.fit_score))seen.set(candidate.id,candidate);
    }
  }
  const all=[...seen.values()].sort((a,b)=>b.fit_score-a.fit_score || b.publication_date.localeCompare(a.publication_date) || a.id.localeCompare(b.id));
  const fresh=all.filter(c=>!excluded.has(c.id));
  // Only PUBLIC source IDs; cache never contains contact names or PII.
  const nextIds=[...new Set([...excluded,...all.map(c=>c.id)])].slice(-6000);
  return {all,fresh,state:{schema:'imperion-b2b-public-source-ids-v1',seen:nextIds},seen_before:all.length-fresh.length};
}
function rowForCRM(x,foundDate) {
  return [x.id.replace(':','-'),foundDate,'TED',x.title,x.source_url,DOCS,
    x.focus,x.fit_score,x.status,'OFFICIAL_TENDER_PORTAL_ONLY',x.budget_verified,
    'NOT_CHECKED_GMAIL_CRM_OPT_OUT',
    `Verify original notice, lots, deadline, legal ability to bid/subcontract, buyer/terms/budget, prior Gmail/SENT and CRM. Apply via official procurement route only if genuinely eligible.`,
    'Aliaksei',x.evidence_classification];
}
function csvCell(v) {
  let s=String(v??'');
  if(/^[\s]*[=+@-]/.test(s))s="'"+s; // prevent formula execution during spreadsheet import
  return '"'+s.replaceAll('"','""')+'"';
}
function buildFiles(result,now=new Date(),testMode=false) {
  const foundDate=now.toISOString().slice(0,10), rows=result.fresh.map(x=>rowForCRM(x,foundDate));
  const csv=[HEADERS,...rows].map(r=>r.map(csvCell).join(',')).join('\n')+'\n';
  const summary={schema:'imperion-b2b-review-v1',as_of:now.toISOString(),
    execution_status:testMode?'SIMULATED_TEST_FIXTURE':'PUBLIC_API_INDEX_ONLY',
    source:'EU_TED_V3',queries:DEFAULT_LANES.map(x=>x.id),
    visible_source_records:result.all.length,new_to_public_id_cache:result.fresh.length,
    already_in_public_id_cache:result.seen_before,
    crm_deduplicated:false,history_checked:false,qualified_buyers:0,applications_sent:0,
    contracts_verified:0,payments_bank_verified:0,owner_review_required:true,
    candidates:result.fresh};
  const lines=[
    '# IMPERION / B2B public-request review',
    '',`Generated: ${now.toISOString()}`,
    testMode?'**SYNTHETIC TEST. No real prospects.**':'**Official API index only; not verified opportunities, clients or permission to contact.**',
    '',`Notices returned and accepted by heuristic: ${result.all.length}. New public IDs: ${result.fresh.length}.`,
    `CRM/Gmail/opt-out checks: NOT PERFORMED. Applications: 0. Payments: 0.`,
    '', '| Score (heuristic) | Buyer | Published | Notice | Deadline |',
    '|---:|---|---|---|---|',
    ...result.fresh.slice(0,20).map(x=>`| ${x.fit_score} | ${x.buyer_name.replaceAll('|','/')} | ${x.publication_date} | [${x.title.replaceAll('|','/').replaceAll(']','')} ](${x.source_url}) | ${x.deadline??'NOT VERIFIED'} |`),
    '',`Next: check official notice + buyer eligibility, then existing Gmail/SENT and CRM; only use legal tender/application path. Do not send marketing emails.`
  ];
  return {csv,summary,markdown:lines.join('\n')+'\n'};
}
async function requestOne(payload,fetcher=fetch) {
  const response=await fetcher(API,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`TED_HTTP_${response.status}`);
  const length=Number(response.headers.get('content-length')||0);
  if(length>1_500_000)throw Error('TED_RESPONSE_TOO_LARGE');
  const raw=await response.text();
  if(raw.length>1_500_000)throw Error('TED_RESPONSE_TOO_LARGE');
  const doc=JSON.parse(raw);
  if(!doc || !Array.isArray(doc.notices) || doc.notices.length>50)throw Error('TED_SCHEMA_MISMATCH');
  return doc.notices;
}
function argValue(argv,key,def) {const i=argv.indexOf(key);return i<0?def:argv[i+1];}
async function main(argv=process.argv.slice(2)) {
  const now=new Date(argValue(argv,'--now',new Date().toISOString()));
  if(!Number.isFinite(now.getTime()))throw Error('INVALID_NOW');
  const out=path.resolve(argValue(argv,'--out',path.join(process.cwd(),'.private-b2b-review')));
  const stateFile=path.resolve(argValue(argv,'--state',path.join(process.cwd(),'.cache/b2b-ted-state.json')));
  const fixture=argValue(argv,'--fixture',null);
  let groups;
  if(fixture) {
    groups=JSON.parse(fs.readFileSync(fixture,'utf8')).groups;
  } else {
    groups=[];
    for(const p of payloads(now))groups.push({lane:DEFAULT_LANES.find(l=>l.id===p.lane),notices:await requestOne(p.request)});
  }
  const prior=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};
  if(prior.schema && prior.schema!=='imperion-b2b-public-source-ids-v1')throw Error('STATE_SCHEMA_MISMATCH');
  const result=uniqueAndNew(groups,prior,now),files=buildFiles(result,now,Boolean(fixture));
  // Never persist synthetic records to the real source ID cache.
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'candidates.json'),JSON.stringify(files.summary,null,2)+'\n');
  fs.writeFileSync(path.join(out,'crm_review_import.csv'),files.csv);
  fs.writeFileSync(path.join(out,'review.md'),files.markdown);
  if(!fixture){fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(result.state,null,2)+'\n');}
  console.log(JSON.stringify({status:fixture?'SYNTHETIC_TEST_ONLY':'SOURCE_SCAN_COMPLETE',notices:result.all.length,new_candidates:result.fresh.length,
    crm_sync:'NOT_PERFORMED',messages_sent:0,contracts:0,payments:0}));
  return files.summary;
}
if(require.main===module)main().catch(error=>{console.error('B2B_SCAN_BLOCKED: '+error.message);process.exitCode=1;});
module.exports={API,DOCS,FIELDS,HEADERS,DEFAULT_LANES,text,day,earliestDeadline,payloads,normalize,uniqueAndNew,rowForCRM,csvCell,buildFiles,requestOne,main};
