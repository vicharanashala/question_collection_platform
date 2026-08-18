FROM node:22-slim AS deps

WORKDIR /app

COPY package.json ./
# Delete stale lock file — package.json is always in sync but package-lock.json may not be.
# Remove it so npm install fetches fresh based on package.json only.
RUN rm -f package-lock.json && npm install --omit=dev && npm cache clean --force

FROM node:22-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* /tmp/*

COPY package.json ./
RUN rm -f package-lock.json && npm install && npm cache clean --force

COPY tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/

RUN npx tsc --noEmit \
    && npx nest build \
    && npm prune --omit=dev

FROM node:22-slim AS runtime

# Tailscale userspace binary (glibc-based, requires Debian-slim not Alpine)
COPY --from=ghcr.io/tailscale/tailscale:latest /usr/local/bin/tailscaled /app/tailscaled
COPY --from=ghcr.io/tailscale/tailscale:latest /usr/local/bin/tailscale /app/tailscale

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/* /tmp/*

WORKDIR /app

# Cloud Run injects PORT=8080 into every container. Set default in case it's absent.
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/public ./public

# Web frontend SPA build — served by NestJS at /, /login, /admin, etc.
# WEB_DIST_PATH is passed as a Cloud Run env var so main.ts finds it at runtime.
COPY web/dist ./web/dist

COPY scripts/start.sh ./scripts/start.sh

# Entrypoint script starts tailscaled first, then the NestJS app via dumb-init
ENTRYPOINT ["/bin/sh", "scripts/start.sh"]

EXPOSE 8080

# Entrypoint handles tailscaled startup; start.sh ends with exec dumb-init node dist/main.js
# (CMD below is unreachable but kept for `docker run` without start.sh compatibility)