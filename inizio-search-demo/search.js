export class SearchError extends Error {
 constructor(message, status = 500) {
 super(message);
 this.name = 'SearchError';
 this.status = status;
 }
}

const HTTP_URL = /^https?:\/\//i;

export function validateQuery(value) {
 if (typeof value !== 'string') {
 throw new SearchError('Search query must be text.', 400);
 }
 const q = value.trim().replace(/\s+/g, ' ');
 if (q.length < 2 || q.length > 160) {
 throw new SearchError('Use 2 to 160 characters.', 400);
 }
 return q;
}

// The provider returns ads and non-organic features in separate fields.
// Only its `organic` array is intentionally used for export.
export function normalizeOrganicResults(providerResponse, query, now = new Date()) {
 const organic = providerResponse?.organic;
 if (!Array.isArray(organic)) {
 throw new SearchError('Search provider returned an invalid response.', 502);
 }
 const seen = new Set();
 const results = [];

 for (const item of organic) {
 if (results.length === 10) break;
 if (!item || typeof item !== 'object') continue;
 const url = typeof item.link === 'string' ? item.link.trim() : '';
 const title = typeof item.title === 'string' ? item.title.trim() : '';
 if (!HTTP_URL.test(url) || !title || seen.has(url)) continue;
 seen.add(url);
 results.push({
 position: Number.isInteger(item.position) && item.position > 0
 ? item.position
 : results.length + 1,
 title,
 url,
 snippet: typeof item.snippet === 'string' ? item.snippet.trim() : ''
 });
 }

 return {
 query,
 fetchedAt: now.toISOString(),
 source: 'Google organic results via Serper API (first page)',
 count: results.length,
 results
 };
}

export async function searchGoogleOrganic(query, {
 apiKey = process.env.SERPER_API_KEY,
 fetchImpl = globalThis.fetch,
 now = () => new Date()
} = {}) {
 const q = validateQuery(query);
 if (!apiKey) {
 throw new SearchError('Search provider is not configured. Set SERPER_API_KEY.', 503);
 }
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 12000);
 let response;
 try {
 response = await fetchImpl('https://google.serper.dev/search', {
 method: 'POST',
 headers: {
 'X-API-KEY': apiKey,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ q, gl: 'cz', hl: 'cs', num: 10, page: 1 }),
 signal: controller.signal
 });
 } catch {
 throw new SearchError('Search provider is unavailable. Please try again.', 502);
 } finally {
 clearTimeout(timeoutId);
 }

 if (!response?.ok) {
 throw new SearchError('Search provider could not process the request.', 502);
 }
 let raw;
 try {
 raw = await response.json();
 } catch {
 throw new SearchError('Search provider returned invalid JSON.', 502);
 }
 return normalizeOrganicResults(raw, q, now());
}
