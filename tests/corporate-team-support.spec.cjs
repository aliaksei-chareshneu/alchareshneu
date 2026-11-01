const {test,expect}=require("@playwright/test");

test.describe("Corporate monthly team support from existing product",()=>{
  test("shows approved scoped retainer in four languages with nonbinding site enquiry",async({page})=>{
    for(const [lang,cue] of [
      ["en","Monthly AI Team Support"],["cs","Měsíční AI podpora týmu"],
      ["ru","Ежемесячная AI-поддержка"],["uk","Щомісячна AI-підтримка"]
    ]){
      await page.goto("/corporate/?lang="+lang);
      const offer=page.locator('#ai-team-support [data-locale="'+lang+'"]');
      await expect(offer).toBeVisible();
      await expect(offer).toContainText(cue);
      await expect(offer).toContainText("9 900 Kč");
      const cta=offer.locator("a");
      await expect(cta).toHaveAttribute("href","request/?lang="+lang+"&service=AI_WORKSHOP&src=ai_team_support_9900");
      await expect(offer).not.toContainText("guaranteed savings");
      for(const other of ["en","cs","ru","uk"].filter(x=>x!==lang)){
        await expect(page.locator('#ai-team-support [data-locale="'+other+'"]')).toBeHidden();
      }
    }
    await expect(page.locator('#ai-team-support a[href*="stripe"]')).toHaveCount(0);
  });

  test("request uses existing backend category without selling or taking payment",async({page})=>{
    await page.goto("/corporate/request/?lang=cs&service=AI_WORKSHOP&src=ai_team_support_9900");
    await expect(page.locator("#offer")).toHaveValue("AI_WORKSHOP");
    await expect(page.locator("#svc1")).toContainText("monthly team support");
    await expect(page.locator('form select option[value="AI_TEAM_SUPPORT"]')).toHaveCount(0);
    await expect(page.locator("button[type=submit]")).toBeVisible();
  });
});
