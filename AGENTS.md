# AGENTS.md — Agent Operating Contract
## AI Cookbook Project

## Mission
You are an engineering assistant building the AI Cookbook web application. Optimize for: correctness, minimal diffs, testable changes, and adherence to the architecture defined in ARCHITECTURE.md.

## Non-Negotiables (Always True)
1. Do not guess project behavior or architecture. Read ARCHITECTURE.md and the relevant mode's PLANNING.md first.
2. No secrets: never hardcode API keys, tokens, or credentials. Always use environment variables (`.env` / `.env.local`). Never commit secret files.
3. Always use model `claude-sonnet-4-6` when calling the Anthropic API. Do not substitute another model.
4. No silent breaking changes: do not change API contracts or database schemas without updating the relevant docs.
5. Minimal viable change: implement only what is described in the active mode's PLANNING.md. No unrequested features.
6. Always leave the repo healthier: update tests and README if you add or change behavior.
7. In EVERY mode, the frontend must NEVER call the Anthropic API directly. All AI calls go through the Express backend (see ADR 0004). The key lives only in the backend env.

## Working Agreements (captured from sessions — Evaluation & Learning Capture loop)
1. **Recon before build.** Before creating any file, inventory what already exists
   (`find`/`ls` the relevant dirs). This repo has TWO lineages — canonical
   `*/cookbook-app` / `hard/cookbook-api` (Mongo/vanilla) and archived
   `legacy/*/app` (Postgres/React, Codex-built Challenges 2–3). Never build a
   duplicate or claim "not started" without scanning first.
2. **Mirror across the three modes.** Easy/Medium/Hard share the same UI and API
   contract. Any UI/contract change must be applied to ALL three and verified in
   one pass — don't leave them inconsistent.
3. **Keep it simple and straightforward** — the operator's standing preference.
   When a decision is delegated ("go with the most recommended"), proceed with a
   clear recommendation rather than over-asking.
4. **Runtime reality:** no Anthropic key is available → apps run in DEMO mode
   (sample recipes); no `MONGODB_URI`/`REDIS_URL` → in-memory store/cache. Ports:
   3000 (easy/medium), 4000 (hard). `NO_OPEN=1` disables the browser auto-open.

## Default Workflow
1. Clarify scope: state which mode (easy/medium/hard) and which phase you are implementing.
2. Read first: open the relevant PLANNING.md, README.md, and ARCHITECTURE.md before writing code.
3. Plan briefly: list the files you will create/modify and the order of operations.
4. Implement: create files, keep changes localized.
5. Validate: confirm the app runs and the verify steps in README.md pass.
6. Report: list files changed and any TODOs remaining.

## STOP Gates (Hard Preconditions)

### STOP: API Key / Secrets
Trigger: any reference to `ANTHROPIC_API_KEY` or database credentials in code.
Must do first:
* Confirm the value is read from `process.env` or `import.meta.env` — never hardcoded
* Confirm the `.env` file is listed in `.gitignore`

### STOP: Anthropic API Call
Trigger: writing code that calls `https://api.anthropic.com/v1/messages`.
Must do first:
* Confirm model is `claude-sonnet-4-6`
* Confirm `max_tokens` is set to 2000 (raised from 1000 to avoid truncated JSON)
* Confirm the prompt instructs Claude to respond with JSON only (no markdown, no backticks)
* Confirm error handling exists for non-JSON responses: strip fences → parse in
  try/catch → branch on an `{ "error": ... }` payload
* Confirm a demo fallback exists for when `ANTHROPIC_API_KEY` is unset

### STOP: Database / Storage (Medium & Hard)
Trigger: creating or altering recipe storage.
Must do first:
* Open the mode's `PLANNING.md` / `PRD.md` → Domain Model section
* Storage is MongoDB (see ADR 0003) — no SQL migrations. On startup, ensure the
  unique index `{ generationId: 1 }`; saves are idempotent upserts on that key.
* An in-memory driver must remain as the no-`MONGODB_URI` fallback.

### STOP: Adding Dependencies
Trigger: any `npm install <package>` beyond the approved list.
Must do first:
* Open `docs/dependencies.md`
* Confirm the package is justified and not duplicating existing functionality

## Repo Map
| Area | Must Read First | Must Run Before Final |
|---|---|---|
| `easy/cookbook-app/` | `easy/PLANNING.md`, `easy/README.md` | `npm start`, verify recipe generates at :3000 |
| `medium/cookbook-app/` | `medium/PLANNING.md`, `medium/README.md` | `npm start`, verify save/load at :3000 |
| `hard/cookbook-api/` | `hard/PLANNING.md`, `ARCHITECTURE.md` | `npm test`, verify `/api/health` at :4000 |
| `docs/` | N/A | N/A |

## Canonical Commands

### Easy Mode
* Setup: `cd easy/cookbook-app && npm install`
* Run: `npm start` → http://localhost:3000

### Medium Mode
* Setup: `cd medium/cookbook-app && npm install`
* Run: `npm start` → http://localhost:3000

### Hard Mode — Backend (serves the UI too)
* Setup: `cd hard/cookbook-api && npm install`
* Run: `npm start` → http://localhost:4000
* Test: `npm test`

### Docker (Hard Mode)
* Start all (API + MongoDB): `cd hard && docker compose up`

> No API key? Every mode runs in DEMO mode (sample recipes). No `MONGODB_URI`?
> Medium/Hard use an in-memory store. Both upgrade with zero code change.

## Output Expectations
When you finish a task, provide:
* Files created or changed (short list)
* Commands run and their results
* Any TODOs or known gaps
* Confirmation that all STOP gates were followed
