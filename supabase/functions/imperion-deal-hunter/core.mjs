/** IMPERION Deal Hunter: official public TED notice normalizer; no PII, sends or paid APIs. */
export const QUERY_GROUPS = Object.freeze([
  {id:'IT', cpv:'72000000'},
  {id:'RESEARCH', cpv:'73000000'},
  {id:'TRAINING', cpv:'80000000'}
]);
/** Match the installed pg_cron payload {mode:"cron"}; reject all unknown modes. */
export function resolveDealHunterMode(value) {
  if(value===undefined || value==='cron')return 'cron';
  if(value==='manual')return 'manual';
  return null;
}

export function tedQuery(cpv) {
  if (!QUERY_GROUPS.some(x => x.cpv === cpv)) throw Error('UNAPPROVED_CPV');
  return 'buyer-country=CZE AND notice-type IN (cn-standard cn-social cn-desg) AND classification-cpv='+cpv+' SORT BY publication-date DESC';
}
export function tedRequest(cpv) {
  return {query:tedQuery(cpv), fields:['publication-number','notice-title','buyer-name','publication-date','deadline','deadline-receipt-tender-date-lot','deadline-receipt-request-date-lot','classification-cpv','notice-type','total-value','total-value-cur'],
    page:1, limit:20, scope:'ACTIVE', paginationMode:'PAGE_NUMBER'};
}
export function shortText(value, max=220) {
  if (Array.isArray(value)) return shortText(value[0], max);
  if (value && typeof value === 'object') {
    for (const key of ['ces','cze','eng','en','slk','deu']) if (value[key]) return shortText(value[key],max);
    for (const v of Object.values(value)) {const x=shortText(v,max); if(x)return x;}
    return '';
  }
  return typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max) : '';
}
export function dateOrNull(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d\d-\d\d(?:[T+ Z].*)?$/.test(x)) return null;
  const d = new Date(x.slice(0,10)+'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===x.slice(0,10) ? x.slice(0,10):null;
}
/** TED has separate lot-level submission and participation-request deadlines.
 * Adapted from the existing public-only scripts/imperion-b2b-ted.cjs.
 * The generic "deadline" field is NOT evidence of a tender submission date.
 */
export function deadlineDates(value) {
  const found=new Set();
  const visit=(x,depth=0)=>{
    if(depth>5 || found.size>=30)return;
    if(typeof x==='string') {
      const d=dateOrNull(x.trim().slice(0,60));
      if(d)found.add(d);
    } else if(Array.isArray(x)) x.slice(0,30).forEach(y=>visit(y,depth+1));
    else if(x && typeof x==='object')Object.values(x).slice(0,30).forEach(y=>visit(y,depth+1));
  };
  visit(value);
  return [...found].sort();
}
export function closingDate(notice,now=new Date()) {
  const today=now.toISOString().slice(0,10);
  const fields=[
    ['deadline-receipt-tender-date-lot','TENDER_LOT'],
    ['deadline-receipt-request-date-lot','PARTICIPATION_REQUEST_LOT']
  ];
  for(const [field,source] of fields) {
    const dates=deadlineDates(notice[field]);
    if(!dates.length)continue;
    const future=dates.find(d=>d>=today);
    return {date:future||null,source,expired:!future};
  }
  // Do not mislabel an ancillary TED generic deadline as the bid deadline.
  return {date:null,source:'NOT_VERIFIED',expired:false};
}

/** Select only previously persisted rows with an absent deadline.
 * Never overwrite manual deadlines or any monetary / outreach metadata.
 */
export function deadlineBackfillCandidates(items,existingRows) {
  if(!Array.isArray(items)||!Array.isArray(existingRows))throw Error('INVALID_BACKFILL_INPUT');
  const known=new Map(existingRows.map(x=>[x.source_key,x]));
  return items.filter(x=>x.deadline_on && known.has(x.source_key) && !known.get(x.source_key).deadline_on);
}

export function moneyGate(quoteCzk, fullHours, directCostsCzk=0) {
  if (![quoteCzk, fullHours, directCostsCzk].every(v=>Number.isFinite(v)) || quoteCzk<0 || fullHours<=0 || directCostsCzk<0)
    return {gate:'REVIEW_UNCOSTED', net_czk_per_full_hour:null};
  const value=Math.round((quoteCzk-directCostsCzk)/fullHours*100)/100;
  return {gate:value>=1000?'PASS_ESTIMATE':'REJECT_UNDER_1000', net_czk_per_full_hour:value};
}
export function normalizeNotice(n, group, now=new Date()) {
  if(!n || typeof n !== 'object' || Array.isArray(n)) return null;
  const id=shortText(n['publication-number'],24);
  if(!/^\d{6,8}-20\d\d$/.test(id))return null;
  const title=shortText(n['notice-title'],320);
  if(title.length<12)return null;
  const buyer=shortText(n['buyer-name'],200);
  const source_url='https://ted.europa.eu/cs/notice/-/detail/'+id;
  const cpv=Array.isArray(n['classification-cpv'])?Array.from(new Set(n['classification-cpv'].filter(v=>/^\d{8}$/.test(v)))).slice(0,12):[];
  const lower=title.toLocaleLowerCase('cs');
  let score=group==='IT'?35:group==='RESEARCH'?30:22;
  const bonus=[/ai\b|uměl[aá]\s+inteligenc|artificial intelligence|strojov[eé] učen|machine learning/i,
    /python|automatiza|automation|data|datov|analyt|software|programov|vývoj|research|výzkum|bioinform/i,
    /školen|vzděláv|training|learning|kurz|vědeck|science/i].filter(r=>r.test(lower)).length;
  score=Math.min(100,score+bonus*17);
  if(score<35)return null;
  const published=dateOrNull(n['publication-date']);
  const closing=closingDate(n,now);
  if (closing.expired) return null;
  const deadline=closing.date;
  const noticeValue=shortText(n['total-value'],80);
  const noticeCurrency=shortText(n['total-value-cur'],8);
  return {
    source_key:'TED:'+id, source:'TED_OFFICIAL', publication_number:id,
    source_url, title, buyer, cpv_codes:cpv, published_on:published,
    deadline_on:deadline, notice_value_raw:noticeValue||null, notice_currency:noticeCurrency||null,
    fit_score:score, status:'REVIEW_UNCOSTED', legal_entity:'OSVC',
    evidence_classification:'OFFICIAL_NOTICE; DEADLINE_FIELD='+closing.source+'; OPEN_DEADLINE_ELIGIBILITY_BUDGET_AND_OWNER_RATE_UNVERIFIED',
    last_seen_at:now.toISOString()
  };
}
export function parseTedResponse(body, group, now=new Date()) {
  if (!body || !Array.isArray(body.notices) || body.notices.length>250) throw Error('BAD_TED_RESPONSE');
  const out=new Map();
  for(const n of body.notices){const item=normalizeNotice(n,group,now);if(item)out.set(item.source_key,item);}
  return {received:body.notices.length, items:[...out.values()]};
}
export function pragueSlot(at=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  const isWeekday=['Mon','Tue','Wed','Thu','Fri'].includes(o.weekday);
  const slot=(o.hour==='07'||o.hour==='13')&&o.minute==='20'&&isWeekday;
  return {allowed:slot, id:o.year+'-'+o.month+'-'+o.day+'T'+o.hour+':'+o.minute+'@Europe/Prague'};
}
