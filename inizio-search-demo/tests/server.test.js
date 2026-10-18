import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

async function withServer(handler) {
 const server = createServer({
 search: async (q) => ({ query: q, count: 1, results: [{ position: 1, title: 'Test', url: 'https://example.org', snippet: 'OK' }] }),
 maxQueriesPerMinute: 2
 });
 await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 try { await handler(base); }
 finally { await new Promise((resolve) => server.close(resolve)); }
}

test('homepage has exactly one input and serves JavaScript', async () => {
 await withServer(async (base) => {
 const html = await (await fetch(base)).text();
 assert.equal((html.match(/<input\s/gi) || []).length, 1);
 assert.equal((await fetch(`${base}/app.js`)).status, 200);
 assert.equal((await fetch(`${base}/health`)).status, 200);
 });
});

test('HTTP API returns structured results and blocks malformed requests', async () => {
 await withServer(async (base) => {
 const ok = await fetch(`${base}/api/search`, {
 method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: 'topic' })
 });
 assert.equal(ok.status, 200);
 assert.deepEqual(await ok.json(), {
 query: 'topic', count: 1, results: [{ position: 1, title: 'Test', url: 'https://example.org', snippet: 'OK' }]
 });
 const invalid = await fetch(`${base}/api/search`, {
 method: 'POST', headers: { 'content-type': 'application/json' }, body: 'oops'
 });
 assert.equal(invalid.status, 400);
 });
});

test('rate limit protects paid API credits', async () => {
 await withServer(async (base) => {
 for (const expected of [200, 200, 429]) {
 const response = await fetch(`${base}/api/search`, {
 method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: 'sample' })
 });
 assert.equal(response.status, expected);
 }
 });
});
