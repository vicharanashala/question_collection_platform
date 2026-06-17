/**
 * API Client with:
 * - Request deduplication (in-flight deduplication per URL)
 * - Memory cache with TTL
 * - Automatic token refresh (interceptor)
 * - Request queue (paused when offline, replayed on reconnect)
 * - Exponential backoff retry
 * - Error normalization
 */
import type { AuthUser } from '@/types'

const BASE = '/api'

// ─── Token helpers ─────────────────────────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

// ─── In-flight request deduplication ──────────────────────────────────────

const inflightRequests = new Map<string, Promise<unknown>>()

function deduplicate<T>(key: string, promise: Promise<T>): Promise<T> {
  const existing = inflightRequests.get(key)
  if (existing) return existing as Promise<T>
  inflightRequests.set(key, promise)
  promise.finally(() => inflightRequests.delete(key))
  return promise
}

// ─── Memory cache with TTL ─────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()

function getCache<T>(key: string, maxAgeMs: number): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { memoryCache.delete(key); return null }
  return entry.data
}

function setCache<T>(key: string, data: T, ttlMs: number) {
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

function invalidateCache(pattern?: string) {
  if (!pattern) { memoryCache.clear(); return }
  for (const k of memoryCache.keys()) {
    if (k.includes(pattern)) memoryCache.delete(k)
  }
}

// ─── Offline queue ─────────────────────────────────────────────────────────

interface QueuedRequest {
  path: string
  options: RequestInit
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
}

let isOnline = navigator.onLine

const offlineQueue: QueuedRequest[] = []

window.addEventListener('online', () => {
  isOnline = true
  const queue = offlineQueue.splice(0)
  queue.forEach((r) =>
    request(r.path, r.options, false).then(r.resolve).catch(r.reject)
  )
})
window.addEventListener('offline', () => { isOnline = false })

// ─── Retry with exponential backoff ───────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status = (err as { status?: number })?.status
      const is5xx = status === undefined || status >= 500
      if (!is5xx || attempt === retries) throw err
      await new Promise((res) => setTimeout(res, 2 ** attempt * 300))
    }
  }
  throw lastError
}

// ─── Core request ──────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  useCache = true,
): Promise<T> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  if (options.headers) {
    const h = options.headers as Record<string, string>
    Object.assign(headers, h)
    delete (options as Record<string, unknown>).headers
  }

  const doFetch = () =>
    withRetry(() =>
      fetch(`${BASE}${path}`, { ...options, headers } as HeadersInit).then(async (res) => {
        if (res.status === 401) {
          const refresh = getRefreshToken()
          if (refresh) {
            try {
              const refreshed = await fetch(`${BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refresh }),
              }).then((r) => r.json())
              if (refreshed.accessToken) {
                setTokens(refreshed.accessToken, refreshed.refreshToken ?? refresh)
                const retryRes = await fetch(`${BASE}${path}`, {
                  ...options,
                  headers: { ...headers, Authorization: `Bearer ${refreshed.accessToken}` } as HeadersInit,
                })
                return handleResponse(retryRes)
              }
            } catch { /* refresh failed */ }
          }
        }
        return handleResponse(res)
      })
    )

  if (useCache && options.method === undefined) {
    const cached = getCache<T>(path, 30_000)
    if (cached) return cached
    const result = deduplicate(path, doFetch() as Promise<T>)
    const data = await result
    setCache(path, data, 30_000)
    return data
  }

  if (!isOnline) {
    return new Promise((resolve, reject) => { offlineQueue.push({ path, options, resolve, reject }) })
  }

  return doFetch() as Promise<T>
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = (data as { message?: string })?.message
    const err: Error & { status: number; data: unknown } = Object.assign(new Error(msg ?? `Request failed with ${res.status}`), {
      status: res.status,
      data,
    })
    throw err
  }
  return res.json() as Promise<T>
}

// ─── Auth API ──────────────────────────────────────────────────────────────
// NOTE: Backend response shapes
//   requestOtp    → { message: string }
//   verifyOtp     → { tokens: { accessToken, refreshToken, expiresIn }, user: PublicUser }
//                  OR { requiresRegistration: true, tempToken: string, role: UserRole }
//   refreshTokens → { accessToken, refreshToken, expiresIn }
//   me            → { user: PublicUser }

export const authApi = {
  requestOtp: (mobileNumber: string, isWeb = false) =>
    request<{ message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, ...(isWeb ? { client: 'web' } : {}) }),
    }, false),

  verifyOtp: (mobileNumber: string, otp: string) =>
    request<{
      tokens?: { accessToken: string; refreshToken: string; expiresIn: number }
      user?: import('@/types').AuthUser
      requiresRegistration?: boolean
      tempToken?: string
      role?: string
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, otp }),
    }, false),

  refreshTokens: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }, false),

  me: () =>
    request<{ user: import('@/types').AuthUser }>('/auth/me', {}, true),

  updateMe: (body: { name?: string; languagePreference?: string }) =>
    request<{ user: import('@/types').AuthUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, false),
}

// ─── Admin API ─────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () =>
    request<import('@/types').AdminStats>('/admin/stats', {}, true),

  getUsers: (params = {} as Record<string, string | number | undefined>) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<import('@/types').PaginatedResponse<import('@/types').User>>(
      `/admin/users${qs ? `?${qs}` : ''}`,
    )
  },

  getUserDetail: (userId: string) =>
    request<{ user: import('@/types').User; questions: import('@/types').Question[] }>(
      `/admin/users/${userId}`,
      {}, false,
    ),

  verifyUser: (userId: string) =>
    request<{ message: string }>(`/admin/users/${userId}/verify`, { method: 'POST' }, false)
      .finally(() => invalidateCache('/api/admin')),

  suspendUser: (userId: string, body: { action: 'suspend' | 'ban'; reason: string; suspendedUntil?: string }) =>
    request<{ message: string }>(`/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, false).finally(() => invalidateCache('/api/admin')),

  unsuspendUser: (userId: string) =>
    request<{ message: string }>(`/admin/users/${userId}/unsuspend`, { method: 'POST' }, false)
      .finally(() => invalidateCache('/api/admin')),

  createUser: (body: {
    name: string
    mobileNumber: string
    role: string
    category?: string
    state: string
    district: string
    block?: string
    languagePreference?: string
  }) =>
    request<{ message: string; user: import('@/types').User }>(
      '/admin/users',
      { method: 'POST', body: JSON.stringify(body) },
      false,
    ).finally(() => invalidateCache('/api/admin')),

  getConfig: () =>
    request<{ items: import('@/types').ConfigItem[] }>('/admin/config'),

  updateConfig: (body: { key: string; value: number }) =>
    request<{ message: string }>('/admin/config', { method: 'PATCH', body: JSON.stringify(body) }, false)
      .finally(() => invalidateCache('/api/admin')),

  listWithdrawals: (params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<import('@/types').PaginatedResponse<import('@/types').Withdrawal>>(
      `/admin/withdrawals${qs ? `?${qs}` : ''}`,
    )
  },

  processWithdrawal: (id: string, body: { action: 'approve' | 'reject'; failureReason?: string }) =>
    request<{ message: string }>(`/admin/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, false).finally(() => invalidateCache('/api/admin')),

  // ─── Wallet management ──────────────────────────────────────────────────────
  getWallets: (params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<import('@/types').PaginatedResponse<import('@/types').WalletSummary>>(
      `/admin/wallets${qs ? `?${qs}` : ''}`,
    )
  },

  getUserTransactions: (userId: string, params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<{
      items: import('@/types').Transaction[]
      total: number
      summary: { totalTransactions: number; totalCredits: number; totalDebits: number }
    }>(`/admin/wallets/user/${userId}/transactions${qs ? `?${qs}` : ''}`)
  },

  getUserWithdrawals: (userId: string, params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<import('@/types').PaginatedResponse<import('@/types').Withdrawal>>(
      `/admin/wallets/user/${userId}/withdrawals${qs ? `?${qs}` : ''}`,
    )
  },

  adjustWallet: (userId: string, body: { amount: number; reason: string; description?: string }) =>
    request<{ message: string; newBalance: number }>(`/admin/wallets/adjust`, {
      method: 'POST',
      body: JSON.stringify({ userId, ...body }),
    }, false).finally(() => invalidateCache('/api/admin')),
}

// ─── Questions API ─────────────────────────────────────────────────────────

export const questionApi = {
  getQuestions: (params = {} as Record<string, string | number | undefined>) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<import('@/types').PaginatedResponse<import('@/types').Question>>(
      `/questions${qs ? `?${qs}` : ''}`,
    )
  },

  getQuestion: (id: string) =>
    request<import('@/types').Question>(`/questions/${id}`),

  approveQuestion: (id: string) =>
    request<{ message: string }>(`/questions/${id}/approve`, { method: 'POST' }, false)
      .finally(() => invalidateCache('/api/questions')),

  rejectQuestion: (id: string, reason?: string) =>
    request<{ message: string }>(`/questions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, false).finally(() => invalidateCache('/api/questions')),
}

// ─── Curator API ───────────────────────────────────────────────────────────

export const curatorApi = {
  getReviewQueue: (params = {} as Record<string, string | number | undefined>) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
    const qs = new URLSearchParams(p).toString()
    return request<import('@/types').PaginatedResponse<import('@/types').Question>>(
      `/admin/questions/queue${qs ? `?${qs}` : ''}`,
    )
  },

  getQuestion: (id: string) =>
    request<import('@/types').Question>(`/admin/questions/${id}`),

  reviewQuestion: (id: string, body: { action: 'approve' | 'reject' | 'hold'; reason?: string; heldReason?: string }) =>
    request<{
      message?: string;
      success: boolean;
      action: string;
      rewardCredited?: number;
      newBalance?: number;
      rejectionReason?: string;
      heldReason?: string;
    }>(`/admin/questions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, false).finally(() => invalidateCache('/api/admin')),
}

// ─── Cache control ─────────────────────────────────────────────────────────

export const cache = { invalidate: invalidateCache }

// ─── Error helper ──────────────────────────────────────────────────────────

export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'data' in e) {
    return ((e as { data: { message?: string } }).data?.message) ?? fallback
  }
  return fallback
}