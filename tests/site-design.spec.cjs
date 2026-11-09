const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function isolateExternalWidgets(page) {
  await page.route('https://script.google.com/**', route => {
    const callback = new URL(route.request().url()).searchParams.get('callback');
    return route.fulfill({contentType:'application/javascript', body:callback ? `${callback}({events:[]})` : '{}'});
  });
  await page.route('https://calendar.google.com/**', route => route.fulfill({contentType:'text/html', body:'Calendar fixture'}));
}

for (const language of ['en', 'cs', 'ru', 'uk']) {
  test(`redesigned home keeps both audience choices in the phone viewport: ${language}`, async ({page}) => {
    await isolateExternalWidgets(page);
    await page.setViewportSize({width:390, height:844});
    await page.goto('/?lang=' + language);
    await expect(page.locator('.site-menu-toggle')).toBeVisible();
    await expect(page.locator('#site-navigation')).toBeHidden();
    for (const id of ['heroCta', 'heroCorporateCta']) {
      const box = await page.locator('#' + id).boundingBox();
      expect(box.y).toBeGreaterThan(0);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({width, height:900});
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    expect(await page.locator('#main .site-mosaic img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  });

  test(`Druzina primary action stays compact and reachable on a phone: ${language}`, async ({page}) => {
    await isolateExternalWidgets(page);
    await page.setViewportSize({width:390, height:844});
    await page.goto('/druzina/?lang=' + language);
    const box = await page.locator('#druzina .dm-v2-primary').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(54);
    expect(box.height).toBeLessThanOrEqual(84);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await expect(page.locator('#druzina .dm-v2-primary')).toHaveAttribute('href', 'prihlaska/?lang=' + language);
  });

  test(`Academy booking is reachable in the first phone viewport: ${language}`, async ({page}) => {
    await isolateExternalWidgets(page);
    await page.setViewportSize({width:375, height:812});
    await page.goto('/academy/?lang=' + language);
    const box = await page.locator('#academy .hero-ctas .btn.solid').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(812);
  });
}

for (const route of ['/', '/academy/', '/walkers/', '/druzina/', '/calendar/']) {
  test(`mobile navigation is accessible, localized and recovers on resize: ${route}`, async ({page}) => {
    await isolateExternalWidgets(page);
    await page.setViewportSize({width:375, height:812});
    await page.goto(route + '?lang=en');
    const menu = page.locator('.site-menu-toggle');
    const navigation = page.locator('#site-navigation');
    await expect(menu).toHaveAttribute('aria-label', 'Open navigation');
    await menu.click();
    await expect(navigation).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(navigation).toBeHidden();
    await expect(menu).toBeFocused();
    await page.locator('#langSwitch [data-lang="ru"]').click();
    await expect(menu).toHaveAttribute('aria-label', 'Открыть меню');
    await menu.click();
    await expect(navigation).toHaveAttribute('aria-label', 'Главная навигация');
    await page.setViewportSize({width:1280, height:900});
    await expect(menu).toBeHidden();
    await expect(navigation).toBeVisible();
    await page.setViewportSize({width:375, height:812});
    await expect(navigation).toBeHidden();
    await menu.click();
    await navigation.locator('a').filter({hasText:/Academy|Академия/}).first().click();
    await expect(page).toHaveURL(/academy/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });
}

test('navigation and primary links remain available without JavaScript', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled:false, viewport:{width:375, height:812}});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8000/');
  await expect(page.locator('.tabs-bar')).toBeVisible();
  await expect(page.locator('.site-menu-toggle')).toHaveCount(0);
  await expect(page.locator('#heroCta')).toBeVisible();
  await page.locator('.tabs-bar a[href="academy/"]').click();
  await expect(page).toHaveURL(/academy/);
  await context.close();
});

test('every public page resolves the new stylesheet inside the existing site', async () => {
  const ignored = new Set(['.git', '.github', 'node_modules', 'test-results', 'playwright-report']);
  let count = 0;
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      if (ignored.has(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.html') && entry.name !== 'RegistrationPortal.html') {
        const html = fs.readFileSync(file, 'utf8');
        const matches = [...html.matchAll(/href="([^"]*site-design\.css\?v=20261027)"/g)];
        expect(matches, file).toHaveLength(1);
        const relative = matches[0][1].split('?')[0];
        const resolved = relative.startsWith('/alchareshneu/') ? relative.slice('/alchareshneu/'.length) : path.normalize(path.join(path.dirname(file), relative));
        expect(resolved, file).toBe('site-design.css');
        count++;
      }
    }
  }
  visit('.');
  expect(count).toBeGreaterThanOrEqual(37);
});
