FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache \
    ffmpeg \
    bash \
    && rm -rf /var/cache/apk/* /tmp/*

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npx tsc --noEmit \
    && npx nest build --copy-files \
    && npm prune --production

FROM node:22-alpine AS runtime

RUN apk add --no-cache ffmpeg bash ca-certificates \
    && rm -rf /var/cache/apk/* /tmp/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

RUN addgroup -g 1001 -S appgroup \
    && adduser -u 1001 -S appuser -G appgroup \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]