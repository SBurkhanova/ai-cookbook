# Deployment — AI Cookbook API (Challenge 7)

How the Hard-mode API (`hard/cookbook-api`) is containerized, tested in CI, and
deployed to **Azure App Service (Web App for Containers)** via **GitHub Actions**.

> **Status:** this is *deployment-ready* configuration. The pipelines are correct
> but only run once the repo is pushed to GitHub, and no Azure resources are
> created until you run the Bicep deployment with your own subscription. Nothing
> here provisions cloud resources or deploys on its own.

---

## 1. The container

The [`Dockerfile`](cookbook-api/Dockerfile) is a multi-stage build:

1. **deps** stage runs `npm ci --omit=dev` against the lockfile (reproducible,
   production-only dependencies).
2. **runtime** stage copies those deps plus `src/` and `public/`, runs as the
   non-root `node` user, and defines a `HEALTHCHECK` that probes `/api/health`.

Build and run locally:

```bash
cd hard/cookbook-api
docker build -t cookbook-api:local .
docker run --rm -p 4000:4000 cookbook-api:local
# -> http://localhost:4000  (DEMO mode: no API key needed)
```

Or the full stack (API + Mongo + Redis) with [`docker-compose.yml`](docker-compose.yml):

```bash
cd hard
docker compose up --build
```

The app runs in **demo mode** with no `ANTHROPIC_API_KEY` and falls back to an
in-memory store/cache when `MONGODB_URI` / `REDIS_URL` are unset — so the image
runs anywhere with zero configuration.

---

## 2. Environment / secrets

Configuration is 12-factor: everything comes from environment variables. See
[`.env.production.example`](cookbook-api/.env.production.example) for the full
list. The security-sensitive one is `ANTHROPIC_API_KEY`.

| Variable | Purpose | Where it lives in Azure |
|---|---|---|
| `WEBSITES_PORT` | Tells App Service the container listens on 4000 | Application setting |
| `PORT` | Port the app binds | Application setting (=4000) |
| `ANTHROPIC_API_KEY` | Live Claude calls (empty = demo) | **Secret** application setting |
| `MONGODB_URI` | Recipe persistence (optional) | Application setting |
| `REDIS_URL` | Shared cache (optional) | Application setting |
| `CLIENT_ORIGIN` | CORS allowlist (optional) | Application setting |

**Secrets are never committed.** In CI/CD they come from GitHub Actions secrets;
at runtime they come from App Service application settings.

---

## 3. Infrastructure (Bicep)

[`infra/main.bicep`](../infra/main.bicep) provisions the minimum needed:

- an **Azure Container Registry (ACR)** to hold the image,
- a **Linux App Service Plan**,
- a **Web App for Containers** with the health-check path set to `/api/health`
  and `WEBSITES_PORT=4000`.

Provision it (one time):

```bash
az group create -n cookbook-rg -l eastus
az deployment group create \
  -g cookbook-rg \
  -f infra/main.bicep \
  -p infra/main.parameters.json
```

The deployment outputs the ACR login server and the Web App name — feed those
into the GitHub secrets below.

---

## 4. CI — checks on every PR

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and
pull request as separate checks:

1. **`test-and-build`** — `npm ci` → `npm test` (the **89 Vitest tests** from
   Challenge 5) → `docker build`. **If a test fails, the image is never built.**
2. **`e2e`** — installs Chromium and runs the Playwright browser tests.

Enable branch protection on `main` requiring these checks so a PR can't merge
until they pass.

---

## 5. CD — deploy to Azure (build → approval → deploy → smoke → rollback)

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs on push to
`main` (and manual `workflow_dispatch`). It is **gated**: it does nothing until
the required secrets exist, so it can't deploy by accident.

Flow:

1. **build** — build the image, push to ACR (tagged by commit SHA).
2. **manual approval** — the `deploy` job targets the `production` environment,
   so GitHub **pauses for a human to approve** before anything ships.
3. **deploy** — push the image to the Web App (App Service probes `/api/health`
   before routing traffic).
4. **smoke test** — Playwright hits the **live URL** (`test:smoke`).
5. **rollback** — if the smoke test fails, redeploy the previously running image
   and fail the job. The smoke-test report is uploaded as an artifact either way.

### One-time approval setup

In GitHub → **Settings → Environments → New environment → `production`**, add
yourself (or a team) as a **Required reviewer**. That is what makes the deploy
pause for manual approval.

### Required GitHub repository secrets

| Secret | How to get it |
|---|---|
| `AZURE_CREDENTIALS` | `az ad sp create-for-rbac --sdk-auth --role contributor --scopes /subscriptions/<sub>/resourceGroups/cookbook-rg` |
| `ACR_LOGIN_SERVER` | Output of the Bicep deployment (e.g. `cookbookacr.azurecr.io`) |
| `AZURE_WEBAPP_NAME` | Output of the Bicep deployment |
| `ANTHROPIC_API_KEY` | (Optional) your Claude key; pushed into App Service settings on deploy |

---

## 6. Health, rollback, and safety

- **Health probe:** App Service is configured with health-check path
  `/api/health`. A new deployment only receives traffic once the probe passes.
- **Automated rollback:** the deploy job captures the currently-running image
  first; if the post-deploy smoke test fails, it redeploys that previous image
  and marks the run failed. Images are tagged by commit SHA, so a manual rollback
  is also just "redeploy the previous SHA".
- **Manual approval:** the `production` environment requires a reviewer, so no
  code reaches production without a human in the loop — even when CI is green.
- **Zero-downtime (optional):** add a staging deployment slot and swap after the
  probe is green.

---

## 7. Known constraints (be honest in the demo)

- This folder is **not yet a git repository**; the workflows are valid but only
  execute once pushed to GitHub.
- These files **do not create Azure resources** — running the Bicep deployment
  and the live deploy requires your Azure subscription and credentials.
