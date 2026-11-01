const {test,expect}=require("@playwright/test");
test.describe("Czech A2 to existing Academy mini-group funnel",()=>{
  test("offers a no-obligation 3-4-person group in all four languages",async({page})=>{
    await page.goto("/academy/a2/");
    const intro=page.locator('#intro [data-t="groupIntro"]');
    await expect(intro).toHaveAttribute("href","../#online-mini-groups");
    await expect(intro).toContainText("3–4");
    await page.locator("#start").click();
    for(let i=0;i<15;i++){
      await page.locator(".choice").first().click();
      await page.locator("#next").click();
    }
    await expect(page.locator("#results")).toBeVisible();
    const group=page.locator("#results .group-promo");
    await expect(group).toContainText("3 150 Kč");
    await expect(group.locator("a")).toHaveAttribute("href","../#online-mini-groups");
    await expect(group).toContainText("není objednávka ani rezervace");
    const phrases=[
      ["en","3,150 Kč","not an order or a booking"],
      ["ru","3 150 Kč","не означает заказ"],
      ["uk","3 150 Kč","не є замовленням"],
      ["cs","3 150 Kč","není objednávka"]
    ];
    for(const [lang,price,warning] of phrases){
      await page.locator('[data-lang="'+lang+'"]').click();
      await expect(group).toContainText(price);
      await expect(group).toContainText(warning);
      await expect(intro).toHaveAttribute("href","../#online-mini-groups");
    }
    const hasDirectCheckout=await group.locator('a[href*="stripe"],a[href*="revolut"]').count();
    expect(hasDirectCheckout).toBe(0);
  });
});
