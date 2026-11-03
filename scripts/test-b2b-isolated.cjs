'use strict';
// Disposable local PostgreSQL + PostgREST. No linked project, cloud key or real email.
const {execFileSync,spawnSync}=require('node:child_process');
const fs=require('node:fs'),{createHmac}=require('node:crypto');
const prefix=`imperion-b2b-qa-${process.pid}`,db=prefix+'-db',rest=prefix+'-rest';
const docker=(...args)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const sql=q=>execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',db,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],{input:q,encoding:'utf8'}).trim();
const secret='synthetic-local-jwt-secret-at-least-32-characters';
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function jwt(role){const input=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,exp:Math.floor(Date.now()/1000)+3600});return input+'.'+createHmac('sha256',secret).update(input).digest('base64url');}
async function ready(check){for(let i=0;i<60;i++){try{if(await check())return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Local QA service did not become ready');}
(async()=>{try{
 docker('network','create',prefix);
 docker('run','-d','--name',db,'--network',prefix,'-e','POSTGRES_PASSWORD=synthetic-local-only',
  'postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94');
 await ready(()=>docker('exec',db,'pg_isready','-h','127.0.0.1','-U','postgres').includes('accepting connections'));
 sql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant anon,authenticated,service_role to postgres;");
 const migration=fs.readFileSync('supabase/migrations/20261103062215_imperion_b2b_revenue_hardening.sql','utf8');
 sql(migration);sql(migration); // repeatability against the existing table
 const baseline=fs.readFileSync('supabase/migrations/20261025_imperion_rsvp.sql','utf8');
 const rateTable=baseline.slice(baseline.indexOf('create table if not exists public.imperion_rsvp_rate_limits'),baseline.indexOf('alter table public.imperion_rsvp_events'));
 const rateFn=baseline.slice(baseline.indexOf('create or replace function public.imperion_rsvp_allow_request'),baseline.indexOf('grant execute on function public.imperion_rsvp_allow_request(text,integer) to service_role;')+'grant execute on function public.imperion_rsvp_allow_request(text,integer) to service_role;'.length);
 sql(rateTable+"alter table public.imperion_rsvp_rate_limits enable row level security; grant select,insert,update,delete on public.imperion_rsvp_rate_limits to service_role;"+rateFn.split('-- Initial')[0]);
 // Other bridge queues stay empty. Only their column contracts are needed here.
 const bridge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
 for(const name of ['imperion_rsvp_submissions','imperion_rsvp_enquiries']){
  const fields=bridge.split(`api.from("${name}")`)[1].match(/\.select\("([^"]+)"\)/)[1].split(',');
  sql(`create table public.${name} (${fields.map(k=>k+' '+(k==='id'?'uuid':k==='created_at'?'timestamptz':'text')).join(',')},crm_synced_at timestamptz); grant select,update on public.${name} to service_role;`);
 }
 sql("create function public.verify_imperion_intake_bridge_token(p_token text) returns boolean language sql as $$select p_token=repeat('a',64)$$; revoke all on function public.verify_imperion_intake_bridge_token(text) from public; grant execute on function public.verify_imperion_intake_bridge_token(text) to service_role;");
 // Reproduce the live catalog regex bug with synthetic constants, independently of JS.
 const bad=sql(String.raw`select 'synthetic@example.invalid' ~* '^[^@\\s]{1,80}@[^@\\s]+\\.[^@\\s]{2,}$';`);
 if(bad!=='f')throw Error('Legacy regex regression fixture changed');
 docker('run','-d','--name',rest,'--network',prefix,'-p','127.0.0.1::3000',
  '-e',`PGRST_DB_URI=postgres://postgres:synthetic-local-only@${db}:5432/postgres`,
  '-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,
  'postgrest/postgrest:v13.0.7@sha256:0a46780309a604cdc8b56c776c6e5e15788ce58174d709e40459ab5a2d44d228');
 const port=docker('port',rest,'3000/tcp').split(':').pop();
 const url=`http://127.0.0.1:${port}`;
 await ready(async()=> (await fetch(url)).ok);
 const out=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/b2b-isolated.spec.cjs','--workers=1'],{
  stdio:'inherit',env:{...process.env,B2B_QA_REST:url,B2B_QA_DB:db,B2B_QA_SERVICE:jwt('service_role'),B2B_QA_ANON:jwt('anon'),B2B_QA_AUTHENTICATED:jwt('authenticated')}
 });
 if(out.status!==0)throw Error('Isolated B2B checks failed');
 console.log('PASS: isolated B2B chain; PostgreSQL, CRM and local mailbox readbacks verified');
}finally{
 for(const name of [rest,db]){try{docker('rm','-f','-v',name);}catch{}}
 try{docker('network','rm',prefix);}catch{}
}})().catch(e=>{console.error(e.message);process.exitCode=1;});
