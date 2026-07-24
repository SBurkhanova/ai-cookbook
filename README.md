# AI Cookbook — Hard Mode

Full-stack AI Cookbook:
- **Backend**: Node.js + Express REST API, split into routes / services / store.
- **Database**: MongoDB (in-memory fallback for zero-setup local dev).
- **AI**: Anthropic Claude API, called from the backend only — never the browser.
- **UI**: served by the API from `cookbook-api/public/`.
- **Tests**: Vitest unit suite. **Docker**: `docker-compose.yml` (API + Mongo).

See [PLANNING.md](PLANNING.md) · [PRD.md](PRD.md) · [ISSUES.md](ISSUES.md).

## Prerequisites
- Node.js v20+ (`node -v`). MongoDB and Docker are optional (see fallbacks).

## Run (just Node)
```bash
cd cookbook-api
npm install
cp .env.example .env     # optional — add ANTHROPIC_API_KEY and/or MONGODB_URI
npm start
```
`npm start` boots the API **and opens http://localhost:4000 in your browser**
automatically (via `open-cli`). Set `NO_OPEN=1` to skip the auto-open (it's set in
`docker-compose.yml`).

### Run with Docker (API + MongoDB)
```bash
cd hard
ANTHROPIC_API_KEY=sk-ant-... docker compose up
```
API on http://localhost:4000, MongoDB on 27017. The key is optional (demo mode if omitted).

### Fallbacks
- **No `ANTHROPIC_API_KEY`** → demo mode (deterministic sample recipes).
- **No `MONGODB_URI`** → in-memory store (resets on restart). Set it to use real MongoDB.

## Test
```bash
cd cookbook-api
npm test          # Vitest: response parsing, store idempotency, cache + diet keys — 18 tests
```

## Verify
- `GET /api/health` → `{ status, mode, store, cache }`.
- `POST /api/recipes/generate` → recipe with a `generationId`. Generating the same
  ingredients twice returns `cached: true` the second time (a "⚡ Cached" pill shows).
- `GET /api/cache/stats` → entry count + TTL. `DELETE /api/cache` → flush.
- **Dietary filters** (vegetarian / vegan / gluten-free / dairy-free): toggle the
  pills before generating — they flow into the prompt, tag the recipe, are saved
  with it, and are part of the cache key. Invalid values → 400.
- Saving twice → one entry (idempotent on `generationId`).
- `GET /api/recipes` lists, `DELETE /api/recipes/:id` removes (404 if missing).
- Past 10 generations / 15 min → 429.

## Structure
```
hard/
├── docker-compose.yml          ← API + MongoDB
└── cookbook-api/
    ├── Dockerfile
    ├── src/
    │   ├── index.js            ← boot: init store, start server
    │   ├── app.js              ← express app (CORS allowlist, static, routes)
    │   ├── routes/recipes.js   ← generate / save / list / delete + rate limit
    │   ├── services/
    │   │   ├── anthropicClient.js  ← prompt + Claude call + safe parse + demo
    │   │   └── recipeService.js    ← business logic
    │   └── store/recipeStore.js    ← MongoDB driver OR in-memory driver
    ├── test/                   ← Vitest unit tests
    └── public/                 ← served UI (index.html, app.js, styles.css)
```

> Deviations from the original plan (grilling-stage decisions, see [PRD.md](PRD.md)):
> **MongoDB** instead of PostgreSQL (no `migrate.js` — an index is ensured on
> startup); `max_tokens: 2000`. The runnable reference UI is vanilla JS served by
> Express; React + Vite + Tailwind + Playwright remain the documented production
> target.
