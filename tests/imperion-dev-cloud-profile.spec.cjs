const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
test('IMPERION owner cloud dev profile is public-only and Draft-PR gated', () => {
  const p=fs.readFileSync('.github/agents/imperion-dev.agent.md','utf8');
  expect(p).toMatch(/^---\nname: imperion-dev\n/);
  for(const term of ['Draft','tests','secrets','BLOCKED','NEVER auto-merge','GitHub'])
    expect(p,term).toContain(term);
  expect(p).not.toContain('auto-merge: true');
  expect(p).not.toContain('payment_method');
});
test('Mobile guide is explicit about Copilot entitlement and PC fallback', () => {
  const s=fs.readFileSync('docs/imperion-dev-android.md','utf8');
  for(const term of ['Android','Assignees','Copilot','BLOCKED',
      'Draft PR','zmrzlina','/imperion-dev build cloud-profile'])
    expect(s,term).toContain(term);
  expect(s).toContain('NOT YET VERIFIED');
});
