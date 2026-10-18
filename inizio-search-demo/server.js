import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { SearchError, searchGoogleOrganic, validateQuery } from './search.js';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_FILES = new Map([
 ['/', ['index.html', 'text/html; charset=utf-8']],
 ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
 ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);
const SECURITY_HEADERS = {
 'X-Content-Type-Options': 'nosniff',
 'Referrer-Policy': 'no-referrer',
 'X-Frame-Options': 'DENY',
 'X-Robots-Tag': 'noindex, nofollow, noarchive',
 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};

function sendJSON(res, status, data) {
 res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
 res.end(JSON.stringify(data));
}

async function readJSON(req) {
 const chunks = [];
 let length = 0;
 for await (const chunk of req) {
 length += chunk.length;
 if (length > 4096) throw new SearchError('Request is too large.', 413);
 chunks.push(chunk);
 }
 try {
 const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if (!json || typeof json !== 'object' || Array.isArray(json)) {
 throw new SearchError('Request must be a JSON object.', 400);
 }
 return json;
 } catch (error) {
 if (error instanceof SearchError) throw error;
 throw new SearchError('Invalid JSON request.', 400);
 }
}

export function createServer({
 search = searchGoogleOrganic,
 maxQueriesPerMinute = 8,
 maxDailyQueries = 50,
 cacheTtlMs = 2 * 60 * 60 * 1000,
 now = () => Date.now()
} = {}) {
 const requestsByIp = new Map();
 const cache = new Map();
 const inFlight = new Map();
 let currentDay = '';
 let searchedToday = 0;

 return http.createServer(async (req, res) => {
 try {
 const url = new URL(req.url ?? '/', 'http://localhost');
 if (url.pathname === '/health' && req.method === 'GET') {
 return sendJSON(res, 200, { ok: true, providerConfigured: Boolean(process.env.SERPER_API_KEY) });
 }
 if (url.pathname === '/api/search') {
 if (req.method !== 'POST') return sendJSON(res, 405, { error: 'Use POST.' });
 if (!req.headers['content-type']?.includes('application/json')) {
 return sendJSON(res, 415, { error: 'Use application/json.' });
 }

 // A simple abuse guard. Do not trust client-supplied X-Forwarded-For headers.
 const ip = req.socket.remoteAddress ?? 'unknown';
 const minute = Math.floor(now() / 60000);
 let bucket = requestsByIp.get(ip);
 if (!bucket || bucket.minute !== minute) bucket = { minute, count: 0 };
 bucket.count += 1;
 requestsByIp.set(ip, bucket);
 if (requestsByIp.size > 2000) requestsByIp.clear();
 if (bucket.count > maxQueriesPerMinute) {
 return sendJSON(res, 429, { error: 'Too many requests. Please wait a minute.' });
 }

 const json = await readJSON(req);
 const q = validateQuery(json.q);
 const cacheKey = q.toLocaleLowerCase('cs-CZ');
 const entry = cache.get(cacheKey);
 if (entry && entry.expiresAt > now()) {
 return sendJSON(res, 200, entry.result);
 }
 const day = new Date(now()).toISOString().slice(0, 10);
 if (currentDay !== day) {
 currentDay = day;
 searchedToday = 0;
 }
 if (searchedToday >= maxDailyQueries && !inFlight.has(cacheKey)) {
 return sendJSON(res, 429, { error: 'Daily demo search limit reached. Please try tomorrow.' });
 }
 if (!inFlight.has(cacheKey)) {
 searchedToday += 1;
 inFlight.set(cacheKey, Promise.resolve().then(() => search(q)));
 }
 const promise = inFlight.get(cacheKey);
 try {
 const result = await promise;
 cache.set(cacheKey, { result, expiresAt: now() + cacheTtlMs });
 if (cache.size > 100) cache.delete(cache.keys().next().value);
 return sendJSON(res, 200, result);
 } finally {
 if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey);
 }
 }

 if (req.method !== 'GET' && req.method !== 'HEAD') {
 return sendJSON(res, 405, { error: 'Method not allowed.' });
 }
 const staticInfo = PUBLIC_FILES.get(url.pathname);
 if (!staticInfo) return sendJSON(res, 404, { error: 'Not found.' });
 const [filename, contentType] = staticInfo;
 const data = await readFile(join(here, 'public', filename));
 res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300' });
 res.end(req.method === 'HEAD' ? undefined : data);
 } catch (error) {
 if (error instanceof SearchError) return sendJSON(res, error.status, { error: error.message });
 console.error('Unexpected request failure:', error);
 return sendJSON(res, 500, { error: 'Internal server error.' });
 }
 });
}

// Start only when invoked directly, not from tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
 const port = Number(process.env.PORT) || 3000;
 const maxDailyQueries = Number(process.env.MAX_DAILY_QUERIES) || 50;
 createServer({ maxDailyQueries }).listen(port, '0.0.0.0', () => {
 console.log(`INIZIO demo ready on http://localhost:${port}`);
 });
}
