# DEVELOPMENT.md — Local Dev Guide
## AI Cookbook Project

Every mode runs on just Node 20+. No API key → demo mode (sample recipes).
No `MONGODB_URI` (Medium/Hard) → in-memory store. Both upgrade with no code change.

## Quickstart by Mode

### Easy Mode
1. `cd easy/cookbook-app && npm install`
2. (optional) `cp .env.example .env` and add `ANTHROPIC_API_KEY`
3. `npm start` → open http://localhost:3000

### Medium Mode
1. `cd medium/cookbook-app && npm install`
2. (optional) `cp .env.example .env` and add `ANTHROPIC_API_KEY` and/or `MONGODB_URI`
3. `npm start` → open http://localhost:3000

### Hard Mode
1. `cd hard/cookbook-api && npm install`
2. (optional) `cp .env.example .env` and add `ANTHROPIC_API_KEY` and/or `MONGODB_URI`
3. `npm start` → open http://localhost:4000
4. Tests: `npm test`
5. Docker (API + MongoDB): `cd hard && ANTHROPIC_API_KEY=sk-ant-... docker compose up`

## Environment Variables (all backend-only)

| Variable | Used by | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | all modes | Anthropic key. Unset → demo mode. Read in `anthropicClient.js` only. |
| `MONGODB_URI` | Medium, Hard | MongoDB connection string. Unset → in-memory store. |
| `PORT` | all modes | Server port (Easy/Medium 3000, Hard 4000). |
| `CLIENT_ORIGIN` | Hard | CORS allowlist origin (only if the UI is served from a different origin). |

There are NO `VITE_*` / browser-side keys — the Anthropic key never reaches the
client (see ADR 0004).

## Common Tasks
* Run a single Vitest test (Hard): `cd hard/cookbook-api && npx vitest run test/recipeStore.test.js`
* Reset MongoDB data (Docker): `cd hard && docker compose down -v && docker compose up`

## Troubleshooting
* Blank UI: check the browser console and that the server is running.
* `/api/health` shows `"store":"memory"` / `"mode":"demo"`: expected without
  `MONGODB_URI` / `ANTHROPIC_API_KEY` — set them to go live.
* Anthropic 401: the key is invalid or out of credits.
* Port already in use: set `PORT` to a free port.
