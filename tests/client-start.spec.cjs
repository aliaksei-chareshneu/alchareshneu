const { test, expect } = require('@playwright/test');

for (const lang of ['en', 'cs', 'ru', 'uk']) {
  for (const width of [320, 375, 390, 768]) {
    test(`client start ${lang} ${width}px: clear choice and no overflow`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewportSize({ width, height: 850 });
      await page.goto('/start/?lang=' + lang);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('.locale:visible')).toHaveCount(1);
      await expect(page.locator('.locale:visible h1')).toHaveCount(1);
      await expect(page.locator('.locale:visible .card')).toHaveCount(4);
      await expect(page.locator('.locale:visible .primary')).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      for (const link of await page.locator('.locale:visible .primary').all()) {
        const href = await link.getAttribute('href');
        expect(href).toMatch(/^(?:mailto:|https:\/\/(?:wa\.me|t\.me)\/|\.\.\/corporate\/request\/\?)/);
        expect(href).not.toMatch(/^https:\/\/(?:revolut\.me|checkout\.)/i);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('client start language chooser and accessible controls', async ({ page }) => {
  await page.goto('/start/?lang=cs');
  await expect(page.locator('.locale:visible')).toHaveAttribute('lang', 'cs');
  await page.locator('[data-lang="ru"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('[data-lang="ru"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.locale:visible .card')).toHaveCount(4);
  await expect(page.locator('.locale:visible footer a')).toHaveAttribute('href', '../');
});

test('home hero and sticky customer path keep active language', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.route('https://script.google.com/**', route => {
    const cb = new URL(route.request().url()).searchParams.get('callback');
    return route.fulfill({ contentType: 'application/javascript', body: `${cb}({"events":[]})` });
  });
  await page.goto('/?lang=ru');
  await expect(page.locator('#heroCorporateCta')).toHaveAttribute('href', 'start/?lang=ru');
  await expect(page.locator('#navBookBtn')).toHaveAttribute('href', 'start/?lang=ru');
  await expect(page.locator('#mobileCta .mobile-cta-btn')).toHaveAttribute('href', 'start/?lang=ru');
  await page.locator('#heroCorporateCta').click();
  await expect(page).toHaveURL(/\/start\/\?lang=ru$/);
  await expect(page.locator('.locale:visible')).toHaveAttribute('lang', 'ru');
  expect(errors).toEqual([]);
});


test('a direct free HEMA workshop route exists in all four languages', async ({ page }) => {
  for (const lang of ['en', 'cs', 'ru', 'uk']) {
    await page.goto('/start/?lang=' + lang);
    const eventLink = page.locator('.locale:visible .card').nth(3).locator('a.secondary[href^="../druzina/start/"]');
    await expect(eventLink).toHaveCount(1);
    const href = new URL(await eventLink.getAttribute('href'), page.url());
    expect(href.pathname).toMatch(/\/druzina\/start\/$/);
    expect(href.searchParams.get('lang')).toBe(lang);
    expect(href.searchParams.get('src')).toBe('start_nov14');
  }
});

test('source labels survive language switch and follow-up routes without a tracking pixel', async ({ page }) => {
  await page.goto('/start/?lang=en&utm_source=instagram&utm_medium=profile&utm_campaign=nov2026');
  const corporate = new URL(await page.locator('.locale:visible .card').first().locator('a.primary').getAttribute('href'), page.url());
  expect(corporate.searchParams.get('src')).toBe('start_company');
  expect(corporate.searchParams.get('utm_source')).toBe('instagram');
  expect(corporate.searchParams.get('utm_medium')).toBe('profile');
  expect(corporate.searchParams.get('utm_campaign')).toBe('nov2026');

  const message = new URL(await page.locator('.locale:visible .card').nth(1).locator('a.primary').getAttribute('href'));
  expect(message.searchParams.get('text')).toContain('[IMPERION source: utm_source=instagram&utm_medium=profile&utm_campaign=nov2026]');

  await page.locator('.langs a[data-lang="cs"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  const czechEvent = new URL(await page.locator('.locale:visible .card').nth(3).locator('a.secondary[href^="../druzina/start/"]').getAttribute('href'), page.url());
  expect(czechEvent.searchParams.get('utm_source')).toBe('instagram');
  expect(czechEvent.searchParams.get('src')).toBe('start_nov14');
});

test('suspicious attribution values are rejected and never sent to messengers', async ({ page }) => {
  await page.goto('/start/?lang=en&utm_source=bad%20source%0D%0Aemail%3Dprivate&utm_campaign=nov2026');
  const message = new URL(await page.locator('.locale:visible .card').nth(1).locator('a.primary').getAttribute('href'));
  expect(message.searchParams.get('text')).not.toContain('private');
  expect(message.searchParams.get('text')).toContain('utm_campaign=nov2026');
  const corporate = new URL(await page.locator('.locale:visible .card').first().locator('a.primary').getAttribute('href'), page.url());
  expect(corporate.searchParams.has('utm_source')).toBe(false);
});
