'use strict';
/**
 * IMPERION Project 80: one-shot Discord guild skeleton bootstrap.
 * No deps, daemon, customer data, new CRM, member imports or broadcasts.
 * Dry-run by default; writes require --apply, an exact GO marker, and bot auth.
 */
const JOB_ID = 'JOB-IMP-COMMUNITY-PRESENCE-20261110';
const API = 'https://discord.com/api/v10';
const MANIFEST = Object.freeze([
  { name: 'START HERE', channels: [
    ['welcome', 'Start here: who we are and how to join an activity.'],
    ['rules-and-safety', 'Community guidelines; activity safety is confirmed per event.'],
    ['announcements', 'Verified community updates only; no unapproved paid offers.'],
    ['first-training', 'First-visit information and link to the official website.']
  ] },
  { name: 'COMMUNITY', channels: [
    ['introductions', 'Optional, privacy-respecting self-introductions.'],
    ['general', 'English-first chat; Czech, Russian and Ukrainian welcomed.']
  ] },
  { name: 'HEMA AND LARP', channels: [
    ['events-and-training', 'Confirmed activities only; registration is not a payment receipt.'],
    ['equipment-and-crafting', 'Crafting, costume and approved equipment discussion.']
  ] }
]);
const ROLES = Object.freeze(['Newcomer', 'HEMA interest', 'LARP interest', 'Crafting interest']);
const READ_ONLY = new Set(['welcome', 'rules-and-safety', 'announcements']);
const SEND_MESSAGES = '2048';
const SOURCE_URL = 'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/';

function plan() {
  return { case_id: JOB_ID, legal_entity: 'Druzina Moravy z.s.',
    budget_kc: 0, publication: 'NONE', website: SOURCE_URL,
    categories: MANIFEST.map(c => ({name:c.name, channels:c.channels.map(v=>v[0])})),
    interest_roles: [...ROLES], human_only: ['Community enablement', 'Onboarding', 'Staff role privileges', 'Bot authorization'] };
}

async function reconcile({guildId, token, request, dryRun=false, log=()=>{}}) {
  if (!/^\d{15,22}$/.test(guildId || '')) throw Error('A real Discord guild ID is required.');
  if (!token || !token.trim()) throw Error('An authorized bot token is required.');
  const api = async (method, path, data) => {
    const r = await request(API + path, {
      method, headers: {Authorization:'Bot ' + token, 'Content-Type':'application/json'},
      ...(data ? {body:JSON.stringify(data)} : {})
    });
    if (!r.ok) throw Error('Discord HTTP ' + r.status + ' on ' + method + ' ' + path + '; stopped without retry.');
    return r.status === 204 ? null : r.json();
  };
  let channels = await api('GET', '/guilds/' + guildId + '/channels');
  let roles = await api('GET', '/guilds/' + guildId + '/roles');
  if (!Array.isArray(channels) || !Array.isArray(roles)) throw Error('Discord inventory malformed.');
  // Preflight all naming/parent conflicts before the first mutation.
  for (const role of ROLES) if (roles.filter(r=>r.name===role).length>1) throw Error('Duplicate role: ' + role);
  for (const category of MANIFEST) {
    const parents=channels.filter(c=>c.name===category.name);
    if (parents.length>1 || (parents.length===1 && parents[0].type!==4)) throw Error('Category name conflict: ' + category.name);
    for (const [name] of category.channels) {
      const peers=channels.filter(c=>c.name===name);
      if (peers.length>1 || (peers.length===1 && (peers[0].type!==0 || peers[0].parent_id!==(parents[0]?.id ?? null))))
        throw Error('Channel name/parent conflict: ' + name);
    }
  }
  const operations = [];
  for (const role of ROLES) {
    const match = roles.filter(r=>r.name===role);
    if (match.length > 1) throw Error('Duplicate role: ' + role);
    if (!match.length) {
      operations.push('create role ' + role + ' (zero permissions)');
      if (!dryRun) {
        roles.push(await api('POST', '/guilds/' + guildId + '/roles', {name:role,permissions:'0',mentionable:false,hoist:false}));
        log(operations[operations.length-1]);
      }
    }
  }
  for (const category of MANIFEST) {
    const matches = channels.filter(c=>c.name===category.name);
    if (matches.length>1 || (matches.length===1 && matches[0].type!==4)) throw Error('Category name conflict: ' + category.name);
    let parent = matches[0];
    if (!parent) {
      operations.push('create category ' + category.name);
      if (!dryRun) {
        parent = await api('POST', '/guilds/' + guildId + '/channels', {name:category.name,type:4});
        channels.push(parent);log(operations[operations.length-1]);
      }
    }
    for (const [name, topic] of category.channels) {
      const existing = channels.filter(c=>c.name===name);
      if (existing.length>1 || (existing.length===1 && (existing[0].type!==0 || (parent && existing[0].parent_id!==parent.id))))
        throw Error('Channel name/parent conflict: ' + name);
      if (!existing.length) {
        operations.push('create text channel ' + name + ' in ' + category.name);
        if (!dryRun) {
          const item = await api('POST', '/guilds/' + guildId + '/channels', {
            name, type:0, parent_id:parent.id, topic,
            ...(READ_ONLY.has(name) ? {permission_overwrites:[{id:guildId,type:0,deny:SEND_MESSAGES,allow:'0'}]} : {})
          });
          channels.push(item); log(operations[operations.length-1]);
        }
      }
    }
  }
  return {guild_id:guildId, dry_run:dryRun, operations, posts_sent:0, invites_created:0,
    warning:'No public invitation, posting, staff privileges, member imports or onboarding changes were made.'};
}

async function main(argv=process.argv.slice(2), env=process.env, request=fetch) {
  const apply = argv.includes('--apply');
  if (argv.includes('--help')) {console.log('Usage: node scripts/imperion-discord-bootstrap.cjs [--plan | --apply]\n--apply requires DISCORD_GUILD_ID, DISCORD_BOT_TOKEN and IMPERION_DISCORD_WRITE_GO.');return;}
  if (!apply) {console.log(JSON.stringify(plan(),null,2));return;}
  if (env.IMPERION_DISCORD_WRITE_GO !== JOB_ID + ':APPROVED') throw Error('Blocked: case-specific write GO marker absent.');
  const result = await reconcile({guildId:env.DISCORD_GUILD_ID,token:env.DISCORD_BOT_TOKEN,request,log:msg=>console.log('DONE: ' + msg)});
  console.log(JSON.stringify(result,null,2));
}
if (require.main === module) main().catch(e=>{console.error('BLOCKED:',e.message);process.exitCode=1;});
module.exports={plan,reconcile,main,MANIFEST,ROLES,JOB_ID};
