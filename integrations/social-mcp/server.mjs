/**
 * Imperion Social MCP gateway. Zero npm dependencies; Node >=20.
 * Existing Google Sheets SocialPublishing is the ONLY source of truth.
 * Apps Script MCPBridge.gs owns approval, lock, Bot API call, and readback.
 * The gateway never holds Telegram credentials and never schedules a post.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PROTOCOL = '2025-11-25';
const VERSION = '0.1.0';
const ID_PATTERN = /^[A-Za-z0-9:_-]{4,128}$/;
const TOOLS = [
  {
    name: 'publication_status', description: 'Read-only readiness of the existing Imperion publishing bridge. No live publication.',
    inputSchema: {type: 'object', additionalProperties: false, properties: {}}, annotations: {readOnlyHint: true}
  },
  {
    name: 'telegram_preview', description: 'Read one existing SocialPublishing Job_ID through the authorised Apps Script bridge. Returns blockers and a public-only preview; does not publish.',
    inputSchema: {type: 'object', additionalProperties: false, properties: {job_id: {type: 'string', minLength: 4, maxLength: 128}}, required: ['job_id']}, annotations: {readOnlyHint: true}
  },
  {
    name: 'telegram_publish_approved', description: 'Publish ONLY an independently approved Telegram Job_ID from existing SocialPublishing. Hard duplicate, event and rights gates run inside Apps Script under a lock. Side effect: real Telegram post and CRM receipt.',
    inputSchema: {type: 'object', additionalProperties: false, properties: {job_id: {type: 'string', minLength: 4, maxLength: 128}, confirm: {type: 'boolean', const: true}}, required: ['job_id', 'confirm']}, annotations: {readOnlyHint: false, destructiveHint: false}
  },
  {
    name: 'whatsapp_group_share_preview', description: 'Prepare a human-operated WhatsApp share URL from an existing approved/public WhatsApp Job_ID. Does NOT send, cannot publish to personal groups through the official API.',
    inputSchema: {type: 'object', additionalProperties: false, properties: {job_id: {type: 'string', minLength: 4, maxLength: 128}}, required: ['job_id']}, annotations: {readOnlyHint: true}
  }
];

const output = x => ({content: [{type: 'text', text: JSON.stringify(x)}]});
const fail = (code, detail) => ({content: [{type: 'text', text: JSON.stringify({ok:false,code,detail})}], isError: true});
const rpcError = (id, code, message) => ({jsonrpc: '2.0', id: id ?? null, error: {code, message}});
const rpcResult = (id, result) => ({jsonrpc: '2.0', id, result});
const safeJobId = v => typeof v === 'string' && ID_PATTERN.test(v) && !v.includes('..');

export function createGateway({env = process.env, fetchFn = globalThis.fetch, now = () => Date.now(), nonce = () => crypto.randomBytes(16).toString('hex')} = {}) {
  const bridgeUrl = env.MCP_BRIDGE_WEBAPP_URL || '';
  const bridgeSecret = env.MCP_BRIDGE_SECRET || '';
  const bridgeReady = Boolean(bridgeUrl && bridgeSecret);
  // OAuth / extra auth is out-of-band: never expose this over the internet without an access gate.
  async function callBridge(action, jobId) {
    if (!bridgeReady) throw new Error('BRIDGE_NOT_CONFIGURED');
    let url;
    try { url = new URL(bridgeUrl); } catch { throw new Error('BRIDGE_URL_INVALID'); }
    if (url.protocol !== 'https:' || !['script.google.com','script.googleusercontent.com'].includes(url.hostname)) {
      throw new Error('BRIDGE_URL_MUST_BE_GOOGLE_APPS_SCRIPT_HTTPS');
    }
    url.searchParams.set('mcp', '1');
    const ts = now();
    const requestId = nonce();
    const text = ['v1', action, jobId, String(ts), requestId].join('\n');
    const sig = crypto.createHmac('sha256', bridgeSecret).update(text, 'utf8').digest('hex');
    const body = {version: 'v1', action, job_id: jobId, ts, nonce: requestId, sig};
    const response = await fetchFn(url.toString(), {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
      redirect: 'follow', signal: AbortSignal.timeout(18000)
    });
    if (!response.ok) throw new Error('BRIDGE_HTTP_' + response.status);
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('BRIDGE_INVALID_RESPONSE');
    return data;
  }
  async function callTool(name, args) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return fail('INVALID_ARGUMENTS','Object required');
    if (name === 'publication_status') return output({ok: true, mode: env.PUBLISH_ENABLED === '1' ? 'enabled_with_approval_gates' : 'read_only', bridgeConfigured: bridgeReady, source: 'Existing Google Sheets SocialPublishing, via existing Apps Script', automation: 'none', whatsappGroupAutoPost: false});
    if (!TOOLS.some(x => x.name === name)) return fail('UNKNOWN_TOOL','Tool does not exist');
    if (!safeJobId(args.job_id)) return fail('BAD_JOB_ID','A valid existing Job_ID is required');
    if (name === 'telegram_publish_approved' && (args.confirm !== true || env.PUBLISH_ENABLED !== '1')) {
      return fail('PUBLISH_DISABLED','Enable PUBLISH_ENABLED=1 on the authorised server and explicitly confirm the concrete Job_ID');
    }
    try {
      if (name === 'telegram_preview') return output(await callBridge('preview_telegram', args.job_id));
      if (name === 'telegram_publish_approved') {
        // IMPORTANT: on network timeout, the upstream send outcome is UNKNOWN. NEVER retry automatically.
        return output(await callBridge('publish_telegram', args.job_id));
      }
      if (name === 'whatsapp_group_share_preview') {
        const r = await callBridge('preview_whatsapp', args.job_id);
        if (!r.ok) return output(r);
        if (typeof r.caption !== 'string' || !r.publicApproved || r.caption.length > 3000) return fail('SHARE_BLOCKED','Public approved WhatsApp caption missing or too long');
        return output({ok: true, job_id: args.job_id, action: 'MANUAL_SHARE_REQUIRED', url: 'https://wa.me/?text=' + encodeURIComponent(r.caption), automaticallySent: false});
      }
      return fail('UNKNOWN_TOOL','Tool does not exist');
    } catch (err) {
      // Never echo URLs (might embed user-specific details) or secret-bearing upstream text.
      const message = String(err?.message || 'unknown');
      return fail(message.startsWith('BRIDGE_') ? message : 'DELIVERY_OUTCOME_UNCERTAIN',
        name === 'telegram_publish_approved' ? 'Do not retry. Reconcile Telegram channel and SocialPublishing receipt first.' : 'Bridge not available. No publication requested.');
    }
  }
  async function handle(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') return rpcError(null,-32600,'Invalid Request');
    const {id, method, params = {}} = message;
    if (id === undefined) return null; // notification; HTTP layer returns 202
    switch (method) {
      case 'initialize': return rpcResult(id, {protocolVersion: PROTOCOL, capabilities: {tools: {listChanged: false}}, serverInfo: {name: 'imperion-social-mcp', version: VERSION}});
      case 'ping': return rpcResult(id, {});
      case 'tools/list': return rpcResult(id, {tools: TOOLS});
      case 'tools/call': {
        if (!params || typeof params.name !== 'string') return rpcError(id,-32602,'Invalid params');
        return rpcResult(id, await callTool(params.name, params.arguments || {}));
      }
      default: return rpcError(id,-32601,'Method not found');
    }
  }
  return {callTool, handle};
}

export function createHttpServer({env = process.env, gateway = createGateway({env})} = {}) {
  const host = env.MCP_HOST || '127.0.0.1';
  const port = Number(env.MCP_PORT || 8788);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid MCP_PORT');
  const localOnly = host === '127.0.0.1' || host === 'localhost';
  if (!localOnly && (!env.MCP_CLIENT_TOKEN || !env.MCP_ALLOWED_HOST)) throw new Error('Non-local hosting requires MCP_CLIENT_TOKEN and MCP_ALLOWED_HOST');
  const server = http.createServer(async (req,res) => {
    const json = (status,obj) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(obj));};
    const currentPort = req.socket.localPort || port;
    const expectedHost = localOnly ? new Set(['127.0.0.1:'+currentPort,'localhost:'+currentPort]) : new Set([env.MCP_ALLOWED_HOST]);
    if (!expectedHost.has(String(req.headers.host || ''))) return json(403,{error:'host_denied'});
    if (req.headers.origin) {
      let origin;
      try { origin = new URL(req.headers.origin); } catch { return json(403,{error:'origin_denied'}); }
      if (origin.host !== req.headers.host || !['http:','https:'].includes(origin.protocol)) return json(403,{error:'origin_denied'});
    }
    if (!localOnly) {
      const given = crypto.createHash('sha256').update(String(req.headers.authorization || '')).digest();
      const required = crypto.createHash('sha256').update('Bearer ' + env.MCP_CLIENT_TOKEN).digest();
      if (!crypto.timingSafeEqual(given, required)) return json(401,{error:'unauthorized'});
    }
    if (req.url === '/health' && req.method === 'GET') return json(200,{ok:true,service:'imperion-social-mcp',mode:'non-publishing-health'});
    if (req.url !== '/mcp') return json(404,{error:'not_found'});
    if (req.method === 'GET' || req.method === 'DELETE') {res.writeHead(405,{'Allow':'POST'});return res.end();}
    if (req.method !== 'POST') return json(405,{error:'method_not_allowed'});
    const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
    if (contentType !== 'application/json') return json(415,{error:'json_required'});
    let chunks=[],length=0;
    for await (const chunk of req) {length += chunk.length;if (length > 65536) return json(413,{error:'request_too_large'}); chunks.push(chunk);}
    let body;
    try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return json(400,rpcError(null,-32700,'Parse error'));}
    const answer = await gateway.handle(body);
    if (answer === null) {res.writeHead(202);return res.end();}
    return json(200,answer);
  });
  return {server, host, port};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {server,host,port} = createHttpServer();
  server.listen(port,host,()=>process.stderr.write(`Imperion MCP listening on ${host}:${port} (no publication unless authorised)\n`));
}