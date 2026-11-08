// IMPERION temporary zero-cost Cloudflare Worker: public synthetic CPU smoke only.
// No secrets, databases, external requests, cookies, user input persistence or billing.
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  "x-content-type-options": "nosniff" };
const answer = (status, obj) => new Response(JSON.stringify(obj), { status, headers });
function countPrimes(max) {
  let count = 0;
  for (let n = 2; n <= max; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) count++;
  }
  return count;
}
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") return answer(200, {
      status: "LIVE", application: "imperion-free-cloudflare-smoke", version: "2026-11-08",
      runtime: "cloudflare-worker-temporary", external_requests: false });
    if (path !== "/compute" || request.method !== "POST") return answer(404, { status: "NOT_FOUND" });
    if (Number(request.headers.get("content-length") || 0) > 2048) return answer(413, { status: "TOO_LARGE" });
    const raw = await request.text();
    if (raw.length > 2048) return answer(413, { status: "TOO_LARGE" });
    let data; try { data = JSON.parse(raw); } catch { return answer(400, { status: "INVALID_JSON" }); }
    if (data && data.op === "primes" && Number.isInteger(data.n) && data.n >= 2 && data.n <= 1000)
      return answer(200, { status: "EXECUTED", op: "primes", n: data.n,
        prime_count: countPrimes(data.n), external_requests: false });
    if (data && data.op === "sha256" && typeof data.text === "string" && data.text.length <= 1024) {
      const bytes = new TextEncoder().encode(data.text);
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return answer(200, { status: "EXECUTED", op: "sha256",
        sha256: Array.from(hash, b => b.toString(16).padStart(2, "0")).join(""), external_requests: false });
    }
    return answer(400, { status: "OP_NOT_ALLOWED" });
  }
};
