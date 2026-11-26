# Družina Moravy z. s. — Ad Grants mission website (DRAFT, NOT LIVE)

This is a **standalone, Czech-language, static nonprofit website** for deployment as the root content of a separate NGO-controlled hosting repository. It is NOT an extension of the OSVČ commercial service, and it is NOT already approved by Google. Source copy is distinct from the existing commercial site. All HTML and CSS are local, without analytics, ads, cookies, external images, third-party fonts, or a fake checkout.

## Pages

- index.html — nonprofit mission, public participation, corporate support
- programy.html — public historical and educational program themes, safety, participant enquiries and FAQ
- podpora.html — lawful funding pathways, donated sponsorship vs paid advertising, company enquiry
- o-spolku.html — identity, purpose, transparent division from the chair's OSVČ
- kontakt.html — verified association contact and three different enquiry reasons
- ochrana-soukromi.html — privacy information for a static email-only site
- assets/site.css — responsive site styles
- robots.txt / sitemap.xml — intended production root only

Actual contact: chereshnev.biochem@gmail.com (already publicly listed on the association's existing site). All mailto actions open the visitor's own email client; they do **not** send automatically, collect server-side leads, create a booking, or prove a conversion. NO newsletter or commercial audience transfer is enabled.

### Data confirmed in existing public association site

Družina Moravy, z. s., IČO 29876150, registered office Příkop 838/6, 602 00 Brno, Krajský soud v Brně, oddíl L, vložka 32290. The association and Aliaksei Chareshneu OSVČ (IČO 23041625) are separate. These facts were checked against the existing GitHub Pages source. Before go-live re-check the public register and statutes.

## What this is NOT

No guarantee of approval. No promise of free sessions without secured financing. No transfer of personal business leads to the NGO or vice versa. No automated ad campaigns, donation bank details, invented form/checkout, Meta pixel, AdSense or third-party lead generator. No Google Ad Grants participant badge before approval.

## Before publication — owner-controlled GO gates

1. **Legal / factual approval.** Check exact statutes, authority of board, youth safety, GDPR, privacy and current public-register data. The page must remain a truthful description of NGO activities, including independent public value.
2. **NGO domain control.** Confirm `druzinamoravy.cz` DNS administrative access and registrar; do not modify unrelated MX/TXT/SPF/DKIM/DMARC, phone/admin verification or existing Workspace onboarding.
3. **Separate hosting.** Create a new nonprofit-owned repository (preferably owned by the legal entity's Github organization; allow at least two authorized administrators), and copy the CONTENTS of this directory to its repository ROOT. Do not assign the NGO custom domain to the existing mixed personal/OSVČ repository, where it could alter the current Pages site.
4. **Custom domain security.** In the new repository, follow GitHub's documented custom-domain verification and Pages settings, then set its custom domain before changing DNS. GitHub Pages can use apex A records 185.199.108.153 / 109.153 / 110.153 / 111.153 and www CNAME to the host `<owner>.github.io`, but verify the latest values in GitHub Docs and actual provider settings before changing anything.
5. **HTTPS readback.** Confirm actual 200 response at https://druzinamoravy.cz/, correct certificate, /programy.html, /podpora.html, /o-spolku.html, /kontakt.html, /ochrana-soukromi.html, no redirect to the commercial site, working email CTAs, correct mobile display.
6. **Google Ad Grants criteria.** Review https://support.google.com/nonprofits/answer/1657899 and https://support.google.com/nonprofits/answer/18865830 for unique content, site quality, navigation, clear mission, contact, HTTPS, accessible public benefit, no excessive commercial services, valid disclosures. Google has final discretion.
7. **Apply once.** In the existing Google for Nonprofits account, Ad Grants > Website > enter ONLY `https://druzinamoravy.cz/` once verified > orientation > submit. Do not independently create Google Ads or attach a card. Get provider readback.
8. **Conversions after approval.** Start with meaningful NGO actions (confirmed partner enquiries, appropriate nonprofit registrations, approved donations). Mailto-click tracking by itself is a weak proxy and must not be presented as a verified enquiry or income. If using a real form, get controller, purpose, storage, retention, DPA and privacy sorted first. Google Analytics / Google Ads tags may require an additional consent/CMP assessment.

## Program economics: funded participation

The **payer** can be a donor, company or grant provider; **recipient** of funding is the NGO under its legal arrangements. The **NGO** may pay professional suppliers on an appropriately approved, commercially reasonable contract and evidence; conflicts of interest must be declared and governed. If the supplier is the chair's OSVČ, separate contractor invoice/contract, documented work, independent price check and decision by an authorized organ are critical. The NGO subsidy is never the chair's personal bank cash by itself.

Before offering a free workshop calculate at least:
`total_funding_need = expert_delivery + preparation + travel + safety/equipment + space + admin/coordination + applicable taxes/insurance + contingency`.
For example, 10 participant slots formerly priced at 240 Kč represent 2400 Kč **illustrative face-value revenue**; this does NOT establish the actual cost or legal transfer price. Sponsorship must cover real scope, not just a nominal replacement of a participant's payment.

Different payment types:
- Genuine gift with no contracted publicity = potentially charitable gift; tax status requires review
- Paid promotion/publicity to a company = advertising/sponsorship service; taxation differs from gifts
- Public grant = restricted money under grant conditions; possible eligible labor only where documented/allowed
- NGO participation fee = distinct from OSVČ individual service and from membership dues; do not relabel it as membership for tax avoidance

Owner decision, current scope and written terms **before** any real fundraising, sponsor promise, paid onboarding, receipt of funds, or external ad. NO legal or tax final advice is implied.

## Funnel owner and source boundaries

Google Ad Grants => nonprofit mission search traffic => NGO public program enquiry / authentic corporate donor enquiry => QUALIFIED => OFFER / grant or gift terms => CONTRACTED => DELIVERED => INVOICED / RECEIPTED => BANK VERIFIED NGO funds => lawful contracted supplier payment => OSVČ BANK VERIFIED => personal NET after costs, taxes, ALL HOURS.

Google Ad Grants advertising must NOT be a disguised paid-OSVČ lead funnel, even if the site carries a disclosure. Separate paid OSVČ campaigns must use independently funded ads, independent contact source and consent. Grants are not bank cash.

## Done definition

**GENERATED + draft branch**, not READY/LIVE/Ad-Grants-approved. Launch requires site/domain live readback, legal/governance check, exact grant portal submission evidence and subsequent Google approval.
