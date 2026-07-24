---
name: sync-across-modes
description: Use when changing UI or API behavior in the AI Cookbook apps. Easy, Medium, and Hard share one UI and API contract; this skill ensures a change is applied to all three and verified, instead of leaving them inconsistent.
---

# Sync a change across Easy / Medium / Hard

The three canonical apps share near-identical UI and the same API contract. A
change to one almost always belongs in all three. (A single UI fix once took three
rounds because it wasn't propagated.)

## App map
| Mode | Server | UI |
|---|---|---|
| Easy | `easy/cookbook-app/server.js` + `lib/` | `easy/cookbook-app/public/` |
| Medium | `medium/cookbook-app/server.js` + `lib/` | `medium/cookbook-app/public/` |
| Hard | `hard/cookbook-api/src/` (routes/services/store) | `hard/cookbook-api/public/` |

Differences to respect: Easy has no save/community/persistence; Medium/Hard do.
Hard splits logic into `routes/services/store` + has Vitest tests + Redis option.

## Procedure
1. Make the change in one mode and confirm it works.
2. Apply the equivalent change to the other two — mind the structural differences
   (Hard's service/route split; Easy's lack of save). Keep `public/` files in sync.
3. If the change touches the API contract, update validation, cache key, and the
   saved-recipe shape consistently in all three.
4. Update Hard's tests (`hard/cookbook-api/test/`) if behavior changed.
5. **Verify each app**: `node scripts/verify-app.mjs <appDir>` for easy, medium,
   and hard. All checks must pass.
6. Update docs if behavior changed (READMEs, ARCHITECTURE, ADRs).

## Guardrails
- Don't leave the three modes inconsistent — that's the failure this skill prevents.
- Apps run in DEMO + in-memory mode (no API key / DB here); verify accordingly.
