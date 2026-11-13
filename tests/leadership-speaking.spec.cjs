const { test, expect } = require('@playwright/test');

async function fillBrief(page) {
  await page.locator('#company').fill('Synthetic QA Organisation');
  await page.locator('#problem').fill('We need to agree responsibilities during cross-team handovers.');
}

for (const lang of ['cs', 'en']) {
  for (const width of [390, 1440]) {
    test(`leadership offer is readable and actionable in ${lang} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/corporate/leadership/?lang=' + lang);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toContainText(lang === 'cs' ? 'motivace k akci' : 'motivation to act');
      await expect(page.locator('.ls-package')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('[data-format="workshop"]').click();
      await expect(page.locator('#format')).toHaveValue('workshop');
      await expect(page.locator('#company')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test(`leadership ${lang} brief preserves selected service and clean campaign source without submitting`, async ({ page }) => {
    const submissions = [];
    page.on('request', request => { if (request.method() !== 'GET') submissions.push(request.url()); });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async text => { window.copiedBrief = text; } }, configurable: true
      });
    });
    await page.goto('/corporate/leadership/?lang=' + lang + '&src=suhr_speaker&utm_source=suhr&utm_campaign=leadership2026&utm_medium=not%40an.email');
    await page.locator('[data-format="workshop"]').click();
    await fillBrief(page);
    await page.locator('#audience').fill('12 specialists');
    await page.locator('#deliveryLanguage').selectOption(lang);
    await page.locator('#copy-brief').click();
    const copied = await page.evaluate(() => window.copiedBrief);
    expect(copied).toContain('To: chereshnev.biochem@gmail.com');
    expect(copied).toContain('Synthetic QA Organisation');
    expect(copied).toContain('src: suhr_speaker');
    expect(copied).toContain('utm_source: suhr');
    expect(copied).not.toContain('not@an.email');
    expect(copied).toContain(lang === 'cs' ? 'Workshop · od 28 000 Kč' : 'Workshop · from 28,000 CZK');
    await expect(page.locator('#brief-status')).toContainText(lang === 'cs' ? 'Zatím nebylo nic odesláno' : 'Nothing has been sent yet');
    expect(submissions).toEqual([]);
  });
}

test('leadership copy refusal offers selected manual text and keeps required fields meaningful', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new Error('clipboard denied'); } }, configurable: true
    });
  });
  await page.goto('/corporate/leadership/?lang=en');
  await fillBrief(page);
  await page.locator('#company').fill('   ');
  await page.locator('#copy-brief').click();
  expect(await page.locator('#company').evaluate(el => el.checkValidity())).toBe(false);
  await expect(page.locator('#copy-output')).toBeHidden();
  await page.locator('#company').fill('Synthetic QA Organisation');
  await page.locator('#copy-brief').click();
  await expect(page.locator('#brief-status')).toContainText('Automatic copying is unavailable');
  expect(await page.locator('#brief-text').evaluate(el => el.selectionEnd - el.selectionStart > 100)).toBe(true);
  await page.locator('[data-lang="cs"]').click();
  await expect(page.locator('#company')).toHaveValue('Synthetic QA Organisation');
  expect(await page.locator('#brief-text').inputValue()).toContain('Poptávka: Leadership');
  await expect(page.locator('#brief-status')).toContainText('Automatické kopírování není dostupné');
});

test('corporate catalogue leads to the dedicated leadership offer in Czech', async ({ page }) => {
  await page.goto('/corporate/?lang=cs');
  await page.locator('#leadership-preview [data-locale="cs"] a').click();
  await expect(page).toHaveURL(/\/corporate\/leadership\/\?lang=cs/);
  await expect(page.locator('h1')).toContainText('Leadership, komunikace');
});

test.describe('leadership without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('shows direct email and keeps the unavailable brief builder hidden', async ({ page }) => {
    const leaked = [];
    page.on('request', request => { if (/company=|problem=/.test(request.url())) leaked.push(request.url()); });
    await page.goto('/corporate/leadership/');
    await expect(page.locator('noscript')).toBeVisible();
    await expect(page.locator('a[href="mailto:chereshnev.biochem@gmail.com"]')).toBeVisible();
    await expect(page.locator('#leadership-brief')).toBeHidden();
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /form-action 'none'/);
    expect(leaked).toEqual([]);
    expect(new URL(page.url()).searchParams.has('company')).toBe(false);
  });
});
