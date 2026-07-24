# Testing Strategy — AI Cookbook (Hard mode)

This document explains the testing strategy for the AI Cookbook, how the suites
are layered, what each one covers, where the coverage gaps are (and *why*), and
the fault-injection exercise used to prove the suite actually catches bugs.

The tests were generated with AI assistance and then reviewed line-by-line — the
goal was tests that assert **behavior and failure modes**, not tests that mirror
the code's structure and pass without asserting anything meaningful.

## Stack

The app is Node.js (ESM), so we use the tools that fit the stack rather than the
.NET frameworks (xUnit/NUnit/MSTest) named in the generic brief:

| Layer | Tool | Why |
|---|---|---|
| Unit + integration | **Vitest** | Fast, ESM-native, built-in mocking (`vi`), first-class coverage. |
| HTTP integration | **Supertest** | Fires real requests at the Express app without opening a socket. |
| End-to-end | **Playwright** | Drives the real UI in a real Chromium browser. |
| Coverage | **@vitest/coverage-v8** | V8 coverage, no instrumentation build step. |

## The testing pyramid, as built

```
        ▲  E2E (Playwright)         — 2 specs, real browser, full user journey
       ╱ ╲ Integration (Supertest)  — routes, status codes, rate limiting, CORS
      ╱   ╲Unit (Vitest)            — pure logic + service orchestration (mocked deps)
```

### 1. Unit tests (`test/`)

| File | Under test | Notable cases |
|---|---|---|
| `cache.test.js` | `buildCacheKey`, in-memory cache driver | order/case/whitespace normalization, de-dupe, TTL |
| `recipeStore.test.js` | in-memory store driver | idempotency on `generationId`, newest-first, remove-unknown |
| `anthropicClient.test.js` | `parseRecipeResponse`, `buildUserPrompt` | ```json fences, chatty text, `RECIPE_PARSE_ERROR`, `RECIPE_MODEL_ERROR` |
| `generateRecipe.test.js` | `generateRecipe` | demo path (no network), live path (**mocked `fetch`**), `UPSTREAM_ERROR` |
| `recipeService.test.js` | `recipeService` orchestration | **all collaborators mocked**: cache hit vs miss, per-request `generationId`, `cached` flag stripped on save |

Isolation: `recipeService.test.js` mocks the model client, cache, and store with
`vi.mock`, so it tests *only* the orchestration logic — no network, no I/O.

### 2. Integration tests (`test/*.integration.test.js`, `routes.errors.test.js`, `cors.test.js`)

Supertest mounts the real Express app (`createApp()`) with the in-memory
store/cache and runs in **demo mode** (no `ANTHROPIC_API_KEY`), so generation is
deterministic and offline.

- `routes.integration.test.js` — health; generate validation (400s); generate →
  cache-hit; save (201) + idempotent save; list; delete (200 then 404); cache
  stats/flush; **rate limiting (429)** using a fresh app so the limiter is isolated.
- `routes.errors.test.js` — forces the service to throw (via mock) to cover the
  error mapping the frontend depends on: `RECIPE_MODEL_ERROR → 422`, other → `502`,
  store failure → `500`, and diet de-duplication before the service call.
- `cors.test.js` — the CORS allowlist branch that only activates when
  `CLIENT_ORIGIN` is set (preflight `OPTIONS → 204`, allow-origin header).

### 3. End-to-end tests (`e2e/`)

Playwright boots the real server (demo mode, `NO_OPEN=1`) on port 4100 and drives
Chromium through the full journey:

- **Happy path** — type ingredients → chips render → pick meal type + diet →
  Generate → recipe panel renders (title/ingredients/steps/diet tag) → Save →
  recipe appears in the Community list.
- **Guard** — Generate with no ingredients shows the inline error and never
  opens the recipe panel.

## Coverage report

Run: `npm run test:coverage` (HTML report written to `coverage/index.html`).

```
All files          |   83.09 |    80.95 |   80.35 |   84.73
 src/app.js         |     100 |    83.33 |     100 |     100
 src/routes/recipes |     100 |    88.46 |     100 |     100
 src/services/anthropicClient |  100 | 88.57 | 100 | 100
 src/services/cache |   60.78 |    66.66 |   71.42 |   65.11
 src/store/recipeStore |  65.21 |     50 |   68.75 |   65.85
```

### Gap analysis (AI-assisted)

We ran coverage, read the uncovered-line list, and wrote tests targeting the
reachable gaps — that raised statements **73% → 83%** and branches **68% → 81%**,
bringing `app.js`, the routes, and the model client to 100%.

The **remaining** uncovered code is deliberate and documented:

| Uncovered | Lines | Why it's uncovered |
|---|---|---|
| `cache.js` Redis driver | 36–58 | Requires a live Redis (`REDIS_URL`). The in-memory driver behind the same interface is fully covered. |
| `recipeStore.js` Mongo driver | 22–46 | Requires a live MongoDB (`MONGODB_URI`). Same interface, in-memory driver covered. |

These are integration-with-external-service paths; they belong in a CI job with
real Redis/Mongo containers, not in the unit/integration run. The abstraction
(swap driver by env var) is exactly what lets us test the logic without them.

## Fault injection — proving the tests bite

A passing suite means nothing if it can't fail. We deliberately introduced a bug
and confirmed a test caught it:

**Bug:** removed `.sort()` from `buildCacheKey` in `src/services/cache.js`, so the
cache key becomes order-sensitive (`['chicken','garlic']` and `['garlic','chicken']`
would no longer share a cache entry — a real caching regression).

**Result:** `cache.test.js › normalizes order, case, and whitespace` failed with:

```
AssertionError: expected 'chicken|garlic::dinner::::' to be 'garlic|chicken::dinner::::'
```

The bug was then reverted and the suite returned to green (44/44). This is the
mutation-testing idea in miniature: a change in behavior must break a test.

## How to run

```bash
npm test              # unit + integration (Vitest)          -> 44 tests
npm run test:coverage # same, with a V8 coverage report
npm run test:e2e      # Playwright browser E2E (boots the server itself)
npm run test:all      # everything
```
