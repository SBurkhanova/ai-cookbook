# AI Cookbook
### Alliant Software Dev Hackathon — Challenge 1

A web application that generates custom recipes from ingredients you already have, powered by the Claude AI API.

---

## Project Structure

```
ai-cookbook/
├── AGENTS.md               ← AI agent operating contract (read this first)
├── ARCHITECTURE.md         ← System design and boundaries
├── DEVELOPMENT.md          ← Setup and run instructions
├── SECURITY.md             ← Secrets and dependency policy
├── easy/                   ← PLANNING/PRD/ISSUES + README + cookbook-app/
├── medium/                 ← PLANNING/PRD/ISSUES + README + cookbook-app/
├── hard/                   ← PLANNING/PRD/ISSUES + README + cookbook-api/ + docker-compose.yml
└── docs/
    ├── dependencies.md     ← Package policy
    └── adr/
        ├── 0001-use-claude-sonnet-model.md
        ├── 0002-browser-api-calls-easy-medium.md   (superseded by 0004)
        ├── 0003-use-mongodb.md
        └── 0004-backend-proxy-all-modes.md
```

---

## Which mode should I use?

| Mode | Time | Stack | Persistence |
|---|---|---|---|
| **Easy** | ~1 hour | Express proxy + vanilla UI | None |
| **Medium** | ~2–3 hours | Express + MongoDB + vanilla UI | MongoDB* |
| **Hard** | ~4–6 hours | Express (routes/services/store) + MongoDB + Vitest + Docker | MongoDB* |

\* MongoDB when `MONGODB_URI` is set; an in-memory store otherwise. In every mode
the Anthropic key stays server-side, and the app runs in demo mode (sample
recipes) when no key is present — so all three run on just Node.

Start with **Easy** if you're new to AI app development. Each mode builds on the
previous one's planning docs. See the per-mode `PLANNING.md`, `PRD.md`, and
`ISSUES.md` for the full Challenge 1 deliverables.

---

## Quick Start

See the README in your chosen mode folder:
- [Easy mode →](easy/README.md)
- [Medium mode →](medium/README.md)
- [Hard mode →](hard/README.md)

---

## Testing (Challenge 5)

Every mode has an AI-generated test suite, reviewed to assert **behavior and
failure modes** — not just mirror the code. Stack: **Vitest** (unit + integration),
**Supertest** (HTTP), **Playwright** (browser E2E). All suites run offline in demo
mode (no API key required).

| Mode | Layers | Tests | Run |
|---|---|---|---|
| **Easy** | Unit (cache, model client) incl. failure/edge cases | 20 | `cd easy/cookbook-app && npm test` |
| **Medium** | Unit + **mocked deps** + **Supertest integration** + **jsdom frontend** | 23 | `cd medium/cookbook-app && npm test` |
| **Hard** | All of the above + **coverage** + **Playwright E2E** + fault injection | 44 + 2 E2E | `cd hard/cookbook-api && npm run test:all` |

Hard-mode extras:

```bash
cd hard/cookbook-api
npm run test:coverage   # V8 coverage report -> coverage/index.html (83% stmts)
npm run test:e2e        # boots the server + drives real Chromium
```

The full strategy — what each suite covers, the coverage gap analysis, and the
fault-injection exercise (deliberately break the code, prove a test catches it) —
is documented in **[hard/cookbook-api/TESTING.md](hard/cookbook-api/TESTING.md)**.

---

## Using with Codex (Challenge 2)

1. Install `mattpocock/skills` in this repo:
   ```
   npx skills add mattpocock/skills
   ```
2. Open Codex and run `$grill-me` — point it at your chosen mode's PLANNING.md
3. Run `$to-prd` to generate a PRD from the grilling session
4. Run `$to-issues` to break the PRD into GitHub issues
5. Start building!

The `AGENTS.md` file at the root will automatically ground Codex in the project's rules and constraints.
