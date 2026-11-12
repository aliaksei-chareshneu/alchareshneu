'use strict';
/**
 * IMPERION public-market signal monitor.
 * Research signals are NOT inbound leads, procurement notices, paying customers,
 * market-size estimates, legal advice or validated product ideas.
 * No LLM calls, credentials, emails, form submissions, CRM writes or paid APIs.
 */
const fs=require('node:fs');
const path=require('node:path');

const SOURCES=Object.freeze([
 {id:'DELOITTE_AI_2026',publisher:'Deloitte',url:'https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html',date:null},
 {id:'DELOITTE_HUMAN_2026',publisher:'Deloitte',url:'https://www.deloitte.com/us/en/about/press-room/deloitte-report-winning-organizations-will-build-the-human-advantage.html',date:'2026-03-04'},
 {id:'DELOITTE_AGENT_2026',publisher:'Deloitte',url:'https://www.deloitte.com/us/en/about/press-room/deloitte-survey-examines-ai-readiness-agentic-ai-success.html',date:'2026-08-12'},
 {id:'DELOITTE_SKILLS_2026',publisher:'Deloitte',url:'https://www.deloitte.com/us/en/insights/topics/talent/creating-value-with-skills.html',date:'2026-04-24'},
 {id:'EU_DIGITAL_DECADE_2026',publisher:'European Commission',url:'https://commission.europa.eu/news-and-media/news/state-digital-decade-report-progress-made-gaps-remain-2026-06-17_en',date:'2026-06-17'},
 {id:'EU_CYBER_AI_2026',publisher:'European Commission',url:'https://commission.europa.eu/news-and-media/news/new-eu-plan-address-risks-and-opportunities-advanced-ai-cybersecurity-2026-07-07_en',date:'2026-07-07'}
]);
const LENSES=Object.freeze([
 {id:'AI_VALUE',title:'AI: измеряемая отдача вместо демонстраций',
  term:/\b(?:ai|artificial intelligence)\b/i,
  problem:/\b(?:roi|return|returns|revenue|costs?|profit|financial|value|benefits?|impact)\b/i,
  buyer:'CFO, COO, руководитель трансформации — ГИПОТЕЗА, не проверенный контакт',
  small_offer:'Платная диагностика одного процесса: базовая метрика, эксперимент и прозрачная оценка результатов'},
 {id:'AI_GOVERNANCE',title:'Практика управления рисками внедрения AI',
  term:/\b(?:ai|artificial intelligence)\b/i,
  problem:/\b(?:risk|governance|trust|preparedness|responsib|regulat|compliance|safety)\b/i,
  buyer:'Risk manager / операционный руководитель — ГИПОТЕЗА',
  small_offer:'Практический воркшоп по карте рисков AI и управлению процессом; без юридической сертификации'},
 {id:'WORKFORCE_SKILLS',title:'Практическое обучение персонала применению AI',
  term:/\b(?:ai|artificial intelligence)\b/i,
  problem:/\b(?:workforce|employees?|skills?|training|fluency|staff|talent|capabilit)\b/i,
  buyer:'HR, L&D, директор подразделения — ГИПОТЕЗА',
  small_offer:'Ограниченный по объёму интерактивный корпоративный модуль с проверкой навыка'},
 {id:'AI_RESILIENCE',title:'Сценарный анализ новых бизнес-рисков',
  term:/\b(?:ai|artificial intelligence)\b/i,
  problem:/\b(?:resilien|uncertain|disruption|volatilit|shock|supply chain|geopolitic|opportunit)\b/i,
  buyer:'Операционный директор / стратегический отдел — ГИПОТЕЗА',
  small_offer:'Платная сценарная мастерская с открытыми данными и проверяемыми допущениями'}
]);
function allowedSource(s) {
 const reference=SOURCES.find(x=>x.id===s.id);
 if(!reference||reference.url!==s.url)return false;
 const u=new URL(s.url);
 return u.protocol==='https:' && ['www.deloitte.com','commission.europa.eu'].includes(u.hostname);
}
function visibleText(html) {
 if(typeof html!=='string'||html.length>2500000)throw Error('HTML_INVALID_OR_OVERSIZE');
 const body=html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
 if(!body)throw Error('HTML_BODY_MISSING');
 return body[1]
  .replace(/<(script|style|svg|noscript|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<\/(?:p|li|h[1-6]|section|article|div)>/gi,'. ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&(?:nbsp|amp|quot|apos|lt|gt);/gi,m=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[m.toLowerCase()]||' '))
  .replace(/&#(\d+);/g,(_,n)=>{const k=Number(n);return k>=32&&k<=0x10ffff?String.fromCodePoint(k):' ';})
  .replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,180000);
}
function scanText(text) {
 const sentences=text.split(/(?<=[.!?])\s+/).filter(s=>s.length>=25&&s.length<=1000);
 const found={};
 for(const lens of LENSES) {
  const matches=sentences.filter(s=>lens.term.test(s)&&lens.problem.test(s));
  if(matches.length)found[lens.id]={sentences:matches.length};
 }
 return found;
}
async function readSource(source,fetcher=fetch) {
 if(!allowedSource(source))throw Error('SOURCE_NOT_ALLOWLISTED');
 const response=await fetcher(source.url,{method:'GET',headers:{Accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(response.status!==200)throw Error('SOURCE_HTTP_'+response.status);
 if(response.url && new URL(response.url).hostname!==new URL(source.url).hostname)throw Error('SOURCE_REDIRECT_MISMATCH');
 const typ=response.headers?.get('content-type')||'';
 if(typ && !/text\/html/i.test(typ))throw Error('SOURCE_CONTENT_TYPE');
 const html=await response.text();
 const text=visibleText(html);
 if(text.length<200)throw Error('SOURCE_TEXT_TOO_SHORT');
 return {id:source.id,url:source.url,publisher:source.publisher,date:source.date,
  status:'SOURCE_OK',themes:scanText(text),characters:text.length};
}
function aggregate(results,prior={}) {
 const ok=results.filter(s=>s.status==='SOURCE_OK');
 const old=new Set(Array.isArray(prior.seen)?prior.seen.filter(x=>typeof x==='string'):[]);
 const hypotheses=LENSES.map(lens=>{
  const evidence=ok.filter(s=>Object.hasOwn(s.themes,lens.id))
   .map(s=>({source_id:s.id,publisher:s.publisher,url:s.url,publication_date:s.date,matched_sentences:s.themes[lens.id].sentences}));
  if(!evidence.length)return null;
  const key=lens.id+'|'+evidence.map(x=>x.source_id).sort().join(',');
  return {id:lens.id,evidence_key:key,title:lens.title,sources:evidence,
   target_buyer:lens.buyer,offer_hypothesis:lens.small_offer,
   stage:'RESEARCH_SIGNAL_ONLY',buyer_demand:'NOT_VERIFIED',
   willingness_to_pay:'NOT_VERIFIED',market_size:'NOT_VERIFIED',
   existing_competitors:'NOT_VERIFIED',scope_and_eligibility:'NOT_VERIFIED',
   quote_czk:null,all_owner_hours:null,direct_costs_czk:null,
   economic_gate:'REVIEW_UNCOSTED',minimum_net_czk_per_all_owner_hour:1000,
   outreach_authorized:false,
   validation:'Verify 3 concrete buyers, their current workaround, alternatives, buying authority, paid scope and full-hour economics before any offer.',
   new_evidence_set:!old.has(key)};
 }).filter(Boolean).sort((a,b)=>b.sources.length-a.sources.length||a.id.localeCompare(b.id));
 const next=[...new Set([...old,...hypotheses.map(h=>h.evidence_key)])].slice(-1000);
 return {status:ok.length===results.length?'SOURCE_OK':ok.length?'SOURCE_PARTIAL':'SOURCE_FAILED',
  source_total:results.length,source_success:ok.length,
  source_failures:results.filter(x=>x.status!=='SOURCE_OK').map(x=>({id:x.id,error:x.error})),
  hypotheses,new_evidence_sets:hypotheses.filter(x=>x.new_evidence_set).length,
  state:{schema:'imperion-market-signals-v1',seen:next}};
}
function markdown(report) {
 const lines=['# IMPERION — research-backed market hypotheses','',
  'Generated: '+report.generated_at,'Status: '+report.status+
  '; verified source fetches: '+report.source_success+'/'+report.source_total+
  '; novel evidence sets: '+report.new_evidence_sets,'',
  '**These are public industry signals, not clients, procurement requests, revenue, TAM or proof of willingness to pay.**',
  'No contact, CRM write, application, external message, subscription, or AI API charge occurred.',''];
 for(const h of report.hypotheses){
  lines.push('## '+h.title,'','Stage: '+h.stage+'; buyer/price/scale: NOT VERIFIED.',
   'Hypothetical buyer: '+h.target_buyer,
   'Test offer: '+h.offer_hypothesis,
   'Gate: (quoted Kč - all direct costs) / ALL owner hours >= 1 000 Kč. Quote and hours: NOT VERIFIED.',
   'Next: '+h.validation,'Sources:');
  for(const s of h.sources)lines.push('- '+s.publisher+': '+s.url+' ('+(s.publication_date||'publication date not verified')+')');
  lines.push('');
 }
 if(!report.hypotheses.length)lines.push('No verified topic match; do NOT invent opportunities.','');
 for(const fail of report.source_failures)lines.push('SOURCE_FAILED '+fail.id+': '+fail.error);
 return lines.join('\n')+'\n';
}
async function run({fetcher=fetch,sources=SOURCES,prior={}}={}) {
 const checked=await Promise.all(sources.map(async s=>{
  try{return await readSource(s,fetcher);}
  catch(e){return {id:s.id,url:s.url,status:'SOURCE_FAILED',error:String(e?.message||'SOURCE_UNAVAILABLE').slice(0,60)};}
 }));
 const data=aggregate(checked,prior);
 return {schema:'imperion-market-signals-report-v1',generated_at:new Date().toISOString(),
  ...data,source_checks:checked,communications_sent:0,crm_writes:0,paid_api_requests:0};
}
async function main(argv=process.argv.slice(2)){
 const value=(flag,fallback)=>{const i=argv.indexOf(flag);return i<0?fallback:argv[i+1];};
 const out=path.resolve(value('--out',path.join(process.cwd(),'.private-b2b-review')));
 const statePath=path.resolve(value('--state',path.join(process.cwd(),'.cache/market-signals-state.json')));
 const previous=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{};
 if(previous.schema&&previous.schema!=='imperion-market-signals-v1')throw Error('STATE_SCHEMA_MISMATCH');
 const report=await run({prior:previous});
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'market-signals.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(out,'market-signals.md'),markdown(report));
 if(report.source_success){
  fs.mkdirSync(path.dirname(statePath),{recursive:true});
  fs.writeFileSync(statePath,JSON.stringify(report.state,null,2)+'\n');
 }
 console.log(JSON.stringify({status:report.status,source_success:report.source_success,
  new_evidence_sets:report.new_evidence_sets,hypotheses:report.hypotheses.length,
  crm_writes:0,communications_sent:0,paid_api_requests:0}));
 if(report.status==='SOURCE_FAILED')process.exitCode=1;
 return report;
}
if(require.main===module)main().catch(e=>{console.error('MARKET_SIGNALS_BLOCKED:'+e.message);process.exitCode=1;});
module.exports={SOURCES,LENSES,allowedSource,visibleText,scanText,readSource,aggregate,markdown,run,main};
