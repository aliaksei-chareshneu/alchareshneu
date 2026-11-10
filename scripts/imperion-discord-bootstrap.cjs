'use strict';
/**
 * Project 80: one-shot bot-only Discord server configuration.
 * Preview by default; read-only authenticated --inspect; explicit --apply gate.
 * NO user token, member import, payment, invites, posts, messages or daemon.
 */
const JOB_ID = 'JOB-IMP-COMMUNITY-PRESENCE-20261110';
const API = 'https://discord.com/api/v10';
const SITE = 'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/';
const MANIFEST = Object.freeze([
  {name:'START HERE',channels:[
    ['welcome', 'Welcome to Druzina Moravy! Read the rules, then find your first activity: '+SITE],
    ['rules-and-safety', 'Community rules. Safety, location, attendance and eligibility are confirmed per activity on the official site.'],
    ['announcements', 'Verified event announcements only. Not a booking or payment confirmation.'],
    ['first-training', 'New to HEMA or LARP? See current programme, terms, safety and first visit: '+SITE]
  ]},
  {name:'COMMUNITY',channels:[
    ['introductions', 'Optional introductions. Please do not disclose personal contact details or student data.'],
    ['general', 'Friendly international community. English first; Czech, Ukrainian and Russian welcome.']
  ]},
  {name:'HEMA AND LARP',channels:[
    ['events-and-training', 'Discuss confirmed training and LARP events. Register through the official organiser, not a Discord reaction.'],
    ['equipment-and-crafting', 'Costumes, shields, crafting and gear discussion; no dangerous DIY instructions.']
  ]}
]);
const ROLES = Object.freeze(['Newcomer','HEMA interest','LARP interest','Crafting interest']);
const READ_ONLY = new Set(['welcome','rules-and-safety','announcements']);
const SEND_MESSAGES = 2048n;
const normalize = v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function validateIdentity(guild, guildId, expectedName) {
  if (!expectedName || normalize(expectedName).length < 6) throw Error('Exact expected guild name is required.');
  if (!guild || String(guild.id)!==String(guildId)) throw Error('Guild ID response mismatch.');
  if (normalize(guild.name)!==normalize(expectedName)) throw Error('Wrong guild name: abort without changes.');
  if (!normalize(guild.name).includes('druzina') || !normalize(guild.name).includes('moravy'))
    throw Error('Guild is not explicitly named Druzina Moravy: abort without changes.');
}
function hasReadOnlyEveryone(channel,guildId) {
  const overrides=channel.permission_overwrites||[];
  return overrides.some(o=>String(o.id)===String(guildId) && Number(o.type)===0 &&
    (BigInt(o.deny || '0') & SEND_MESSAGES)===SEND_MESSAGES);
}
function plan() {return {
  case_id:JOB_ID,legal_entity:'Druzina Moravy z.s.',budget_kc:0,
  external_publications:0,member_imports:0,customer_payments:0,site:SITE,
  categories:MANIFEST.map(c=>({name:c.name,channels:c.channels.map(v=>v[0])})),
  interest_roles:[...ROLES],
  human_only:['Discord account/server creation','bot app install/authorization','Community onboarding and moderation','invitation and public promotion']
};}
function buildApi(token,request) {
  return async(method,path,data)=>{
    const response=await request(API+path,{
      method,headers:{Authorization:'Bot '+token,'Content-Type':'application/json'},
      ...(data?{body:JSON.stringify(data)}:{})
    });
    if(!response.ok) throw Error('Discord HTTP '+response.status+' on '+method+' '+path+'; stop; no automatic retry.');
    return response.status===204?null:response.json();
  };
}
async function fetchInventory({guildId,token,expectedName,request=fetch}) {
  if (!/^\d{15,22}$/.test(String(guildId||''))) throw Error('Invalid Discord guild ID.');
  if (typeof token!=='string' || !token.trim()) throw Error('Bot token must be provided privately.');
  if (typeof request!=='function') throw Error('Request adapter missing.');
  const api=buildApi(token.trim(),request);
  const guild=await api('GET','/guilds/'+guildId);
  validateIdentity(guild,guildId,expectedName);
  const [channels,roles]=await Promise.all([
    api('GET','/guilds/'+guildId+'/channels'),api('GET','/guilds/'+guildId+'/roles')
  ]);
  if(!Array.isArray(channels)||!Array.isArray(roles))throw Error('Discord inventory malformed.');
  return {guild,channels,roles,api};
}
function analyzeInventory({guild,channels,roles}) {
  const blockers=[],ops=[];
  for(const name of ROLES){
    const matched=roles.filter(r=>r.name===name);
    if(matched.length>1)blockers.push('Duplicate interest role: '+name);
    if(matched.length===1 && BigInt(matched[0].permissions||'0')!==0n)
      blockers.push('Interest role has elevated permissions, human review: '+name);
    if(!matched.length)ops.push({kind:'role',name});
  }
  for(const category of MANIFEST){
    const parents=channels.filter(c=>c.name===category.name);
    if(parents.length>1 || (parents.length===1&&parents[0].type!==4))
      blockers.push('Category name/type conflict: '+category.name);
    const parent=parents.length===1&&parents[0].type===4?parents[0]:null;
    if(!parent)ops.push({kind:'category',name:category.name});
    for(const [name] of category.channels){
      const existing=channels.filter(c=>c.name===name);
      if(existing.length>1 || (existing.length===1 && (existing[0].type!==0 || (parent && String(existing[0].parent_id)!==String(parent.id)) || (!parent && existing.length))))
        blockers.push('Channel conflict (wrong category/type/duplicate): '+name);
      if(existing.length===1 && READ_ONLY.has(name) && !hasReadOnlyEveryone(existing[0],guild.id))
        blockers.push('Read-only policy missing on existing channel; no overwrite without review: '+name);
      if(!existing.length)ops.push({kind:'text',name,parent:category.name});
    }
  }
  return {blockers,ops};
}
async function reconcile({guildId,token,expectedName,request=fetch,dryRun=true,log=()=>{}}){
  let current=await fetchInventory({guildId,token,expectedName,request});
  const analysis=analyzeInventory(current);
  if(analysis.blockers.length)throw Error('Preflight blocked: '+analysis.blockers.join(' | '));
  if(dryRun)return {case_id:JOB_ID,guild_id:guildId,guild_name:current.guild.name,mode:'INSPECT',planned_changes:analysis.ops,verified_structure:analysis.ops.length===0,posts_sent:0,invites_created:0,member_imports:0};
  const applied=[];
  for(const op of analysis.ops){
    if(op.kind==='role'){
      const role=await current.api('POST','/guilds/'+guildId+'/roles',{name:op.name,permissions:'0',hoist:false,mentionable:false});
      current.roles.push(role);
    } else if(op.kind==='category'){
      const cat=await current.api('POST','/guilds/'+guildId+'/channels',{name:op.name,type:4});
      current.channels.push(cat);
    } else {
      const parent=current.channels.find(c=>c.name===op.parent&&c.type===4);
      if(!parent)throw Error('Missing freshly created category: '+op.parent);
      const topic=MANIFEST.flatMap(c=>c.channels).find(c=>c[0]===op.name)[1];
      const item=await current.api('POST','/guilds/'+guildId+'/channels',{
        name:op.name,type:0,parent_id:parent.id,topic,
        ...(READ_ONLY.has(op.name)?{permission_overwrites:[{id:guildId,type:0,allow:'0',deny:'2048'}]}:{})
      });
      current.channels.push(item);
    }
    applied.push(op.kind+':'+op.name);log('CONFIGURED '+op.kind+':'+op.name);
  }
  // Use independent remote source readback after changes; do not claim done on POST alone.
  current=await fetchInventory({guildId,token,expectedName,request});
  const after=analyzeInventory(current);
  if(after.blockers.length||after.ops.length)throw Error('Post-apply readback not clean, check partial configuration: '+[...after.blockers,...after.ops.map(o=>o.kind+':'+o.name)].join(' | '));
  return {case_id:JOB_ID,guild_id:guildId,guild_name:current.guild.name,mode:'APPLIED_READBACK_VERIFIED',created:applied,verified_structure:true,posts_sent:0,invites_created:0,member_imports:0,
    caveat:'Community onboarding, moderation, invites and publications still require separate owner review.'};
}
async function main(argv=process.argv.slice(2),env=process.env,request=fetch){
  const modes=argv.filter(a=>['--plan','--inspect','--apply'].includes(a));
  if(argv.includes('--help')){console.log('node scripts/imperion-discord-bootstrap.cjs [--plan | --inspect | --apply]. Defaults to --plan. --inspect uses bot API read-only. --apply additionally requires case-specific write GO.');return;}
  if(modes.length>1 || argv.some(a=>!['--plan','--inspect','--apply'].includes(a)))throw Error('Invalid mode; use --plan, --inspect, or --apply only.');
  const mode=modes[0]||'--plan';
  if(mode==='--plan'){console.log(JSON.stringify(plan(),null,2));return;}
  if(mode==='--apply' && env.IMPERION_DISCORD_WRITE_GO!==JOB_ID+':APPROVED')throw Error('Case-specific write GO not present.');
  const result=await reconcile({guildId:env.DISCORD_GUILD_ID,token:env.DISCORD_BOT_TOKEN,expectedName:env.DISCORD_EXPECTED_GUILD_NAME,request,dryRun:mode==='--inspect',log:line=>console.log(line)});
  console.log(JSON.stringify(result,null,2));
  return result;
}
if(require.main===module)main().catch(e=>{console.error('BLOCKED:',e.message);process.exitCode=1;});
module.exports={JOB_ID,MANIFEST,ROLES,READ_ONLY,plan,analyzeInventory,fetchInventory,reconcile,main,validateIdentity,hasReadOnlyEveryone};
