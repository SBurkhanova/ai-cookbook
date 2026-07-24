# Challenge 1 — Hard Mode Planning
## AI Cookbook: Recipe Generator

> **Includes everything from Easy and Medium mode**, plus the sections below.
> **Goal of this tier:** a complete, production-style design package that can
> directly drive development with minimal ambiguity. The committed decisions
> here are also captured as a delivery spec in [PRD.md](PRD.md) and broken into
> tickets in [ISSUES.md](ISSUES.md).

---

## Product Name & Description
**AI Cookbook** — a full-stack web app that generates, saves, and manages custom
recipes using the Claude AI API, with a Node.js/Express backend, **MongoDB**
persistence, and a React frontend. The backend is the only component that holds
the Anthropic API key and the only one that talks to Claude.

---

## Full Architecture Document

### Technology Stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js 20, Express 5 |
| Database | **MongoDB** (official `mongodb` driver) |
| AI Provider | Anthropic Claude API (`claude-sonnet-4-6`) |
| Abuse control | `express-rate-limit`, request body limit, CORS allowlist |
| Package Manager | npm |
| Testing | Vitest (unit), Playwright (e2e) |
| Deployment | Docker Compose (local), Azure App Service (Challenge 7) |

---

### High-Level Architecture Diagram
```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│   React SPA (Vite + Tailwind)                           │
│   ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│   │Ingredient│  │  Recipe  │  │  Community Recipes  │   │
│   │  Input   │  │ Display  │  │       Panel         │   │
│   └────┬─────┘  └────┬─────┘  └─────────┬──────────┘   │
│        └─────────────┴──────────────────┘               │
│                       │ HTTP/REST (no API key in client) │
└───────────────────────┼─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│               Node.js / Express API                     │
│  rate-limit ▸ body-limit ▸ CORS allowlist               │
│                                                         │
│  POST /api/recipes/generate   ← calls Claude, no save   │
│  POST /api/recipes            ← idempotent save         │
│  GET  /api/recipes            ← list community recipes  │
│  DELETE /api/recipes/:id      ← delete a recipe         │
│  GET  /api/health             ← health check            │
│                                                         │
│  ┌──────────────────┐   ┌───────────────────────────┐   │
│  │  RecipeService   │   │     AnthropicClient       │   │
│  │ (business logic) │   │ prompt + fetch + safe-parse│   │
│  └────────┬─────────┘   └─────────────┬─────────────┘   │
└───────────┼───────────────────────────┼─────────────────┘
            │ mongodb driver            │ HTTPS (holds key)
┌───────────▼──────────────┐  ┌─────────▼──────────────────┐
│        MongoDB           │  │   Anthropic Claude API     │
│  recipes collection      │  │  POST /v1/messages          │
│  unique index:           │  │  model: claude-sonnet-4-6   │
│    { generationId: 1 }   │  └────────────────────────────┘
└──────────────────────────┘
```

---

### Domain Model with Relationships
```
RecipeRequest
  ├── ingredients: string[]     (1..n)
  ├── mealType: string?
  └── cookTimeLimit: string?
            │
            ▼  (server mints generationId, calls Claude)
recipes (MongoDB document)
  ├── _id: ObjectId             (server-minted primary key)
  ├── generationId: string      (uuid — UNIQUE index, idempotency key)
  ├── title: string
  ├── servings: string
  ├── time: string
  ├── difficulty: string         (display only — NOT a constrained enum)
  ├── mealType: string?          (carried from RecipeRequest, not from Claude)
  ├── cookTimeLimit: string?     (carried from RecipeRequest, not from Claude)
  ├── ingredients: string[]
  ├── steps: string[]
  ├── tips: string?
  ├── createdAt: ISO date
  └── updatedAt: ISO date
```

No relational tables and no migrations: a recipe is a single self-contained
document. On startup the app only ensures the unique index on `generationId`.

---

### API Surface

| Method | Route | Request Body | Response | Description |
|---|---|---|---|---|
| `POST` | `/api/recipes/generate` | `{ ingredients[], mealType?, cookTime? }` | `Recipe` (with `generationId`, no `_id`) | Generate via Claude; does NOT save. Rate-limited + input-bounded. |
| `POST` | `/api/recipes` | `Recipe` | saved `Recipe` (with `_id`) | Idempotent upsert on `generationId`. |
| `GET`  | `/api/recipes` | — | `Recipe[]` | List all saved (community) recipes, newest first. |
| `DELETE` | `/api/recipes/:id` | — | `{ success: true }` | Delete a saved recipe (open, no auth — by design). |
| `GET`  | `/api/health` | — | `{ status: "ok" }` | Health check. |

---

### Cross-Cutting Concerns (locked decisions)

- **Security — no key in the browser.** Only the backend holds `ANTHROPIC_API_KEY`
  and only the backend calls Claude.
- **Abuse / cost control.** `/api/recipes/generate` is anonymous and paid, so:
  per-IP rate limit (~10 / 15 min → 429), reject > 30 ingredients (400),
  `express.json({ limit: '16kb' })`, and an optional global daily ceiling.
- **CORS.** Allowlist the frontend origin only; not wide-open `cors()`.
- **Robust AI output handling (one server code path).** Strip a ```` ```json ````
  fence → `JSON.parse` in try/catch (truncation → clean 502) → branch on an
  `error` key before treating the object as a recipe. Never a dead spinner.
- **Idempotent save.** Server mints `_id`; `generationId` unique index +
  `findOneAndUpdate(..., { upsert: true, returnDocument: 'after' })`. N saves → 1 doc.
- **Ownership.** Recipes are a single shared **Community Recipes** list — no auth,
  delete is open. Accepted MVP tradeoff; auth is Post-MVP.

---

### Step-by-Step Implementation Plan

#### Phase 1 — Backend scaffold
1. `npm init` in `hard/cookbook-api/`.
2. Install `express`, `mongodb`, `dotenv`, `cors`, `uuid`, `express-rate-limit`.
3. `src/index.js` — Express app, JSON body limit `16kb`, CORS allowlist, `/api/health`.
4. `src/db.js` — MongoDB connection; ensure `{ generationId: 1 }` unique index.
5. `src/services/anthropicClient.js` — prompt builder + Claude call + safe-parse
   (strip fences, try/catch, detect `error` key).
6. `src/services/recipeService.js` — business logic (generate, save, list, delete).
7. `src/routes/recipes.js` — wire the 5 routes; add rate-limit + input bounds on generate.

#### Phase 2 — Frontend scaffold
1. `npm create vite@latest cookbook-ui -- --template react` in `hard/`.
2. Install `tailwindcss`, `axios`; configure Tailwind.
3. Build components: `IngredientInput`, `RecipeDisplay`, `CommunityRecipes`, `Header`.
4. Wire API calls to the Express backend (never directly to Anthropic).

#### Phase 3 — Integration & testing
1. Vitest unit tests for `recipeService` and `anthropicClient` (esp. the three
   bad-output cases: fenced, truncated, `error` payload).
2. Playwright e2e for the full generate → save → list → delete flow.
3. Docker Compose: one service for the API, one for MongoDB.

#### Phase 4 — Polish
1. Error boundaries + a real "couldn't generate" error state in React.
2. Loading skeletons.
3. Empty state for the Community Recipes panel.

---

### Custom AI Agent Definition

**Agent: RecipeGeneratorAgent**

```yaml
name: RecipeGeneratorAgent
model: claude-sonnet-4-6
role: >
  You are a creative chef and culinary expert. Your only job is to generate
  recipes. You always respond with valid JSON and nothing else.
input:
  - ingredients: list of ingredients the user has available
  - mealType: optional meal type (breakfast, lunch, dinner, snack, dessert)
  - cookTimeLimit: optional time constraint
output_schema:            # request metadata (mealType/cookTimeLimit) is NOT here —
  title: string           # the backend carries those from the request itself
  servings: string
  time: string
  difficulty: string      # free text; the UI normalizes it for display
  ingredients: string[]   # may include common pantry staples
  steps: string[]
  tips: string | null
constraints:
  - Respond ONLY with a valid JSON object. No markdown, no backticks, no preamble.
  - Focus on the provided ingredients. You may add salt, oil, and basic pantry items.
  - If the ingredient list is nonsensical or unsafe, return an error JSON instead:
    { "error": "Cannot generate a recipe from these ingredients." }
  - Keep steps practical; order is implied by array index.
max_tokens: 2000          # high enough that a full recipe is never truncated
temperature: 0.8
```

> The backend never trusts this output blindly: it strips code fences, parses in
> a try/catch, and checks for the `error` key before rendering a recipe.

---

## MVP Feature Prioritization

### Must-Have
1. Ingredient tag input.
2. Meal-type + cook-time filters.
3. AI recipe generation via Claude (backend-proxied).
4. Structured recipe display (with defensive `difficulty` rendering).
5. Idempotent save to MongoDB.
6. List community recipes.
7. Delete a recipe.

### Post-MVP
8. User authentication + private per-user lists.
9. Dietary preference filters. ✅ Implemented (Challenge 4) — vegetarian / vegan / gluten-free / dairy-free.
10. Recipe ratings.
11. Share / export recipe.
12. Cloud deployment (Challenge 7).
