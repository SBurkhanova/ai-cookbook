# SECURITY.md — Security & Data Handling
## AI Cookbook Project

## Secrets
* Never commit API keys, tokens, or database credentials to version control.
* Backend secrets live in each app's `.env` (`cookbook-app/.env` or
  `cookbook-api/.env`) — these files must be in `.gitignore`.
* Local dev: put the real key in `.env`. In CI/CD (Challenge 7), inject via Azure
  App Service environment variables.

## API Key Rules
* `ANTHROPIC_API_KEY` must ONLY ever appear in backend server code, in EVERY mode
  (see ADR 0004). It is never sent to or embedded in the browser.
* The key is read via `process.env.ANTHROPIC_API_KEY` inside `anthropicClient.js`
  only. If it is unset, the app runs in demo mode (no network call).
* The browser only ever talks to the app's own `/api/*` endpoints.

## PII / Sensitive Data
* This app does not collect user accounts, email addresses, or personal information in MVP.
* Ingredients and generated recipes are not considered sensitive.
* Do not log full API request/response bodies to the console in production.

## Dependencies
* Allowed package managers: npm only
* Registries: public npmjs.com registry only
* Do not introduce packages with GPL or AGPL licenses without team discussion
* Before adding any new package, open `docs/dependencies.md`

## Reporting
* For security issues found during the hackathon, flag them in the project README or raise with Jason H / Michael S directly.
