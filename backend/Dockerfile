FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json ./
# Delete stale lock file — package.json is always in sync but package-lock.json may not be.
# Remove it so npm install fetches fresh based on package.json only.
RUN rm -f package-lock.json && npm install --omit=dev && npm cache clean --force

FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache \
    ffmpeg \
    bash \
    && rm -rf /var/cache/apk/* /tmp/*

COPY package.json ./
RUN rm -f package-lock.json && npm install && npm cache clean --force

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npx tsc --noEmit \
    && npx nest build \
    && npm prune --omit=dev

FROM node:22-alpine AS runtime

# Tailscale userspace binary (no kernel module, no TUN device)
COPY --from=ghcr.io/tailscale/tailscale:latest /usr/local/bin/tailscaled /usr/local/bin/tailscaled
COPY --from=ghcr.io/tailscale/tailscale:latest /usr/local/bin/tailscale /usr/local/bin/tailscale

RUN apk add --no-cache ffmpeg bash ca-certificates curl \
    && rm -rf /var/cache/apk/* /tmp/*

WORKDIR /app

# Cloud Run injects PORT=8080 into every container. Set default in case it's absent.
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY scripts/start.sh ./scripts/start.sh

# Entrypoint script starts tailscaled first, then the NestJS app
ENTRYPOINT ["/bin/sh", "scripts/start.sh"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8080}/health || exit 1