const {test,expect}=require("@playwright/test");
test.describe("Czech A2 trainer",()=>{
  test("offers original balanced question bank with safe prices and privacy",async({page})=>{
    await page.goto("/academy/a2/");
    await expect(page.getByRole("heading",{level:1})).toContainText("Rozumíte česky?");
    const audit=await page.evaluate(()=>{
      const bank=window.A2BANK;
      return {len:bank.length,unique:new Set(bank.map(q=>q.id)).size,
        counts:["reading","grammar","situations"].map(cat=>bank.filter(q=>q.cat===cat).length),
        valid:bank.every(q=>q.opts.length===3&&q.a>=0&&q.a<3&&typeof q.why==="string"&&q.why.length>0)};
    });
    expect(audit).toEqual({len:30,unique:30,counts:[10,10,10],valid:true});
    await expect(page.locator("#intro")).toContainText("není oficiální modelový test");
    await expect(page.locator("#results")).toBeHidden();
    await page.locator('[data-lang="ru"]').click();
    await expect(page.getByRole("heading",{level:1})).toContainText("чешский");
    await page.locator('[data-lang="uk"]').click();
    await expect(page.getByRole("heading",{level:1})).toContainText("чеську");
    await page.locator('[data-lang="en"]').click();
    await expect(page.getByRole("heading",{level:1})).toContainText("Czech");
  });
  test("answers, evaluates, and links to confirmed-payment process",async({page})=>{
    await page.setViewportSize({width:375,height:812});
    await page.goto("/academy/a2/");
    await page.locator("#start").click();
    await expect(page.locator("#quiz")).toBeVisible();
    await expect(page.locator("#next")).toBeDisabled();
    for(let i=0;i<15;i++){
      await page.locator(".choice").first().click();
      await expect(page.locator("#feedback")).toBeVisible();
      await expect(page.locator("#next")).toBeEnabled();
      await page.locator("#next").click();
    }
    await expect(page.locator("#results")).toBeVisible();
    await expect(page.locator("#score")).toContainText("/ 15");
    await expect(page.locator("#breakdown .topic-row")).toHaveCount(3);
    await expect(page.locator("#bookLink")).toHaveAttribute("href",/^https:\/\/wa\.me\/420702914842\?text=/);
    await expect(page.locator("#results")).toContainText("300 Kč");
    await expect(page.locator("#results")).toContainText("neplaťte před potvrzením");
    const docwidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(docwidth).toBeLessThanOrEqual(375);
    await page.locator("#restart").click();
    await expect(page.locator("#quiz")).toBeVisible();
  });
});