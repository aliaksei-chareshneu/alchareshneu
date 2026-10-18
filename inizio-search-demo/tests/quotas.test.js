import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

async function withTestApp(options, run) {
 const server = createServer(options);
 await new Promise((done) => server.listen(0, '127.0.0.1', done));
 const base = `http://127.0.0.1:${server.address().port}`;
 const query = async (q) => {
 const r = await fetch(`${base}/api/search`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ q })
 });
 return { status: r.status, data: await r.json() };
 };
 try { await run({ base, query }); }
 finally { await new Promise((done) => server.close(done)); }
}

test('cache prevents repeated provider calls for identical normalized queries', async () => {
 let calls = 0;
 await withTestApp({
 maxQueriesPerMinute: 50,
 search: async (q) => { calls += 1; return { query: q, count: 0, results: [] }; }
 }, async ({ query }) => {
 assert.equal((await query(' Brno ')).status, 200);
 assert.equal((await query('brno')).status, 200);
 assert.equal(calls, 1);
 });
});

test('daily cap blocks new searches but allows cached queries', async () => {
 let clock = Date.parse('2026-10-18T10:00:00.000Z');
 let calls = 0;
 await withTestApp({
 maxQueriesPerMinute: 100, maxDailyQueries: 1, now: () => clock,
 search: async (q) => { calls++; return { query: q, count: 0, results: [] }; }
 }, async ({ query }) => {
 assert.equal((await query('first')).status, 200);
 assert.equal((await query('first')).status, 200);
 assert.equal((await query('second')).status, 429);
 clock += 86400000;
 assert.equal((await query('second')).status, 200);
 assert.equal(calls, 2);
 });
});

test('rejects JSON null and array with 400, never 500', async () => {
 await withTestApp({ maxQueriesPerMinute: 100 }, async ({ base }) => {
 for (const body of ['null', '[]', '{}']) {
 const r = await fetch(`${base}/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
 assert.equal(r.status, 400);
 }
 });
});

test('concurrent identical requests share the same provider lookup', async () => {
 let calls = 0;
 await withTestApp({
 maxQueriesPerMinute: 100,
 search: async (q) => { calls++; await new Promise((resolve) => setTimeout(resolve, 40)); return { query: q, count: 0, results: [] }; }
 }, async ({ query }) => {
 const responses = await Promise.all([query('same'), query('same'), query('same')]);
 assert.deepEqual(responses.map((r) => r.status), [200, 200, 200]);
 assert.equal(calls, 1);
 });
});

test('static page has restrictive content security policy', async () => {
 await withTestApp({}, async ({ base }) => {
 const r = await fetch(base);
 assert.equal(r.status, 200);
 assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
 assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
 });
});
