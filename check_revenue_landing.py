"""Fast release gate for the corporate conversion landing (no external API)."""
from pathlib import Path
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parent
FORM="https://docs.google.com/forms/d/e/1FAIpQLSfa3qOWpQBfoA877ip9eOTWwFweOrNTib2mq8_C1D9xr55dtQ/viewform"
class Parser(HTMLParser):
    def __init__(self):
        super().__init__();self.hrefs=[];self.lang_buttons=set();self.locales=set()
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get("href"):self.hrefs.append(a["href"])
        if a.get("data-lang"):self.lang_buttons.add(a["data-lang"])
        if a.get("data-locale"):self.locales.add(a["data-locale"])
c=(ROOT/"corporate"/"index.html").read_text(encoding="utf8")
a=(ROOT/"academy"/"index.html").read_text(encoding="utf8")
m=(ROOT/"index.html").read_text(encoding="utf8")
p=Parser();p.feed(c)
assert p.lang_buttons==p.locales=={"en","cs","ru"}
assert p.hrefs.count(FORM)>=4
assert '../corporate/' in a and 'corporate/' in m
assert 'class="tab-btn active" href="./" data-i18n="tabs.academy"' in a
assert 'OSVČ, IČO 23041625' in c
assert 'Družina Moravy' not in c
ET.parse(ROOT/"sitemap.xml")
assert 'https://aliaksei-chareshneu.github.io/alchareshneu/corporate/' in (ROOT/"sitemap.xml").read_text()
print("PASS: localized landing, CRM form, nav, legal separation, sitemap XML")
