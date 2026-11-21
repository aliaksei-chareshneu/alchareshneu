const{test,expect}=require("@playwright/test");

test("Druzina rank chart renders, toggles categories and localises",async({page})=>{
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto("/druzina/ranks.html?lang=en");
 const chart=page.locator('#dm-rank-visualisation [data-chart="ranks"]');
 await expect(chart).toBeVisible({timeout:15000});
 await expect(page.getByRole("heading",{name:"Explore the rank system"})).toBeVisible();
 const toggle=page.getByRole("button",{name:"Include A achievements"});
 await expect(toggle).toBeVisible();
 await toggle.click();
 await expect(toggle).toHaveAttribute("aria-pressed","true");
 await expect(chart).toHaveAttribute("aria-label",/A · Achievements: 10/);
 await page.locator('.langs button[data-lang="ru"]').click();
 await expect(page.getByRole("heading",{name:"Карта системы званий"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Включая достижения A"})).toHaveAttribute("aria-pressed","true");
 expect(errors).toEqual([]);
});

test("reduced motion and mobile size preserve the chart and no-CDN fallback",async({page})=>{
 await page.setViewportSize({width:390,height:800});
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.goto("/druzina/ranks.html?lang=cs");
 await expect(page.locator('#dm-rank-visualisation [data-chart="ranks"]')).toBeVisible({timeout:15000});
 await expect(page.locator(".dm-viz-static summary")).toBeVisible();
 const size=await page.locator("#dm-rank-structure").evaluate(node=>({
  inner:node.clientWidth,scroll:node.scrollWidth
 }));
 expect(size.scroll).toBeLessThanOrEqual(size.inner+2);
 const remote=await page.locator('script[src]').evaluateAll(nodes=>
  nodes.map(x=>x.src).filter(x=>/esm\.sh|jsdelivr|unpkg/.test(x)));
 expect(remote).toEqual([]);
});
