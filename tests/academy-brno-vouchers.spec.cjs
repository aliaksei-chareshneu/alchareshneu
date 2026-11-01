const {test,expect}=require("@playwright/test");

test.describe("Brno iD parental voucher education offer",()=>{
  test("links an official provider to a nonbinding Academy child-class enquiry",async({page})=>{
    await page.goto("/academy/");
    await expect(page.locator("#brno-parent-vouchers")).toBeVisible();
    await expect(page.locator("#brno-parent-vouchers a")).toHaveAttribute("href","rodicovske-vouchery/?lang=en");
    await page.goto("/academy/rodicovske-vouchery/?lang=cs");
    await expect(page.getByRole("heading",{level:1})).toContainText("Rodičovské vouchery");
    await expect(page.locator("#lead")).toContainText("20 %");
    await expect(page.locator("#dates")).toContainText("30. listopadu");
    await expect(page.locator("#math")).toContainText(/2[ ,]520 Kč/);
    await expect(page.locator("#cta")).toHaveAttribute("href",/docs\.google\.com\/forms/);
    await expect(page.locator("#official")).toHaveAttribute("href","https://www.brnoid.cz/cs/rodicovske-vouchery");
    await expect(page.locator("#directory")).toHaveAttribute("href","https://www.brnoid.cz/cs/rv-info");
    await expect(page.locator('input[type="password"], input[name*="rodne"], input[name*="birth"]')).toHaveCount(0);
    await expect(page.locator('a[href*="stripe.com"]')).toHaveCount(0);
    await expect(page.locator("#warning")).toContainText("Družina Moravy z. s.");
  });

  test("all four languages display the caveat and deadlines without duplicated content",async({page})=>{
    await page.goto("/academy/rodicovske-vouchery/");
    const cases=[["cs","Rodičovské vouchery","30. listopadu"],["en","parental vouchers","30 November"],["ru","Ваучеры","30 ноября"],["uk","Ваучери","30 листопада"]];
    for(const [lang,title,deadline] of cases){
      await page.locator('[data-lang="'+lang+'"]').click();
      await expect(page.getByRole("heading",{level:1})).toContainText(title);
      await expect(page.locator("#dates")).toContainText(deadline);
      await expect(page.locator("#math")).toContainText(/2[ ,]520 Kč/);
      await expect(page.locator("#warning")).toContainText("Družina Moravy z. s.");
      await expect(page.locator('[data-lang="'+lang+'"]')).toHaveAttribute("aria-pressed","true");
    }
    const x=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(x).toBeLessThanOrEqual((await page.evaluate(()=>window.innerWidth)));
  });
});
