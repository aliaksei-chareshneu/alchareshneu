/** Constant-work comparison for Telegram's X-Telegram-Bot-Api-Secret-Token. */
export function validWebhookSecret(received, configured) {
  if (typeof configured !== 'string' || !/^[A-Za-z0-9_-]{20,256}$/.test(configured)) return false;
  if (typeof received !== 'string' || received.length > 512) return false;
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(configured);
  let unequal = a.length ^ b.length;
  for (let i=0, n=Math.max(a.length,b.length);i<n;i++) unequal |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return unequal === 0;
}
export function decodeAllowlist(raw) {
  if (!raw || raw.length > 12000) return {};
  try {
    const config=JSON.parse(raw);
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  } catch { return {}; }
}
