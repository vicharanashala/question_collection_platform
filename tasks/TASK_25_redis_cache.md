# Task 25: Redis Integration — Caching & In-Memory Data Store

**Module:** Infrastructure  
**Status:** In Progress  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

Redis is to be integrated as the application's centralized caching and in-memory data store. The goal is to improve overall system performance, scalability, and responsiveness across all application surfaces.

### Scope

Redis integration must cover:
- Session management (user sessions, auth tokens)
- API response caching (high-read endpoints)
- Frequently accessed metadata (user profiles, configs, constants)
- Database query optimization (cached query results)
- Analytics data caching
- Rate limiting (request throttling per user/IP)
- Other high-read workloads

### Affected Surfaces

All four client surfaces share the same Redis infrastructure:
- **Ajrasakha Client** (mobile app — `/mobile`)
- **Review System** (curator/reviewer workflows)
- **Admin Portal** (web admin dashboard)
- **Coordinator Dashboard** (coordinator workflows)

### Architecture Principles

- Redis connection is managed via a single configurable client (`ioredis`)
- All Redis operations go through a dedicated service layer (`src/cache/redis.service.ts`)
- Cache keys follow a consistent naming convention: `{domain}:{entity}:{id}:{variant}`
- Cache TTLs are configurable via environment variables (`.env`)
- Cache invalidation is explicit and triggered on write operations (no TTL-only expiry reliance for business-critical data)
- No cross-tenant data leakage — Redis `SELECT` or key-namespacing per tenant when applicable
- The system degrades gracefully if Redis is unavailable (fallback to direct DB/ computation)
- **Hosting recommendation:** Self-hosted Redis on your own server is recommended over GCP Memorystore — zero extra cost, same network, no cross-cloud latency. See sub-task 12 for setup guide.

---

## Sub-Tasks

### 1. Infrastructure & Configuration
> **Note:** An existing `RedisService` already lives in `backend/src/auth/redis.service.ts`. Move it to `backend/src/cache/redis.service.ts` and extend it — do not rewrite it. OTP rate limiting in `auth/` depends on it.
> **Dev vs Prod:** In-memory fallback already exists and stays intact. Set `REDIS_ENABLED=false` in dev `.env` so the app never attempts a Redis connection and always uses `InMemoryStore`. Production (no flag or `REDIS_ENABLED=true`) uses `ioredis`. The `InMemoryStore` class must not be removed.
> **Self-hosted Redis:** Recommended over GCP Memorystore if the app runs on your own server — saves cost, same network, no latency penalty. See section "Redis Server Setup Guide" below for deployment instructions.
- [ ] Move `backend/src/auth/redis.service.ts` → `backend/src/cache/redis.service.ts`
- [ ] Add `REDIS_ENABLED` env flag: when `false`, skip `ioredis` connection entirely and use `InMemoryStore` from the start (no warning log). When `true` or unset, attempt `ioredis` connection.
- [ ] Extend `RedisService` with missing methods:
  - `mget`, `mset` batch helpers
  - `hget`, `hset`, `hgetall`, `hincrby` hash helpers
  - `zadd`, `zrange`, `zrevrange`, `zrangebyscore` sorted set helpers (for leaderboards)
  - `lock` / `unlock` helpers (for distributed locking)
  - `exists`, `scan` helpers
- [ ] Update `auth/auth.module.ts` to import `CacheModule` instead of declaring `RedisService` locally
- [ ] Ensure Redis configuration in `.env` covers: host, port, password, db index, TLS
- [ ] Ensure Redis configuration in `backend/src/config/` is validated and typed (extend existing if present)
- [ ] Create `backend/src/cache/cache.module.ts` — NestJS `@Global()` module registering `RedisService` as a singleton
- [ ] Create `backend/src/cache/cache.keys.ts` — centralized key name builder (prevents collisions, enforces convention)
- [ ] Register `CacheModule` in `AppModule`
- [ ] Add Redis connection status to the existing `/health` endpoint
- [ ] Docker Compose: add Redis service (`redis:7-alpine`) with persistence (`appendonly yes`)

### 2. Session Management
- [ ] Implement session store using Redis (replace or augment existing in-memory/token store)
- [ ] Store JWT refresh tokens in Redis with TTL matching token expiry
- [ ] Session data structure: `{ userId, deviceId, role, createdAt, lastActiveAt }`
- [ ] Session invalidation on logout (`DEL session:{userId}:{deviceId}`)
- [ ] Bulk session invalidation on password change or admin lock
- [ ] Redis key pattern: `session:{userId}:{deviceId}`
- [ ] TTL: 30 days (configurable via `SESSION_TTL_DAYS`)

### 3. API Response Caching
- [ ] Implement a cache decorator `@Cacheable(key, ttl?)` that serializes and stores responses in Redis
- [ ] Implement `@CacheInvalidate(key)` decorator for automatic invalidation on mutations
- [ ] Apply caching to high-read endpoints:
  - `GET /admin/users` — user list (TTL: 5 min)
  - `GET /admin/questions` — question list (TTL: 2 min)
  - `GET /admin/analytics/*` — analytics endpoints (TTL: 10 min)
  - `GET /public/leaderboard` — leaderboard data (TTL: 5 min)
  - `GET /wallets/:userId` — wallet balance (TTL: 1 min)
  - `GET /questions/featured` — featured questions (TTL: 10 min)
- [ ] Cache-aside (lazy loading) pattern: check cache → return if hit → compute → store → return
- [ ] Cache response must include `X-Cache: HIT|MISS` header for observability
- [ ] Do NOT cache: any endpoint with auth-state as a query param, any paginated endpoint with page > 1 (unless explicitly safe)

### 4. Frequently Accessed Metadata
- [ ] Cache static/semi-static config: `app_config`, `reward_tiers`, `question_domains`, `state_list`
- [ ] Redis key pattern: `meta:{name}` — e.g., `meta:reward_tiers`
- [ ] Pre-warm cache on app startup via a `CacheWarmupService` (runs on `OnModuleInit`)
- [ ] Invalidate metadata cache when admin updates config via admin endpoints
- [ ] TTL: 1 hour for metadata (configurable via `METADATA_CACHE_TTL_SECONDS`)

### 5. Database Query Optimization
- [ ] Cache expensive aggregation queries:
  - Leaderboard queries (`top_users_by_approved_questions`) — TTL: 5 min
  - Wallet balance aggregation — TTL: 1 min
  - Daily/weekly/monthly stats — TTL: 10 min
  - State-wise and crop-wise breakdown — TTL: 10 min
- [ ] Cache key pattern: `query:{name}:{hash_of_params}` — e.g., `query:leaderboard:weekly:abc123`
- [ ] Implement `QueryCacheService` with `getOrSet<T>(key, ttl, fn)` pattern
- [ ] Automatic invalidation of related query caches on question approval, reward credit, or user state change
- [ ] Max cacheable query result size: 1 MB (reject caching very large payloads)

### 6. Analytics Caching
- [ ] Cache all analytics dashboard data in Redis
- [ ] Per-metric TTLs (configurable):
  - Real-time counters (today's stats): 1 min
  - Daily aggregates: 10 min
  - Weekly/monthly aggregates: 30 min
- [ ] Use Redis sorted sets for time-series counters (append-only, aggregate on read)
- [ ] Analytics data structure: store as JSON strings in Redis (no Redis hashes for analytics — simplicity over memory efficiency at this scale)
- [ ] Implement cache-aside for analytics queries; pre-aggregate on write where possible

### 7. Rate Limiting
- [ ] Implement `@RateLimit(limit, windowSeconds)` decorator using Redis
- [ ] Apply rate limiting to:
  - OTP request endpoint: 3 per minute per phone number
  - Question submission: 10 per minute per user
  - Login attempts: 5 per minute per IP
  - Admin API calls: 100 per minute per admin user
  - Public API: 60 per minute per IP
- [ ] Redis key pattern: `ratelimit:{action}:{userId|ip}` with TTL = windowSeconds
- [ ] Return `429 Too Many Requests` with `Retry-After` header when limit exceeded
- [ ] Do NOT count failed requests differently from successful ones at the rate-limit layer (security: prevents enumeration)

### 8. High-Read Workload Optimizations
- [ ] Implement `HotDataService` for ultra-low-latency access to:
  - Top 100 users by approved questions (leaderboard) — refreshed every 5 min
  - Current reward tiers config — refreshed every hour
  - Today's submission/approval counts — refreshed every minute
  - Platform-wide total approved questions — refreshed every minute
- [ ] Use Redis sorted sets for leaderboard (`ZADD` with score = approved_question_count)
- [ ] Use `ZINCRBY` for real-time leaderboard score updates on question approval
- [ ] Leaderboard key: `leaderboard:top_users` (sorted set, descending)
- [ ] Warm leaderboard on startup; update on every question approval event

### 9. Cache Invalidation Strategy
- [ ] On question approval: invalidate `query:leaderboard:*`, `query:stats:*`, `meta:reward_tiers` (user's tier may change)
- [ ] On user wallet update: invalidate `wallet:{userId}`, `query:leaderboard:*`
- [ ] On admin config update: invalidate `meta:*` (all metadata)
- [ ] On user state change (suspend/activate): invalidate `session:{userId}:*`, `user:{userId}`
- [ ] Implement `@InvalidateCache(*patterns)` decorator that runs after mutation endpoints
- [ ] Provide a manual cache flush endpoint for super admins: `POST /admin/cache/flush` with `keyPattern` body param

### 10. Fast Exact Duplicate Detection
- [ ] On question submit: check Redis `EXISTS "dup:{userId}:{state}:{crop}:{normalized_text}"`
- [ ] If exists → reject immediately with 409 Duplicate, no DB hit
- [ ] If not exists → save to DB → `SET "dup:{userId}:{state}:{crop}:{normalized_text}" "1" NX` (no TTL, permanent)
- [ ] Normalization: trim whitespace, lowercase, remove leading/trailing punctuation
- [ ] On question deletion (admin/soft-delete): `DEL` the corresponding dup key
- [ ] Scope: per-user — a user cannot block other users from asking the same question
- [ ] This is the fast gate; semantic duplicate detection (Task 8) handles cross-user similarity

### 11. Observability & Monitoring
- [ ] Log cache hit/miss rates at INFO level (sampled: 1% of hits, 100% of misses)
- [ ] Track Redis memory usage via `INFO memory` — expose in health check
- [ ] Add Redis error handling: on connection failure, log error and fall back to direct DB (never block the request)
- [ ] Add `X-Cache-Key` and `X-Cache-TTL` response headers for debugging

### 12. Redis Server Setup Guide (Self-Hosted)
> For teams running the app on their own server. Skip if using GCP Memorystore.

#### Docker (recommended)
```bash
docker run -d \
  --name redis \
  -p 127.0.0.1:6379:6379 \
  -v /opt/redis/data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}"
```

#### Docker Compose (production)
```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - /opt/redis/data:/data
    command: >
      redis-server
      --appendonly yes
      --requirepass "${REDIS_PASSWORD}"
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
      --bind 127.0.0.1 <your-private-ip>
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3
```

#### Security Checklist (mandatory before production)
```conf
# /etc/redis/redis.conf
bind 127.0.0.1 <your-private-ip>    # NOT 0.0.0.0
requirepass <strong-password>
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG ""
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
```

#### TLS (only if app connects from a different network)
```conf
tls-port 6380
port 0
tls-cert-file /etc/redis/redis.crt
tls-key-file /etc/redis/redis.key
tls-ca-cert-file /etc/redis/ca.crt
```
Update `.env` when TLS is enabled:
```env
REDIS_PORT=6380
REDIS_TLS=true
```

#### Connecting the app
```env
REDIS_ENABLED=true
REDIS_HOST=<your-server-private-ip>
REDIS_PORT=6379
REDIS_PASSWORD=<your-password>
REDIS_TLS=false
```

---

## Configuration Reference

```env
# .env
REDIS_ENABLED=true          # false = use InMemoryStore only (dev), true = use ioredis (prod)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# TTLs (in seconds)
SESSION_TTL_DAYS=30
METADATA_CACHE_TTL_SECONDS=3600
QUERY_CACHE_TTL_SECONDS=300
ANALYTICS_REAL_TIME_TTL=60
ANALYTICS_DAILY_TTL=600
ANALYTICS_MONTHLY_TTL=1800
LEADERBOARD_TTL=300

# Rate Limits
RATE_LIMIT_OTP_PER_MIN=3
RATE_LIMIT_SUBMISSION_PER_MIN=10
RATE_LIMIT_LOGIN_PER_MIN=5
RATE_LIMIT_ADMIN_PER_MIN=100
RATE_LIMIT_PUBLIC_PER_MIN=60
```

---

## File Structure

```
backend/src/
├── cache/
│   ├── redis.service.ts        # ioredis wrapper with typed helpers
│   ├── cache.keys.ts           # Centralized key builder
│   ├── cache.module.ts         # NestJS module
│   ├── cache-warmup.service.ts # OnModuleInit — pre-load metadata
│   └── decorators/
│       ├── cacheable.decorator.ts
│       ├── cache-invalidate.decorator.ts
│       └── rate-limit.decorator.ts
├── config/
│   └── redis.config.ts         # Typed config validation
config/docker-compose.yml            # Redis service
.env.example                       # Document all Redis env vars
```

---

## Acceptance Criteria

- [ ] Redis connects successfully on app startup; graceful fallback when unavailable
- [ ] Sessions stored in Redis and invalidated correctly on logout
- [ ] Decorator-based caching (`@Cacheable`, `@CacheInvalidate`) works on any endpoint
- [ ] Rate limiting enforced on all specified endpoints with correct limits and 429 responses
- [ ] Analytics cached with appropriate TTLs; real-time counters updated via sorted sets
- [ ] Leaderboard uses Redis sorted set; score increments on question approval
- [ ] All cache keys follow the naming convention from `cache.keys.ts`
- [ ] Metadata pre-warmed on startup; invalidated on admin config update
- [ ] Health check endpoint returns Redis connection status
- [ ] No cross-tenant data access (if multi-tenant later)
- [ ] TypeScript builds clean (`tsc --noEmit`) in backend
- [ ] Docker Compose brings up Redis with persistence enabled
- [ ] Self-hosted Redis server accessible from backend with correct `REDIS_HOST` / `REDIS_PASSWORD` / `REDIS_TLS` settings
- [ ] Redis passes security checklist (password, bind to private IP, `appendonly yes`, maxmemory set)

---

## Notes

TBD during implementation