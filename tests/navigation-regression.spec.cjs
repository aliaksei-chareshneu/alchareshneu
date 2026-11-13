const {test, expect} = require('@playwright/test');

const languages = ['en', 'cs', 'ru', 'uk'];

for (const language of languages) {
  test(`home links to visible Druzina enquiry information in ${language}`, async ({page}) => {
    await page.goto('/?lang=' + language);
    const enquiry = page.locator('#quick-links a[href="druzina/#registration-notice"]');
    await expect(enquiry).toBeVisible();
    await expect(page.locator('#quick-links a[href*="#tariff"]')).toHaveCount(0);
    await enquiry.click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('#registration-notice')).toBeVisible();
    await expect(page.locator(`#registration-notice [data-notice-lang="${language}"]`)).toBeVisible();
  });
}

test('service enquiries retain the selected subject across contact channels and languages', async ({page}) => {
  await page.goto('/academy/?lang=en');
  for (const language of ['en', 'ru', 'cs', 'ru', 'uk', 'en']) {
    await page.locator(`#langSwitch [data-lang="${language}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('.service-action')).toHaveCount(9);
    const enquiries = await page.locator('.service-action').evaluateAll(links => links.map(link => ({
      title: link.closest('.price-cat').querySelector('h3').textContent.trim(),
      href: link.href
    })));
    for (const enquiry of enquiries) {
      const url = new URL(enquiry.href);
      expect(url.hostname).toBe(language === 'ru' ? 't.me' : 'wa.me');
      expect(url.searchParams.get('text')).toBe(enquiry.title);
    }
  }
});

for (const path of ['corporate/', 'corporate/technical-answers/']) {
  test(`${path} remembers language on reload and on returning home`, async ({page}) => {
    await page.goto('/' + path + '?lang=en&utm_source=navigation-test#' + (path.includes('technical') ? 'brief' : 'ai-pilot'));
    for (const language of ['ru', 'cs', 'uk', 'en']) {
      await page.locator(`button[data-lang="${language}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      const url = new URL(page.url());
      expect(url.searchParams.get('lang')).toBe(language);
      expect(url.searchParams.get('utm_source')).toBe('navigation-test');
      expect(url.hash).toBe(path.includes('technical') ? '#brief' : '#ai-pilot');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await page.locator('a.brand, .brand a').first().click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await page.goto('/' + path + '?utm_source=navigation-test#' + (path.includes('technical') ? 'brief' : 'ai-pilot'));
      await expect(page.locator('html')).toHaveAttribute('lang', language);
    }
  });

  test(`${path} works when local storage is unavailable`, async ({page}) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      for (const method of ['getItem', 'setItem']) {
        Storage.prototype[method] = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
      }
    });
    await page.goto('/' + path + '?lang=ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await page.locator('button[data-lang="cs"]').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
    expect(errors).toEqual([]);
  });
}
