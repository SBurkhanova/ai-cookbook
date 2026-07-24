# ARCHITECTURE.md — System Overview
## AI Cookbook Project

> Reflects the decisions made during the Challenge 1 grilling session and built
> in Challenge 2. See [docs/adr/0003-use-mongodb.md](docs/adr/0003-use-mongodb.md)
> and [docs/adr/0004-backend-proxy-all-modes.md](docs/adr/0004-backend-proxy-all-modes.md).

## Technology Stack

| Mode | Frontend | Backend | Database | AI |
|---|---|---|---|---|
| Easy | Vanilla HTML/JS | Express (proxy) | None | Anthropic API (backend only) |
| Medium | Vanilla HTML/JS | Express | MongoDB* | Anthropic API (backend only) |
| Hard | Vanilla HTML/JS** | Express (routes/services/store) | MongoDB* | Anthropic API (backend only) |

\* MongoDB when `MONGODB_URI` is set; an in-memory store otherwise (zero-setup dev).
\** React 18 + Vite + Tailwind is the documented production target; the runnable
reference UI is vanilla JS served by Express for one-command startup.

* Package Manager: npm
* Testing: Vitest (unit) — Hard mode. Playwright (e2e) is the planned target.
* Deployment: Docker Compose (local, Hard) → Azure App Service (Challenge 7)
* AI key: never in the browser, any mode. It lives only in the backend env.

## High-Level Diagram

### All modes
```
Browser → Express API → Cache → Anthropic API   (key stays server-side; cache miss only)
                      → MongoDB                  (Medium/Hard; in-memory fallback)
```
Cache (Challenge 3): keyed by a normalized request; Redis when `REDIS_URL` is set
(Hard), in-memory otherwise. See [docs/adr/0005-recipe-generation-cache.md](docs/adr/0005-recipe-generation-cache.md).

## Boundaries (Non-negotiable)
* The Anthropic API key must NEVER appear in browser-side code, in any mode.
* Claude model is always `claude-sonnet-4-6`. Do not change without an ADR.
* Claude must always be prompted to return pure JSON. The backend additionally
  defends against bad output: strip code fences → parse in try/catch → branch on
  an `{ "error": ... }` payload before treating the result as a recipe.
* In Hard mode, all storage access goes through `store/recipeStore.js`, and
  business logic lives in `services/recipeService.js`. Routes stay thin.

## Key Flows

### Recipe Generation Flow
1. User submits ingredients (+ optional meal type, cook time, and **dietary
   filters**: vegetarian / vegan / gluten-free / dairy-free) → frontend calls
   `POST /api/recipes/generate`. Diet values are validated server-side and folded
   into the prompt and the cache key.
2. Backend checks the **cache** by normalized request key (ingredients + filters +
   diet). On a hit it returns the stored recipe (`cached: true`). On a miss,
   `recipeService` builds the prompt → `anthropicClient` calls Anthropic (or returns
   a demo recipe when no key is set), then writes the result to the cache.
3. Response is parsed safely into a Recipe; the backend mints a `generationId`
   and carries `mealType`/`cookTimeLimit` from the request (not from Claude).
4. Recipe returned to the browser — NOT saved yet.
5. User clicks Save → `POST /api/recipes` → idempotent upsert on `generationId`
   (clicking Save twice yields exactly one document).

### Ownership / Auth Flow
* MVP: no authentication. Saved recipes are a single shared **Community Recipes**
  list — world-readable and world-deletable by design.
* Future: per-user lists behind JWT auth (Post-MVP).

## Operational Notes
* Logging: `console.error` for failures; structured logging in Challenge 6.
* Abuse control: per-IP rate limit + body-size limit + ingredient cap on
  `/api/recipes/generate`; CORS allowlist via `CLIENT_ORIGIN`.
* Secrets: backend `.env` only — never committed.
