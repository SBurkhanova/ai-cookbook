# AI Cookbook — Product Requirements Document (Hard Mode)

> Generated from the `$grill-me` session. Supersedes the open questions in
> [hard/PLANNING.md](PLANNING.md). Guiding principle: **keep every choice simple
> and straightforward.** When two designs work, pick the one with fewer moving parts.

---

## 1. Overview

AI Cookbook is a full-stack web app that generates custom recipes from
ingredients the user already has, using the Claude API. A React frontend talks
to a Node/Express backend; the backend is the **only** thing that holds the
Anthropic API key and the **only** thing that talks to Claude. Recipes are saved
to a shared MongoDB collection.

---

## 2. Goals / Non-Goals

**Goals (MVP)**
- Generate a structured recipe from an ingredient list + optional filters.
- Save generated recipes and browse the shared list.
- Never expose the API key or an unbounded paid endpoint to the public.
- Degrade gracefully when the model returns bad output.

**Non-Goals (explicitly deferred)**
- User accounts / auth (JWT) — recipes are a shared community list for now.
- Per-user ownership, dietary filters, ratings, share/export, cloud deploy.

---

## 3. Users

- **Guest user** — anyone, no login. Can generate, save, browse, and delete
  recipes. There is no private data; the saved list is shared by all visitors.

---

## 4. Architecture & Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js 20, Express 5 |
| Database | **MongoDB** (official `mongodb` driver) |
| AI Provider | Anthropic Claude API (`claude-sonnet-4-6`) |
| Package Manager | npm |

```
Browser (React SPA)
   │  HTTP/REST  (never talks to Anthropic directly)
   ▼
Express API  ──── holds ANTHROPIC_API_KEY ────►  Anthropic Claude API
   │
   ▼
MongoDB  (single `recipes` collection)
```

---

## 5. Data Model

A recipe is a single MongoDB document — no nested-relational mapping needed.

```
recipes (collection)
  _id           ObjectId   // server-minted primary key
  generationId  string     // uuid, UNIQUE INDEX — idempotency key
  title         string
  servings      string
  time          string
  difficulty    string     // display only — NOT a constrained enum
  mealType      string?    // carried from the request, NOT from Claude
  cookTimeLimit string?     // carried from the request, NOT from Claude
  ingredients   string[]
  steps         string[]
  tips          string?
  createdAt     ISO date
  updatedAt     ISO date
```

- **No migrations.** Startup just ensures the unique index:
  `db.recipes.createIndex({ generationId: 1 }, { unique: true })`.
- `difficulty` is stored as plain text and normalized only in the UI.

---

## 6. API Surface

| Method | Route | Body | Response | Notes |
|---|---|---|---|---|
| `POST` | `/api/recipes/generate` | `{ ingredients[], mealType?, cookTime? }` | `Recipe` (incl. `generationId`, no `_id`) | Calls Claude. Does NOT save. Rate-limited + input-bounded. |
| `POST` | `/api/recipes` | `Recipe` | saved `Recipe` (incl. `_id`) | Idempotent upsert on `generationId`. |
| `GET`  | `/api/recipes` | — | `Recipe[]` | Shared community list. |
| `DELETE` | `/api/recipes/:id` | — | `{ success: true }` | Open by design (no auth). |
| `GET`  | `/api/health` | — | `{ status: "ok" }` | Health check. |

---

## 7. AI Integration Contract

**Agent: RecipeGeneratorAgent** — `claude-sonnet-4-6`, `temperature: 0.8`,
`max_tokens: 2000`.

Claude returns ONLY this shape (request metadata is NOT part of it):
```
{ title, servings, time, difficulty, ingredients[], steps[], tips }
```
or, for nonsensical/unsafe input:
```
{ "error": "Cannot generate a recipe from these ingredients." }
```

**Response handling (all three cases, one code path on the server):**
1. **Strip markdown fences** — remove a leading/trailing ```` ```json `` `` ``` ````
   wrapper (or regex-extract the first `{ … }`) before parsing.
2. **Parse in try/catch** — on failure (e.g. truncation), return a clean
   `502`-style error; UI shows *"Couldn't generate a recipe — try again,"*
   never a dead spinner.
3. **Branch on `error` key** — if the parsed object has an `error` field, surface
   that message and do NOT attempt to render it as a recipe.

---

## 8. Abuse / Cost Protection

Because `/api/recipes/generate` is anonymous and spends money per call:
1. **Per-IP rate limit** — `express-rate-limit`, ~10 generations / IP / 15 min.
2. **Input bounds** — reject > ~30 ingredients; `express.json({ limit: '16kb' })`.
3. **Global daily ceiling** *(recommended)* — in-memory counter trips a circuit
   breaker after N generations/day → *"service busy, try later."*

**CORS** — allowlist the frontend origin only; not wide-open `cors()`.

---

## 9. Save Semantics (Idempotency)

- Server mints `_id` (Mongo `ObjectId`) — the client never invents the PK.
- `/generate` returns a server-minted `generationId` (uuid) on the recipe.
- Save is an idempotent upsert:
  ```js
  db.recipes.findOneAndUpdate(
    { generationId },
    { $setOnInsert: recipeDoc },
    { upsert: true, returnDocument: 'after' }
  )
  ```
- Clicking "Save" N times → exactly one document; every response returns it.

---

## 10. Decision Log (from grilling)

| # | Issue | Decision |
|---|---|---|
| 1 | Browser-exposed API key | Backend-only proxy; Easy/Medium browser-direct calls dropped. |
| 2 | No ownership in shared DB | Accepted shared list → UI says **"Community Recipes"**; delete is open. |
| 3 | Unparseable model output | Strip fences → try/catch → branch on `error`; `max_tokens` 2000; real error state. |
| 4 | Anonymous paid endpoint | Per-IP rate limit + input bounds (MVP); global daily ceiling (backstop). |
| 5 | `id` ownership / double-save | Server mints `_id`; `generationId` unique index + idempotent upsert. |
| 6 | Model ≠ DB fields | `mealType`/`cookTime` carried from request (removed from agent schema); `difficulty` is a display string. |
| 7 | Datastore | **MongoDB** (document fit, no JSONB, no migrations). |

---

## 11. UI Requirements

- Ingredient tag input (type + Enter/comma → chip).
- Meal type + cook time filter dropdowns.
- Generate button with loading state and a real error message on failure.
- Structured recipe display: title, time, servings, difficulty, numbered steps, tips.
- **"Community Recipes"** panel: list, view, delete; empty state when none.

---

## 12. Acceptance Criteria

- [ ] API key never reaches the browser; all Claude calls go through Express.
- [ ] Generating a recipe with valid ingredients renders a full structured recipe.
- [ ] A fenced / truncated / `error` response never produces a dead spinner.
- [ ] Saving the same generated recipe twice yields exactly one DB document.
- [ ] Saved recipes appear in the shared list and can be deleted.
- [ ] Hitting `/generate` past the rate limit returns a 429, not a Claude call.
- [ ] `difficulty` with an unexpected value still renders (neutral style), no crash.
