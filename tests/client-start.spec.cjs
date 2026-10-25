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
        expect(href).toMatch(/^(?:mailto:|https:\/\/(?:wa\.me|t\.me)\/)/);
        expect(href).not.toMatch(/revolut|checkout|payment/i);
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
