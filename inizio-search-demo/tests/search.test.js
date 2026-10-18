import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuery, normalizeOrganicResults, searchGoogleOrganic, SearchError } from '../search.js';

const raw = {
 searchParameters: { q: 'example' },
 ads: [{ title: 'Paid ad', link: 'https://example.com/ad' }],
 organic: [
 { position: 1, title: ' First result ', link: 'https://example.com/a', snippet: ' Introduction. ' },
 { position: 2, title: 'Second result', link: 'https://example.com/b', snippet: 'Context.' }
 ],
 peopleAlsoAsk: [{ title: 'Other panel' }]
};

test('query normalization', () => {
 assert.equal(validateQuery(' Google search\n results '), 'Google search results');
});

test('rejects invalid queries', () => {
 for (const value of ['', 'a', ' ', null, 42, 'a'.repeat(161)]) {
 assert.throws(() => validateQuery(value), (e) => e instanceof SearchError && e.status === 400);
 }
});

test('correct output schema includes only organic results, no ads or other panels', () => {
 const out = normalizeOrganicResults(raw, 'example', new Date('2026-10-18T12:00:00.000Z'));
 assert.deepEqual(out, {
 query: 'example',
 fetchedAt: '2026-10-18T12:00:00.000Z',
 source: 'Google organic results via Serper API (first page)',
 count: 2,
 results: [
 { position: 1, title: 'First result', url: 'https://example.com/a', snippet: 'Introduction.' },
 { position: 2, title: 'Second result', url: 'https://example.com/b', snippet: 'Context.' }
 ]
 });
 assert.equal(JSON.stringify(out).includes('Paid ad'), false);
 assert.equal(JSON.stringify(out).includes('Other panel'), false);
});

test('drops duplicates and malformed provider results, caps at ten', () => {
 const organic = [
 { title: 'Wrong protocol', link: 'javascript:alert(1)' },
 { title: '', link: 'https://example.com/empty' },
 ...Array.from({ length: 15 }, (_, i) => ({ title: `Title ${i}`, link: `https://example.com/${i}` })),
 { title: 'Duplicate', link: 'https://example.com/0' }
 ];
 const out = normalizeOrganicResults({ organic }, 'test');
 assert.equal(out.count, 10);
 assert.deepEqual(out.results.map((item) => item.position), [1,2,3,4,5,6,7,8,9,10]);
 assert.equal(new Set(out.results.map((item) => item.url)).size, 10);
});

test('invalid provider schema fails safely', () => {
 assert.throws(() => normalizeOrganicResults({ ads: [] }, 'a'), (e) => e.status === 502);
});

test('provider request uses first page and returns testable structured output', async () => {
 let captured;
 const fakeFetch = async (url, options) => {
 captured = { url, options };
 return { ok: true, json: async () => raw };
 };
 const out = await searchGoogleOrganic(' test phrase ', {
 apiKey: 'fake-test-key', fetchImpl: fakeFetch, now: () => new Date('2026-10-18T12:00:00.000Z')
 });
 assert.equal(captured.url, 'https://google.serper.dev/search');
 assert.equal(captured.options.headers['X-API-KEY'], 'fake-test-key');
 assert.deepEqual(JSON.parse(captured.options.body), { q: 'test phrase', gl: 'cz', hl: 'cs', num: 10, page: 1 });
 assert.equal(out.results.length, 2);
});

test('no API key fails with a clear 503 rather than fake data', async () => {
 await assert.rejects(
 () => searchGoogleOrganic('something', { apiKey: '' }),
 (e) => e.status === 503
 );
});

test('remote provider failure fails safely', async () => {
 await assert.rejects(
 () => searchGoogleOrganic('something', { apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 429 }) }),
 (e) => e.status === 502
 );
});
