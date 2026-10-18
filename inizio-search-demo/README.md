# INIZIO practical task: Google organic results exporter

A small and explainable full-stack JavaScript application. A single search input retrieves the **first page of organic Google search results** and allows the user to download them as machine-readable JSON (not HTML).

## What it does

1. Accepts a Czech-language search phrase in one HTML input.
2. Sends the query to the Node.js backend, not directly to an external API from the browser.
3. Calls the Serper Google Search API with `gl=cz`, `hl=cs`, `num=10`, `page=1`.
4. Takes **only** the `organic` collection (never advertisements, maps, knowledge panels, or other features).
5. Validates URLs and titles, removes duplicate URLs, limits results to 10, and returns structured JSON.
6. Shows the results and downloads a JSON file on request.

The response contains `query`, `fetchedAt`, `source`, `count`, and `results[]` with `position`, `title`, `url`, and `snippet`.

## Requirements and local run

- Node.js >=20 (tested with Node.js 22).
- One Serper API key; create one at https://serper.dev (advertises 2,500 trial queries, no credit card as of 18 Oct 2026).

```bash
export SERPER_API_KEY=your_real_key
npm start
```

Open http://localhost:3000. On PowerShell use `$env:SERPER_API_KEY="..."; npm start` instead.

Without the key, **searches return HTTP 503** with a clear error. This is intentional: simulated results are never presented as real Google results.

## Tests

```bash
npm test
```

16 automated tests (Node's built-in test runner, no external dependencies) cover query validation, provider request parameters, output schema, advertisement exclusion, duplicate filtering, browser HTML, HTTP errors, rate limits, caching, daily quota, concurrent search deduplication, and security headers. These are deterministic tests with fake provider responses; live end-to-end Google results require a valid key. See `TEST_RESULTS.txt`.

## Production-ish demo safeguards

- The key is in the server environment (`SERPER_API_KEY`), not in HTML, JS or the Git repository.
- A basic per-IP limit (8 requests/min), two-hour query cache, and shared daily cap (`MAX_DAILY_QUERIES`, default 50) prevent accidental API exhaustion.
- Daily cap and cache are held in memory and can reset after an instance restart; this is a demo, not a billing-grade production quota system.
- CSP, content-type protection, output escaping and query-length limits are in place.
- No user registration, cookies, database or query persistence beyond a short-lived in-memory cache.

## Deployment on Render (free)

1. Push this directory to a GitHub repository.
2. Open Render > New > Web Service and connect the repository.
3. Use `npm install` (build command), `npm start` (start command), Free plan, and set Node 22 if necessary.
4. Set `SERPER_API_KEY` as a **secret** environment variable (do not put it in `render.yaml` or commit `.env`).
5. Check `/health`, run a live search, download JSON, and verify that only organic results are present.

The included `render.yaml` is a Blueprint for a repository whose root is this project. If the project is in a subfolder, specify that root directory in Render.

Free Render web services may take ~1 minute to wake after inactivity. This is expected for an interview demo.

## Optional Docker Compose

```bash
cp .env.example .env
# fill in a real key in .env locally
docker compose up --build
```

## Task submission

- Live Render URL: pending deployment.
- Short screen recording in the candidate's own words, including green tests: pending.
- Source code ZIP with tests: ready.
- CV/motivation letter: attach existing documents.

The public landing page says `dj@inizio.cz` whereas the assignment document says `jaros@inizio.cz`. Verify the intended recipient or send to both if needed. The site states a 168-hour deadline from completion of the initial test.

## Transparency

The implementation was prepared with assistance from an AI coding tool; the candidate should read, independently explain, and verify each component before submission. No live integration test, service deployment, or submission is claimed until actually confirmed.
