'use strict';
/**
 * NGO Google Ad Grants readiness PRECHECK, not an eligibility certification.
 * Read-only DNS + HTTPS homepage; no credentials, Ads API, spend, or write.
 */
const dns = require('node:dns').promises;
const DEFAULT_DOMAIN = 'druzinamoravy.asso.eu.org';
function validDomain(domain) {
  return typeof domain === 'string' && domain.length <= 253 && domain.length >= 4 &&
    !domain.includes('..') && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(domain) &&
    domain.includes('.') && domain.split('.').every(label => label.length <= 63 && label.length > 0 && !label.startsWith('-') && !label.endsWith('-'));
}
function siteSignals(html) {
  const value = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  return {
    organisation_name: /dru[žz]ina\s+moravy/i.test(value),
    mission: /posl[aá]n[ií]|\bmission\b|\bčinnost\b/i.test(value),
    contact: /mailto:|\bkontakt\b|\bcontact\b/i.test(value),
    privacy: /privacy|gdpr|osobn[ií]ch\s+[úu]daj[ůu]|ochrana\s+osobn/i.test(value),
    ngo_action: /dobrovol|volunteer|\bjoin\b|p[řr]ihl[aá][šs]|registrac/i.test(value),
  };
}
async function preflight(domain = DEFAULT_DOMAIN, adapters = {}) {
  if (!validDomain(domain)) throw new Error('INVALID_DOMAIN');
  const resolveNs = adapters.resolveNs || dns.resolveNs.bind(dns);
  const fetchFn = adapters.fetchFn || globalThis.fetch;
  const out = {domain, checked_at: new Date().toISOString(), real_eligibility_verified: false,
    ad_grants_activated: false, paid_actions: 0, checks: {}, next: '', status: 'BLOCKED'};
  try {
    const servers = await resolveNs(domain);
    if (!Array.isArray(servers) || !servers.length) throw Error('NO_NS');
    out.checks.ns = {ok: true, servers};
  } catch (err) {
    out.checks.ns = {ok: false, error: err.code || err.message || 'DNS_ERROR'};
    out.next = 'Verify approved registrar ownership and public NS delegation; do not start Workspace or Ads.';
    return out;
  }
  try {
    const response = await fetchFn('https://' + domain + '/', {redirect: 'manual', signal: AbortSignal.timeout(10000)});
    const ct = response.headers?.get?.('content-type') || '';
    if (response.status >= 300 && response.status < 400) {
      out.checks.homepage = {ok: false, status: response.status, reason: 'REDIRECT_NOT_EVIDENCE_OF_OWNED_SITE'};
      out.next = 'Host actual HTTPS NGO content directly on the verified domain; recheck site and privacy.';
      return out;
    }
    if (!response.ok || !ct.includes('text/html')) {
      out.checks.homepage = {ok: false, status: response.status, content_type: ct};
      out.next = 'Publish the real NGO HTTPS homepage (not commercial OSVC website).';
      return out;
    }
    const source = await response.text();
    if (source.length > 300000) throw Error('HOMEPAGE_TOO_LARGE');
    const signals = siteSignals(source);
    const missing = Object.entries(signals).filter(([,ok]) => !ok).map(([key]) => key);
    out.checks.homepage = {ok: true, status: response.status, signals, missing};
    out.status = missing.length ? 'CONTENT_REVIEW_REQUIRED' : 'MANUAL_REVIEW_REQUIRED';
    out.next = 'Owner to verify NGO ownership, legal/privacy/consent, Google policies and working Form->CRM E2E before Ads application; no automatic campaign.';
    return out;
  } catch (err) {
    out.checks.homepage = {ok: false, error: err.code || err.message || 'HTTPS_ERROR'};
    out.next = 'Fix TLS/hosting/access and rerun before Ad Grants onboarding.';
    return out;
  }
}
if (require.main === module) preflight(process.argv[2] || DEFAULT_DOMAIN).then(r => {
  console.log(JSON.stringify(r, null, 2));
  if (r.status === 'BLOCKED') process.exitCode = 2;
}).catch(err => {console.error(err.message); process.exitCode = 2;});
module.exports = {validDomain, siteSignals, preflight, DEFAULT_DOMAIN};
