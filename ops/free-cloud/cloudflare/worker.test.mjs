import assert from 'node:assert/strict';
import worker from './worker.mjs';
const base = 'https://example.com';
async function post(data) {
  return worker.fetch(new Request(base + '/compute', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }));
}
const health = await worker.fetch(new Request(base + '/health'));
assert.equal(health.status, 200);
assert.equal((await health.json()).status, 'LIVE');
const primes = await post({ op: 'primes', n: 1000 });
assert.equal(primes.status, 200);
assert.equal((await primes.json()).prime_count, 168);
const sha = await post({ op: 'sha256', text: 'abc' });
assert.equal(sha.status, 200);
assert.equal((await sha.json()).sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
const blocked = await post({ op: 'primes', n: 50000 });
assert.equal(blocked.status, 400);
console.log('LOCAL_SYNTHETIC_TESTS_PASS 4/4');
