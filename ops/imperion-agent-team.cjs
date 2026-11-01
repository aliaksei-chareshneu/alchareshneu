'use strict';
/**
 * IMPERION five-function operator. Local, read-only, no paid APIs.
 *
 * Input: bounded PRIVATE read-only snapshot of EXISTING Community Hub sheets,
 * supplied by its authorized Apps Script/n8n owner process. No second CRM.
 * Does not read Gmail, publish, email, book, pay, schedule, or claim live status.
 *
 * Agent functions: chief / sales / social / seo / video.
 * Existing optional content adapter is used only in no-network PREVIEW mode.
 */
const fs = require('node:fs');
const path = require('node:path');
const { runPipeline } = require('./ai-content-pipeline.cjs');

const ROOT = path.resolve(__dirname, '..');
const FIELDS = Object.freeze({
  leads: ['leads', 'Leads'],
  revenue_actions: ['revenue_actions', 'Revenue_Actions'],
  social_publishing: ['social_publishing', 'SocialPublishing'],
  events: ['events', 'Events'],
  agent_jobs: ['agent_jobs', 'IMPERION_Agent_Jobs'],
  short_jobs: ['short_jobs', 'ShortFactory'],
});
const STOP_STAGES = new Set(['lost', 'closed', 'closed_hold', 'hold', 'do_not_contact', 'dormant', 'cancelled']);
// Explicit fixture tags only: never infer QA from a legitimate buyer's name or work.
const QA_ONLY_TAG = /(?:^|[_\s-])(?:QA_SYNTHETIC|SYNTHETIC_QA|QA_FIXTURE|TEST_FIXTURE|TEST_ONLY|DEMO_ONLY|MOCK_LEAD)(?:$|[_\s-])/;
const LIMIT = 4000;
function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function field(row, ...names) {
  for (const name of names) if (Object.hasOwn(row, name)) return row[name];
  return '';
}
function upper(v) { return str(v).toUpperCase(); }
function iso(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(v)) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
// Community Hub Events is configured with Europe/Prague local DateTime columns.
// Never silently guess during the skipped or repeated DST hour.
function pragueEventIso(value) {
  const explicit=iso(value);
  if (explicit) return explicit;
  if (typeof value!=='string') return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [year,month,day,hour,minute]=m.slice(1,6).map(Number);
  const second=m[6]===undefined ? 0 : Number(m[6]);
  const nominal=Date.UTC(year,month-1,day,hour,minute,second);
  const nominalDate=new Date(nominal);
  if (nominalDate.getUTCFullYear()!==year || nominalDate.getUTCMonth()!==month-1 ||
      nominalDate.getUTCDate()!==day || nominalDate.getUTCHours()!==hour ||
      nominalDate.getUTCMinutes()!==minute || nominalDate.getUTCSeconds()!==second) return null;
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
    second:'2-digit',hourCycle:'h23'});
  const target=[year,month,day,hour,minute,second].join('-');
  const matches=[1,2].map(offset=>new Date(nominal-offset*3600000)).filter(date=>{
    const o=Object.fromEntries(fmt.formatToParts(date).map(p=>[p.type,Number(p.value)]));
    return [o.year,o.month,o.day,o.hour,o.minute,o.second].join('-')===target;
  });
  return matches.length===1 ? matches[0].toISOString():null;
}
function rows(data, name) {
  const names = FIELDS[name];
  const key = names.find(k => Object.hasOwn(data, k));
  const v = key ? data[key] : [];
  if (!Array.isArray(v) || v.length > LIMIT) throw Error('INVALID_' + name.toUpperCase() + '_ROWS');
  if (v.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw Error('INVALID_ROW_OBJECT');
  return v;
}
function validSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schema_version !== 1) throw Error('INVALID_SNAPSHOT_SCHEMA');
  if (input.source_system !== 'EXISTING_IMPERION_HUB' || !iso(input.captured_at)) throw Error('UNVERIFIED_SNAPSHOT_SOURCE');
  if (typeof input.snapshot_id !== 'string' || !/^[A-Za-z0-9_-]{3,100}$/.test(input.snapshot_id)) throw Error('INVALID_SNAPSHOT_ID');
  if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) throw Error('INVALID_SNAPSHOT_DATA');
  for (const n of Object.keys(FIELDS)) rows(input.data, n);
  return input;
}
function identity(r, keys, i) {
  const v = str(field(r, ...keys));
  return v && v.length < 200 ? v : 'MISSING_ID_ROW_' + (i + 1);
}
function unique(data) {
  const seen = new Set();
  return data.filter(x => {
    const id = x.id.toLowerCase();
    if (id.startsWith('missing_id_row_') || seen.has(id)) return false;
    seen.add(id); return true;
  });
}
function dueState(value, now) {
  if (!value) return 'MISSING_DATE';
  const d = iso(value);
  if (!d) return 'DATE_REVIEW';
  if (new Date(d).getTime() <= new Date(now).getTime()) return 'OVERDUE';
  if (new Date(d).getTime() - new Date(now).getTime() < 86400000) return 'WITHIN_24H';
  return 'FUTURE';
}
function chief(snapshot) {
  const now = snapshot.captured_at;
  const allJobs = rows(snapshot.data, 'agent_jobs').map((r, i) => ({
    id: identity(r, ['Job_ID', 'job_id', 'ID'], i),
    status: upper(field(r, 'Status', 'status', 'State')),
    due: dueState(field(r, 'Due_At', 'Deadline_At', 'Due_Date', 'due_at'), now),
    due_at: str(field(r, 'Due_At', 'Deadline_At', 'Due_Date', 'due_at')),
    approval: upper(field(r, 'Owner_Approval', 'Approval_Status', 'approval_status')), 
    proof: !!str(field(r, 'Evidence_URI', 'Receipt_URL', 'evidence_url', 'Evidence')),
  }));
  // A user-entered DONE/VERIFIED state is only a claim, not a provider receipt.
  // Never erase it from review simply because the spreadsheet says "DONE".
  const closedClaim = new Set(['DONE', 'CLOSED', 'VERIFIED']);
  const claimedCompleted = allJobs.filter(x => closedClaim.has(x.status));
  const tasks = allJobs.filter(x => !closedClaim.has(x.status) && x.status !== 'CANCELLED');
  const rank = { OVERDUE: 0, WITHIN_24H: 1, DATE_REVIEW: 2, MISSING_DATE: 3, FUTURE: 4 };
  tasks.sort((a,b) => rank[a.due]-rank[b.due] || a.id.localeCompare(b.id));
  const events = rows(snapshot.data, 'events').map((r,i) => ({
    id: identity(r, ['Event_ID','event_id'], i),
    starts_at: pragueEventIso(field(r, 'Start_DateTime', 'Starts_At','Start_At','start_at','begins_at')),
    status: upper(field(r,'Status','status')),
  })).filter(x => x.starts_at && !['CANCELLED','DRAFT'].includes(x.status) &&
    new Date(x.starts_at).getTime() >= new Date(now).getTime() &&
    new Date(x.starts_at).getTime() - new Date(now).getTime() <= 7 * 86400000)
    .sort((a,b) => a.starts_at.localeCompare(b.starts_at));
  return {
    state: 'REVIEW_REQUIRED', source: 'EXISTING_IMPERION_HUB/IMPERION_Agent_Jobs+Events',
    open_tasks: tasks.length, urgent: tasks.filter(t => ['OVERDUE','WITHIN_24H'].includes(t.due)).length,
    priority_tasks: tasks.slice(0, 20), next_7_days_events: events.slice(0,20),
    // Presence of Evidence_URI only identifies a candidate source to check.
    claimed_completed_total: claimedCompleted.length,
    claimed_completed_missing_evidence: claimedCompleted.filter(x=>!x.proof).length,
    completed_needing_readback: claimedCompleted.slice(0,20).map(x=>({
      id:x.id, status:x.status, evidence_uri_present:x.proof,
      independent_provider_readback:'NOT_CHECKED',
      next:x.proof?'VERIFY_PROVIDER_RECORD':'LOCATE_RECEIPT_AND_VERIFY_PROVIDER',
    })),
    unread_email: 'NOT_CHECKED', calendar_conflicts: 'NOT_CHECKED',
    accepted_results: 'REQUIRES_RECEIPTS', founder_minutes_saved: 'UNMEASURED',
  };
}
function sales(snapshot) {
  const source = rows(snapshot.data, 'revenue_actions');
  const contacts = source.length ? source : rows(snapshot.data, 'leads');
  let closed=0, duplicate=0, qaOnly=0;
  const seen = new Set(), candidates = [];
  // Revenue_Actions has Lead_ID but may omit Email/Company entirely. A
  // stopped Lead_ID must also block an alias/repeated action of that lead.
  const tokens = r => [
    ['lead_id',str(field(r,'Lead_ID','lead_id')).toLowerCase()],
    ['email',str(field(r,'Email','email')).toLowerCase()],
    ['org',str(field(r,'Company','Organisation','Organization','Company_Domain','Domain')).toLowerCase()]
  ].filter(([,v])=>v).map(([kind,v])=>kind+':'+v);
  const qaOnlyRow = r => ['Source','Action_Status','Stage','Lead_ID']
    .some(k => QA_ONLY_TAG.test(upper(field(r,k,k.toLowerCase()))));
  const stopped = r => {
    const stage = str(field(r,'Stage','stage','Status','status')).toLowerCase();
    const optOut = ['TRUE','YES'].includes(upper(field(r,'Opt_Out','opt_out','Do_Not_Contact')));
    const actionStatus = upper(field(r,'Action_Status','action_status'));
    const statusStop = /(?:^|[_\s-])(STOP|HOLD|CLOSED|DORMANT|LOST|DO_NOT_CONTACT)(?:[_\s-]|$)/.test(actionStatus);
    return STOP_STAGES.has(stage) || stage.startsWith('closed_') || optOut || statusStop;
  };
  // A stopped identity also blocks aliases/different rows sharing the same
  // normalized email or company, never bypassing an opt-out via a duplicate.
  // QA fixtures are quarantined, not interpreted as real opt-out evidence.
  const blockedTokens = new Set(contacts.filter(r => !qaOnlyRow(r) && stopped(r)).flatMap(tokens));
  for (const [i,r] of contacts.entries()) {
    if (qaOnlyRow(r)) { qaOnly++; continue; }
    const stage = str(field(r,'Stage','stage','Status','status')).toLowerCase();
    if (stopped(r) || tokens(r).some(t=>blockedTokens.has(t))) { closed++; continue; }
    const id = identity(r,['Lead_ID','Opportunity_ID','Action_ID','ID'],i);
    const email = str(field(r,'Email','email')).toLowerCase();
    const org = str(field(r,'Company','Organisation','Organization','Company_Domain','Domain')).toLowerCase();
    const dedup = email || org || id.toLowerCase();
    if (id.startsWith('MISSING_ID_') || !dedup || seen.has(dedup)) { duplicate++; continue; }
    seen.add(dedup);
    const history = upper(field(r,'Email_History_Check','History_Verified','history_verified'));
    const stopChecked = upper(field(r,'Stop_List_Checked','stop_list_checked'));
    const date = str(field(r,'Next_Action_At','Next_Action_Date','Due_At'));
    const due = dueState(date,snapshot.captured_at);
    const amount = Number(field(r,'Quoted_CZK','Expected_CZK','Expected_Value_CZK','Amount_CZK'));
    const value = Number.isFinite(amount) && amount > 0 ? amount : null;
    const ready = history === 'VERIFIED' || history === 'TRUE';
    candidates.push({
      id, stage: stage || 'UNCLASSIFIED', due, amount_czk: value,
      next: !ready || !['VERIFIED','TRUE'].includes(stopChecked) ? 'VERIFY_HISTORY_AND_STOP_LIST' : 'OWNER_REVIEW_NEXT_ACTION',
      external_message_sent: false, cash_received: 'NOT_VERIFIED',
    });
  }
  const rank = {OVERDUE:0,WITHIN_24H:1,DATE_REVIEW:2,MISSING_DATE:3,FUTURE:4};
  candidates.sort((a,b) => rank[a.due]-rank[b.due] || (b.amount_czk||0)-(a.amount_czk||0));
  return {
    state: 'REVIEW_REQUIRED', source: source.length ? 'EXISTING_IMPERION_HUB/Revenue_Actions' : 'EXISTING_IMPERION_HUB/Leads',
    source_rows: contacts.length, qa_only_excluded: qaOnly, closed_or_opted_out: closed, duplicates_rejected: duplicate,
    candidates: candidates.slice(0, 100), candidates_total: candidates.length,
    outbound_sent: 0, contracted_verified: 'NOT_CHECKED', cleared_cash: 'NOT_CHECKED',
  };
}
async function social(snapshot) {
  const records = rows(snapshot.data,'social_publishing');
  const seen = new Set(), jobs = [];
  for (const [i,r] of records.entries()) {
    const id = identity(r,['Job_ID','job_id'],i);
    if (id.startsWith('MISSING_ID_')) { jobs.push({ id, state:'INVALID_SOURCE_ID' }); continue; }
    if (seen.has(id)) { jobs.push({id,state:'DUPLICATE_SOURCE_JOB_ID'}); continue; }
    seen.add(id);
    const status = upper(field(r,'Status','status','State'));
    // Stored scheduled/posted state never proves actual publication.
    if (status === 'PUBLISHED_VERIFIED') {
      jobs.push({id,state:'PROVIDER_READBACK_NEEDED', existing_status:status});
      continue;
    }
    if (['DELIVERY_UNVERIFIED','SUBMITTING','BUFFER_SUBMITTING','ERROR',
      'PENDING','SCHEDULED_PENDING','SCHEDULED','POSTED_UNVERIFIED',
      'PUBLISHED'].includes(status)) {
      jobs.push({id,state:'NO_AUTORETRY_RECONCILE_PROVIDER',existing_status:status});
      continue;
    }
    const approved = field(r,'approved_public_snapshot');
    if (!approved) { jobs.push({id,state:'HUMAN_SOURCE_REVIEW_REQUIRED',existing_status:status}); continue; }
    if (approved.job_id !== id) {jobs.push({id,state:'SOURCE_JOB_ID_MISMATCH'});continue;}
    try {
      const draft = await runPipeline(approved,{live:false,withImage:true,
        fetchImpl:()=>{throw Error('NETWORK_FORBIDDEN_IN_PREVIEW');}});
      jobs.push({id,state:'PREVIEW_READY',source_fingerprint:draft.source_fingerprint,
        targets:draft.targets, published:false});
    } catch {
      jobs.push({id,state:'SOURCE_RIGHTS_OR_FACT_GATE_BLOCKED'});
    }
  }
  return {state:'REVIEW_REQUIRED',source:'EXISTING_IMPERION_HUB/SocialPublishing',
    jobs:jobs.slice(0,100), total:jobs.length, published_by_this_run:0,
    pending_reconciliation:jobs.filter(j=>j.state==='PROVIDER_READBACK_NEEDED'||j.state==='NO_AUTORETRY_RECONCILE_PROVIDER').length};
}
function seo(root=ROOT) {
  const read = f => {try{return fs.readFileSync(path.join(root,f),'utf8');}catch{return '';}};
  const robots=read('robots.txt'), sitemap=read('sitemap.xml'),
    index=read('index.html'), corporate=read('corporate/index.html');
  const checks=[
    ['ROBOTS_PRESENT',!!robots],
    ['SITEMAP_DECLARED',robots.includes('sitemap.xml')],
    ['SITEMAP_VALID_LOC',/<loc>https:\/\//.test(sitemap)],
    ['CORPORATE_URL_IN_SITEMAP',sitemap.includes('/alchareshneu/corporate/')],
    ['ROOT_HTML_TITLE',/<title>[^<]{5,}<\/title>/i.test(index)],
    ['CORPORATE_HTML_TITLE',/<title>[^<]{5,}<\/title>/i.test(corporate)],
    ['CORPORATE_META_DESCRIPTION',/<meta[^>]+name=["']description["']/i.test(corporate)],
    ['NO_SITEWIDE_NOINDEX', !/noindex/i.test(robots)],
  ].map(([check,passed])=>({check,passed}));
  return {state:'LOCAL_SOURCE_AUDIT_ONLY', source:'EXISTING_GITHUB_PAGES_REPOSITORY',
    checks, passed:checks.filter(c=>c.passed).length, total:checks.length,
    live_site_crawled:false, search_rankings:'NOT_CHECKED', public_code_modified:false};
}
function video(snapshot, root=ROOT) {
  const rowsIn = rows(snapshot.data,'short_jobs');
  const eligible=rowsIn.filter(r=>upper(field(r,'status','Status'))==='QUEUED_SAFE_SOURCE' &&
    ['owned','licensed','public_domain'].includes(str(field(r,'rights_status','Rights_Status')).toLowerCase()) &&
    /^[a-f0-9]{64}$/i.test(str(field(r,'source_sha256','Source_SHA256'))));
  return {state:'EXISTING_WORKER_READY_FOR_REVIEW',source:'EXISTING_ShortFactory/media_index.sqlite',
    worker_present:fs.existsSync(path.join(root,'shortfactory_autopilot.py')),
    eligible_in_supplied_snapshot:eligible.length,
    renderer_executed:false, actual_source_hashes_checked:false,
    clips_rendered:0, uploaded:0, published:0,
    next:'Existing worker validates source files and renders only after its own safety gate; not invoked here.'};
}
async function runAll(snapshot, options={}) {
  validSnapshot(snapshot);
  return {
    schema_version:1, snapshot_id:snapshot.snapshot_id, checked_at:snapshot.captured_at,
    mode:'READ_ONLY_PREVIEW', paid_api_calls:0, new_crm_records:0,
    chief:chief(snapshot), sales:sales(snapshot), social:await social(snapshot),
    seo:seo(options.root||ROOT), video:video(snapshot,options.root||ROOT),
    external_messages_sent:0, external_posts_published:0, payments_created:0,
    readback:'SOURCE_REVIEW_ONLY; NO_LIVE_PROVIDER_CONFIRMATION',
  };
}
async function main(argv=process.argv.slice(2)) {
  if (argv.length!==2 || argv[0]!=='--input' || !argv[1].endsWith('.json')) throw Error('USAGE: node ops/imperion-agent-team.cjs --input PRIVATE_HUB_SNAPSHOT.json');
  const file=path.resolve(argv[1]);
  const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
  process.stdout.write(JSON.stringify(await runAll(snapshot),null,2)+'\n');
}
if(require.main===module)main().catch(e=>{
  process.stderr.write((/^[A-Z0-9_: .-]+$/.test(e.message)?e.message:'AGENT_TEAM_FAILED')+'\n');
  process.exitCode=1;
});
module.exports={iso,pragueEventIso,rows,validSnapshot,dueState,chief,sales,social,seo,video,runAll};
