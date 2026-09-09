# Plausible Analytics — self-hosted setup (Oracle VM)

Source brief: self-email "Plausible" (05.09.2026) — DevOps/Web Analytics prompt
that was drafted but never handed off/executed. This is that plan turned into
an actual runbook for your Oracle Cloud ARM VM (150.230.157.71), which
already runs n8n (Core B).

Site-side work (script tag + named conversion goals) is **already done** in
this zip — see §4/§5. What's left is entirely server-side, on the VM, and I
can't do that part for you (no SSH access from here).

---

## 0. Read first — security + the port question

**Security:** Plausible Community Edition versions before **v3.2.1** have a
critical RCE (CVE-2026-8467) via an exposed `/storybook` endpoint. Everything
below pins `v3.2.1`. Don't use `latest`/`main` blindly later without
checking the CVE list first.

**Ports 80/443 — check before you touch anything:**
n8n may already be sitting on 80/443 via its own reverse proxy. Running
`docker compose up` with Plausible's own automatic-HTTPS grabbing those
ports would silently break your n8n webhooks (invoicing, lead triage). Run
this on the VM **before** doing anything else:

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
```

- **Nothing listed → Path A** (below). Simple, Plausible manages its own TLS.
- **n8n / nginx / caddy already listed → Path B** (below). Plausible runs on
  an internal port only, you add one vhost entry to whatever's already
  fronting n8n.

If you're not sure which it is, paste me the output and I'll tell you which
path to use.

---

## 1. No domain? Use sslip.io (free, real TLS, $0)

Plausible's automatic HTTPS needs a real DNS name pointing at the VM — a
bare IP address can't get a browser-trusted certificate, and the site is
served over HTTPS, so a plain `http://` script would just get silently
blocked by every browser as mixed content.

Free fix, no domain purchase: **sslip.io** resolves `<ip-with-dashes>.sslip.io`
straight back to that IP, and Let's Encrypt happily issues real certificates
for it. Your address:

```
150-230-157-71.sslip.io   →   150.230.157.71
```

This is what the site's script tag already points to (`PLAUSIBLE-SETUP.md`
§4). If you later buy a real domain, swap it in one place (see §7).

---

## 2. Path A — ports 80/443 are free

```bash
# on the VM
git clone -b v3.2.1 --single-branch https://github.com/plausible/community-edition plausible-ce
cd plausible-ce

touch .env
echo "BASE_URL=https://150-230-157-71.sslip.io" >> .env
echo "SECRET_KEY_BASE=$(openssl rand -base64 48)" >> .env
echo "HTTP_PORT=80" >> .env
echo "HTTPS_PORT=443" >> .env

cat > compose.override.yml << 'EOF'
services:
  plausible:
    ports:
      - 80:80
      - 443:443
EOF

docker compose up -d
```

First boot takes a minute or two (DB migrations + cert issuance). Then go
to `https://150-230-157-71.sslip.io`, create your admin account, and add a
site with domain **`aliaksei-chareshneu.github.io`** (that's the real
hostname GitHub Pages serves from — use it exactly, not the custom-looking
one, or pageviews won't match).

---

## 3. Path B — 80/443 already used by n8n's proxy

Run Plausible on an internal-only port and add one entry to whatever's
already fronting n8n, instead of letting Plausible grab 80/443 itself.

```bash
git clone -b v3.2.1 --single-branch https://github.com/plausible/community-edition plausible-ce
cd plausible-ce

touch .env
echo "BASE_URL=https://150-230-157-71.sslip.io" >> .env
echo "SECRET_KEY_BASE=$(openssl rand -base64 48)" >> .env

cat > compose.override.yml << 'EOF'
services:
  plausible:
    ports:
      - "127.0.0.1:8000:8000"
EOF

docker compose up -d
```

Then add a vhost pointing `150-230-157-71.sslip.io` at `127.0.0.1:8000`:

**If it's Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name 150-230-157-71.sslip.io;
    # reuse/issue a cert for this name (certbot --nginx -d 150-230-157-71.sslip.io)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**If it's Caddy** (simplest — Caddy issues the cert automatically, no
certbot step):
```
150-230-157-71.sslip.io {
    reverse_proxy 127.0.0.1:8000
}
```

Then create the admin account and add the site exactly as in §2.

---

## 4. Site-side: tracking script (already added)

Every page (`index.html`, `walkers/index.html`, `druzina/index.html`)
now loads:

```html
<script defer data-domain="aliaksei-chareshneu.github.io"
        src="https://150-230-157-71.sslip.io/js/script.outbound-links.js"></script>
```

`.outbound-links` = pageviews **and** automatic tracking of every outbound
click (WhatsApp, Telegram, Google Forms, GoOut, Facebook — all of it,
without extra code). Until the VM is actually serving this, the script
just 404s silently — no error visible to visitors, nothing broken.

## 5. Site-side: named conversion goals (already added)

The buttons that actually matter for the business are tagged with
`plausible-event-name=...` classes, so they show up as **named goals** in
the dashboard instead of raw outbound-link URLs — this directly answers
"which venture converts better," which the existing efficiency numbers
(Družina being the weak link) only got at indirectly:

| Goal name | Where |
|---|---|
| `Register-Druzina` / `Register-Walkers` | every "Register / Book" and "Register for training/event" button |
| `Join-Chat-Druzina` / `Join-Chat-Walkers` | "Join the chat" buttons |
| `Announce-WA-Druzina` / `Announce-WA-Walkers` | Announcements · WhatsApp buttons |
| `Announce-TG-Druzina` / `Announce-TG-Walkers` | Announcements · Telegram buttons |

No JS was written for this — it's a stock Plausible feature (`class="...
plausible-event-name=X"` fires an event on click, works on plain `<a>`
tags, zero risk of breaking the page).

In the Plausible dashboard, go to **Site Settings → Goals** and add each
of the 8 names above as a "Custom event" goal so they show up in the
Goals tab (tagging the HTML makes them fire; they still need to be
registered as goals to appear as a report).

## 6. Reading the numbers later — Stats API

`plausible_stats.py` (same folder) pulls visitor/pageview/goal-conversion
counts via the API — the foundation for an n8n weekly-report node later,
same pattern as the invoicing automation. Needs a Stats API key: Plausible
dashboard → account menu → Settings → API Keys → New API Key.

```bash
pip install requests
python3 plausible_stats.py --key YOUR_KEY --days 30
```

---

## 7. Upgrade path — real domain + Cloudflare (adblock circumvention)

Not done now (no domain owned). The `.outbound-links` script above still
gets blocked by *some* adblockers that filter on path patterns rather than
domain — this is the known limitation of the "quick" path from our
conversation. If/when that matters enough to fix properly:

1. Buy a cheap domain (~a few hundred CZK/yr).
2. Point it at Cloudflare (free plan), proxied (orange cloud).
3. Add a Cloudflare Worker or Transform Rule that rewrites e.g.
   `yourdomain.com/js/script.js` → the VM's `/js/script.outbound-links.js`,
   and `yourdomain.com/api/event` → the VM's `/api/event`.
4. Swap the `<script src="...">` on all 3 pages to the new proxied path.
   Everything else (goals, Stats API) stays identical.

This is the piece the original brief called "ad-block circumvention" —
it's real work (DNS + Cloudflare config), which is exactly why I didn't
build it into the "quick" default.
