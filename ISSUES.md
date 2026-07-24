# AI Cookbook — Build Backlog (Hard Mode)

> Generated from [hard/PRD.md](PRD.md) via the `$to-issues` step. Issues are
> ordered by dependency — build top to bottom. Each is intentionally small.
> Paste into GitHub Issues as-is (titles map to one PR each).

Labels used: `backend`, `frontend`, `infra`, `ai`, `security`.

---

## #1 — Backend scaffold + health check
**Labels:** backend, infra
**Depends on:** —

Set up the Express app skeleton in `hard/cookbook-api/`.

- `npm init`; install `express`, `mongodb`, `dotenv`, `cors`, `uuid`, `express-rate-limit`.
- `src/index.js`: Express app with JSON middleware capped at `16kb`.
- **CORS allowlist** the frontend origin only (env `CLIENT_ORIGIN`) — not wide-open `cors()`.
- `GET /api/health` → `{ status: "ok" }`.
- `.env` holds `ANTHROPIC_API_KEY`, `MONGODB_URI`, `CLIENT_ORIGIN`; never committed.

**Acceptance:** server boots; `/api/health` returns 200; body > 16kb is rejected; a request from a disallowed origin is blocked.

---

## #2 — MongoDB connection + unique index
**Labels:** backend, infra
**Depends on:** #1

- `src/db.js`: connect with the `mongodb` driver using `MONGODB_URI`.
- On startup, ensure the index: `db.recipes.createIndex({ generationId: 1 }, { unique: true })`.
- Export a `recipes` collection accessor.

**Acceptance:** app connects on boot; the unique index exists; no migration scripts needed.

---

## #3 — AnthropicClient with robust response handling
**Labels:** backend, ai
**Depends on:** #1

`src/services/anthropicClient.js` — builds the prompt and calls Claude
(`claude-sonnet-4-6`, `temperature: 0.8`, `max_tokens: 2000`).

Response handling, one code path (PRD §7):
1. Strip a leading/trailing ```` ```json `` `` ``` ```` fence (or regex-extract first `{…}`).
2. `JSON.parse` in try/catch — on failure throw a typed `RecipeParseError`.
3. If parsed object has an `error` key, return it as a typed error (not a recipe).

**Acceptance:** unit tests cover (a) fenced output parses, (b) truncated/garbage output throws `RecipeParseError`, (c) `{"error":...}` is surfaced as an error, not rendered as a recipe.

---

## #4 — Rate limiting + input bounds on /generate
**Labels:** backend, security
**Depends on:** #1

- `express-rate-limit` on `/api/recipes/generate`: ~10 req / IP / 15 min → 429.
- Reject requests with > 30 ingredients with a 400.
- *(Recommended)* in-memory global daily counter → 503 "service busy" past the ceiling.

**Acceptance:** the 11th request from an IP in the window returns 429 **without** calling Claude; > 30 ingredients returns 400.

---

## #5 — POST /api/recipes/generate
**Labels:** backend, ai
**Depends on:** #2, #3, #4

`src/routes/recipes.js` + `src/services/recipeService.js`.

- Validate body `{ ingredients[], mealType?, cookTime? }`.
- Mint a `generationId` (uuid) server-side.
- Call AnthropicClient; on `RecipeParseError` return a `502` clean error.
- Return the recipe with `generationId`, `mealType`, `cookTimeLimit` (carried from the **request**, not from Claude) — and no `_id` (not saved yet).

**Acceptance:** valid ingredients → full structured recipe with a `generationId`; metadata fields reflect the request; a parse failure returns 502, never hangs.

---

## #6 — POST /api/recipes (idempotent save)
**Labels:** backend
**Depends on:** #2, #5

Save via idempotent upsert on `generationId` (PRD §9):
```js
db.recipes.findOneAndUpdate(
  { generationId },
  { $setOnInsert: { ...recipe, createdAt, updatedAt } },
  { upsert: true, returnDocument: 'after' }
)
```

**Acceptance:** saving the same `generationId` N times yields exactly one document; every response returns that same saved recipe (with `_id`).

---

## #7 — GET /api/recipes + DELETE /api/recipes/:id
**Labels:** backend
**Depends on:** #2

- `GET /api/recipes` → all recipes (shared community list), newest first.
- `DELETE /api/recipes/:id` → `{ success: true }` (open, no auth — by design).

**Acceptance:** list returns saved recipes; delete removes the document and returns success; deleting a missing id returns a clean 404.

---

## #8 — Frontend scaffold
**Labels:** frontend, infra
**Depends on:** —

- `npm create vite@latest cookbook-ui -- --template react` in `hard/`.
- Install `tailwindcss`, `axios`; configure Tailwind.
- Central API client pointed at the Express base URL (env).

**Acceptance:** dev server runs; a smoke call to `/api/health` succeeds through the API client.

---

## #9 — Ingredient input + filters
**Labels:** frontend
**Depends on:** #8

`IngredientInput` component: type + Enter/comma → chip; remove a chip.
Meal type and cook time dropdowns.

**Acceptance:** ingredients add/remove as chips; filter selections are captured in component state.

---

## #10 — Generate flow (loading + real error state)
**Labels:** frontend, ai
**Depends on:** #5, #9

Wire the Generate button to `POST /api/recipes/generate`.

- Loading state while in flight.
- On error (incl. 502/429), show a real message — *"Couldn't generate a recipe — try again"* — never a stuck spinner.

**Acceptance:** success renders a recipe; a forced backend error shows the message and clears the spinner.

---

## #11 — Recipe display
**Labels:** frontend
**Depends on:** #10

`RecipeDisplay`: title, time, servings, difficulty, numbered steps, tips.

- Normalize `difficulty` defensively: match `{easy, medium, hard}` for styling; anything else → neutral style. No crash on unexpected values.
- "Save Recipe" button → `POST /api/recipes`.

**Acceptance:** a recipe renders fully; `difficulty: "Moderate"` still renders with neutral styling.

---

## #12 — Community Recipes panel
**Labels:** frontend
**Depends on:** #6, #7, #11

`SavedRecipes` panel labeled **"Community Recipes"** (not "My Recipes").

- List from `GET /api/recipes`; click to view; delete via `DELETE`.
- Empty state when there are none.

**Acceptance:** saved recipes appear; view and delete work; empty state shows when the list is empty.

---

### Suggested milestones
- **M1 — API works end to end:** #1 → #7
- **M2 — UI works end to end:** #8 → #12
