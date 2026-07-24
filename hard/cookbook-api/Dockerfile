# syntax=docker/dockerfile:1
# Multi-stage build for the AI Cookbook API (Challenge 7 — Deployment).
# Stage 1 installs production dependencies against the lockfile; the final
# stage copies only those deps + app source, runs as a non-root user, and
# exposes a container HEALTHCHECK that Azure App Service can probe.

# ---- deps: reproducible production install ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: slim, non-root ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    NO_OPEN=1
WORKDIR /app

# Bring in the pre-installed production dependencies and the app itself.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# Drop privileges: run as the image's built-in unprivileged `node` user.
USER node

EXPOSE 4000

# BusyBox wget ships in alpine; shell form so ${PORT} expands at runtime.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "src/index.js"]
