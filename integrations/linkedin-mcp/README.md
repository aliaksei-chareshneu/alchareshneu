# IMPERION LinkedIn MCP (private single-owner connector)

**Status:** implementation and local mocked tests; **not deployed, authorized, or connected to a live LinkedIn account**. No LinkedIn posts were created during testing.

A private, OAuth-protected Streamable HTTP MCP server for ChatGPT. Supports a verified owner connecting a LinkedIn profile, preparing text posts, publishing once after an explicit confirmation, and recording the LinkedIn API receipt. Does not scrape profiles, send cold messages, make connection requests, manage organization pages, or read analytics.

## Functional contract

| MCP tool | Behavior | Side effect |
| --- | --- | --- |
| `linkedin_connection_status` | Read authenticated member ID/email and token expiry | No LinkedIn write |
| `linkedin_prepare_post` | Store an exact text preview and create a draft ID | Local draft only |
| `linkedin_publish_post` | Requires draft ID and `confirm="PUBLISH"`; sends **one** external POST | Publishes a post |
| `linkedin_post_readback` | Reads saved HTTP status, LinkedIn post URN and URL (if returned) | Read-only |

A successful HTTP 201 with `X-RestLi-Id` is labeled `PUBLISHED_API_ACCEPTED`. It is **not** independent verification that the feed page is publicly visible. A timeout, 429, error, or lost response is `REVIEW_REQUIRED`; the server **never automatically retries** uncertain publication outcomes (avoids duplicate posts).

## Prerequisites (LinkedIn / ownership)

1. In [LinkedIn Developer](https://www.linkedin.com/developers/apps), create or select an app you control. LinkedIn may require an associated Company Page and its admin authorization.
2. Enable **Share on LinkedIn** (permission `w_member_social`) and **Sign In with LinkedIn using OpenID Connect** (`openid profile email`). Verify both products/scopes are shown on the app's Auth tab. This code intentionally uses only self-service member publishing.
3. Deploy behind a publicly reachable HTTPS origin you control, e.g. `https://linkedin-mcp.example.org`. On the LinkedIn app Auth tab, register this **exact** redirect URI: `https://linkedin-mcp.example.org/auth/linkedin/callback`.
4. Set `LINKEDIN_OWNER_EMAIL` to the email actually returned by LinkedIn for the profile permitted to post. The service rejects logins from any other LinkedIn account and requires LinkedIn to return `email_verified: true` in userinfo.

There is no workaround for missing LinkedIn app approval, owner consent, or access to the workspace's custom-MCP creation controls. Do not paste account passwords or the Client Secret into a ChatGPT message.

## Build and run on your server

This project uses Python 3.12+ with FastAPI, HTTPX, Cryptography, and sqlite. It is compatible with a standard single-instance Docker host with a persistent `/data` volume.

```bash
cp .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Put the generated key in `MCP_FERNET_KEY` within `.env` and set `PUBLIC_BASE_URL`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_OWNER_EMAIL`. The `PUBLIC_BASE_URL` must have **no trailing slash or path**. Keep `.env` private. Rotate encryption key only as part of a planned reauthentication (old stored tokens cannot decrypt after rotation).

```bash
docker build -t imperion-linkedin-mcp:0.1 .
docker run -d --name imperion-linkedin-mcp \
  --env-file .env \
  -v imperion_linkedin_data:/data \
  -p 127.0.0.1:8000:8000 \
  --restart unless-stopped \
  imperion-linkedin-mcp:0.1
```

Add a reverse proxy and TLS certificate pointing from `PUBLIC_BASE_URL` to `127.0.0.1:8000`. Alternatively, the included `compose.yaml` and `Caddyfile` can manage TLS on a Docker host: set `MCP_DOMAIN` in `.env`, point that DNS hostname to the host, allow inbound ports 80/443, and run `docker compose up -d --build`. The Compose deployment has only an internal app port, a persistent database volume, and a TLS reverse proxy; it still requires real LinkedIn credentials and account consent. Permit HTTPS traffic to `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`, `/oauth/*`, `/auth/linkedin/callback`, and `/mcp`. Do not expose port 8000 unauthenticated. Configure rate limiting/WAF for the public OAuth endpoints. Do not use multiple independent instances with one sqlite file or ephemeral database storage.

A public discovery smoke test (before connecting):

```bash
curl -fsS https://linkedin-mcp.example.org/.well-known/oauth-protected-resource/mcp
# Expected: JSON with resource=https://linkedin-mcp.example.org/mcp
```

An unauthenticated `POST /mcp` must return HTTP 401 and a `WWW-Authenticate` header pointing to protected-resource metadata.

### ChatGPT connection

Use ChatGPT on the web, with a Business workspace whose admin or owner can create custom MCP plugins (actual permissions depend on workspace settings). Open [Plugins](https://chatgpt.com/plugins) -> `+` -> **Add custom MCP server**. Enter:

- **Name**: `IMPERION LinkedIn`
- **Server URL**: `https://linkedin-mcp.example.org/mcp` (replace with the real deployed origin)
- **Authentication**: OAuth (dynamic client registration supported)

Create the plugin, complete the consent screen and LinkedIn sign-in for the allowlisted owner, review the discovered four tools, then install the plugin. If OAuth fails, confirm the exact redirect URI in LinkedIn Developer, both enabled products, TLS, your OAuth callback host in `DCR_REDIRECT_HOSTS`, and workspace permissions. Do not select `No authentication` for a public server.

### Acceptance test (no live posts until explicitly requested)

1. Ask ChatGPT: `Check my IMPERION LinkedIn connection and show the available tools.`
2. Ask: `Prepare a private draft of a 150-character LinkedIn post; do not publish.` Check it returns `PREPARED` with a draft ID.
3. If you independently approve a post, ask ChatGPT to publish **that exact draft** and confirm the app permission prompt. The tool requires `confirm=PUBLISH`.
4. Check the returned API HTTP code, ID and URL. For `REVIEW_REQUIRED`, manually check LinkedIn before preparing a new post: never automatically retry.

## Test without LinkedIn credentials

```bash
python -m pip install -r requirements.txt pytest
python -m pytest -q
```

Tests use a mock LinkedIn API and do not publish to an actual profile. The code does not embed API keys.

## Security and limitations

- Browser-based linked OAuth authorization code flows have an exact DCR redirect-host allowlist (`DCR_REDIRECT_HOSTS`, default `chatgpt.com`), `state`, a bound browser cookie, CSRF protection, one-time redemption, PKCE S256 for MCP clients, a visible client consent screen, and a strict LinkedIn-owner email allowlist.
- MCP access tokens and refresh tokens are random, stored only as SHA-256 hashes; LinkedIn upstream access tokens are encrypted at rest using a Fernet key provided through an environment variable. Upstream secrets are never returned to ChatGPT.
- The MCP refresh token can renew a **server-issued** access token while the LinkedIn upstream token is still valid. Basic LinkedIn developer apps typically do **not** receive programmatic LinkedIn refresh tokens, which are limited to approved Marketing Developer Platform partners. Reauthorization may be necessary at expiry or revocation.
- Use single-instance deployment, HTTPS, restricted host access, filesystem backups/permissions, persistent data volume, and network rate limiting. Privacy: sqlite stores draft text and email and should not be publicly exposed.
- This MVP implements `2025-11-25` Streamable HTTP JSON responses, supports older `2025-03-26`/`2025-06-18` request versions, and responds 405 to GET/DELETE `/mcp`. Authentication adheres to OAuth discovery and DCR. Real ChatGPT interoperability can only be checked once public HTTPS hosting and LinkedIn OAuth are configured.
- A text-only personal-profile publishing integration is intentionally narrower than paid Metricool or LinkedIn Marketing APIs. Organization publishing, inbox access, lead scraping, and analytics are **not** implemented or asserted to work.

### Official references

- [LinkedIn Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [LinkedIn OAuth authorization-code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn API permissions](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [LinkedIn programmatic refresh token restriction](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens)
- [ChatGPT custom MCP plugins](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

## Change control

A GitHub Actions workflow in this package is scoped to `integrations/linkedin-mcp` and can run mocked tests on a pull request (the file should reside at repository root under `.github/workflows`). The application does not update your existing CRM and cannot send posts without a LinkedIn OAuth owner login plus explicit per-draft publish command. Do not merge a feature branch or deploy to production without confirming secrets, account identity, TLS, and workspace permissions.

## Integration delivery / release status

This code is a standalone Docker app and **cannot be served from GitHub Pages**. Storing it in a GitHub branch does not deploy it. Supabase Edge Functions run Deno TypeScript; this Python + sqlite implementation must not be copied directly to them. Prefer an isolated always-on Docker host with persistent encrypted storage, or formally port it to Deno with a new threat model and tests. Use [the exact app setup page](https://www.linkedin.com/developers/apps) to create the LinkedIn OAuth application, and [ChatGPT Plugins](https://chatgpt.com/plugins) to connect only after a live protected HTTPS endpoint exists.

**Do not configure** the app on an unrelated production project merely to obtain a URL; do not treat a GitHub pull request as a live connector.
