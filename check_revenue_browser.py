"""Mobile and desktop smoke checks for corporate landing, optional Playwright."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
url=(root/"corporate"/"index.html").as_uri()
with sync_playwright() as p:
    browser=p.chromium.launch(channel="chrome",headless=True)
    for width,height in [(390,844),(768,1024),(1365,860)]:
        page=browser.new_page(viewport={"width":width,"height":height},device_scale_factor=1)
        page.goto(url,wait_until="domcontentloaded",timeout=15000)
        page.wait_for_timeout(250)
        overflow=page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 2")
        cta=page.locator("a[href*='1FAIpQLSfa3qOW']").first
        assert cta.is_visible(),"primary CTA invisible"
        assert not overflow,"horizontal overflow at %dpx"%width
        page.locator("[data-lang='cs']").click()
        assert page.locator("h1:visible").inner_text().startswith("Firemní")
        page.locator("[data-lang='ru']").click()
        assert page.locator("h1:visible").inner_text().startswith("Корпоративное")
        assert page.locator("h1:visible").bounding_box()["width"]<=width
        print("PASS viewport",width,"no-overflow + languages + CTA")
        page.close()
    browser.close()
