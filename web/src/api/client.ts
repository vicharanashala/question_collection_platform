/**
 * API Client with:
 * - Request deduplication (in-flight deduplication per URL)
 * - Memory cache with TTL
 * - Automatic token refresh (interceptor)
 * - Request queue (paused when offline, replayed on reconnect)
 * - Exponential backoff retry
 * - Error normalization
 */
import type {
  AuthUser,
  AdminStats,
  User,
  Question,
  Faq,
  ConfigItem,
  Withdrawal,
  WalletSummary,
  Transaction,
  Notification,
  PaginatedResponse,
  AnalyticsDashboard,
  UserAnalytics,
  QuestionAnalytics,
  RewardAnalytics,
  ExportParams,
  AuditLogsResponse,
  AuditStatsResponse,
  AuditSummaryResponse,
  AuditEntityHistoryResponse,
  AuditUsersByRoleResponse,
  Report,
  ReportReply,
  FinalQuestion,
  DistributorStats,
} from '@/types'
import { accountLockedEmitter, parseAccountLocked } from '@/events/accountLockedEvents'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// ─── Token helpers ─────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
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

function getCache<T>(key: string, _maxAgeMs: number): T | null {
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

export async function request<T>(
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

  const doFetch = () => {
    const url = `${BASE}${path}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    return withRetry(() =>
      fetch(url, { ...options, headers, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId))
        .then(async (res) => {
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
                  headers: { ...headers, Authorization: `Bearer ${refreshed.accessToken}` },
                })
                // Check 423 on retry response before general handleResponse so the
                // lock event fires even when handleResponse throws.
                if (retryRes.status === 423) {
                  const data = await retryRes.json().catch(() => ({}))
                  const locked = parseAccountLocked(data)
                  if (locked) accountLockedEmitter.emit(locked)
                }
                return handleResponse(retryRes)
              }
            } catch { /* refresh failed */ }
          }
        }
        return handleResponse(res)
      })
    )
  }

  if (useCache && options.method === undefined) {
    const cached = getCache<T>(path, 30_000)
    if (cached) return cached
    const result = deduplicate(path, doFetch() as Promise<T>)
    const data = await result
    setCache(path, data, 30_000)
    return data
  }

  return doFetch() as Promise<T>
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = (data as { message?: string })?.message

    // 423 Locked — user was suspended/banned. Emit event so the auth layer can
    // auto-logout and show the locked modal.
    if (res.status === 423) {
      const locked = parseAccountLocked(data)
      if (locked) accountLockedEmitter.emit(locked)
    }

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
  requestOtp: (mobileNumber: string, isWeb = false) => {
    return request<{ message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, ...(isWeb ? { client: 'web' } : {}) }),
    }, false)
  },

  verifyOtp: (mobileNumber: string, otp: string) =>
    request<{
      tokens?: { accessToken: string; refreshToken: string; expiresIn: number }
      user?: AuthUser
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
    // Never cache me() — it is the authoritative source of current user state including locks
    request<{ user: AuthUser }>('/auth/me', {}, false),

  updateMe: (body: { name?: string; languagePreference?: string }) =>
    request<{ user: AuthUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, false),

  /**
   * Complete new-user registration. Called AFTER `verifyOtp` returned
   * `{ requiresRegistration: true, tempToken, role }`. The endpoint is
   * public — the backend identifies the user by `mobileNumber` (no JWT
   * required for this call).
   *
   * On success returns `{ tokens, user }` — the wizard should immediately
   * `login()` so the public user is authenticated.
   */
  register: (body: {
    mobileNumber: string
    name: string
    username: string
    category: string
    state: string
    district: string
    block?: string
    village?: string
    kvk?: string
    age?: number
    gender?: string
    farmSize?: string
    cropType?: string
    courseName?: string
    collegeName?: string
    universityName?: string
    organisationType?: string
    organizationName?: string
    organizationRole?: string
    numberOfFarmers?: number
    organizationState?: string
    organizationDistrict?: string
    organizationBlock?: string
    organizationVillage?: string
    season?: string
    volunteerCropType?: string
    languagePreference: string
    consentGiven: boolean
  }) =>
    request<{
      tokens: { accessToken: string; refreshToken: string; expiresIn: number }
      user: AuthUser
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }, false),

  /** Check whether a username is available. */
  checkUsername: (username: string) =>
    request<{
      username: string
      available: boolean
      suggestions: string[]
    }>(`/auth/check-username?username=${encodeURIComponent(username)}`, {}, false),

  /** Suggest N available usernames based on a base string. */
  suggestUsernames: (base: string, limit = 5) =>
    request<{ suggestions: string[] }>(
      `/auth/suggest-usernames?base=${encodeURIComponent(base)}&limit=${limit}`,
      {},
      false,
    ),
}

// ─── LGD / Location API ───────────────────────────────────────────────────

export interface LgdState    { code: string; name: string }
export interface LgdDistrict  { code: string; name: string; stateCode: string }
export interface LgdSubDistrict { code: string; name: string; districtCode: string }
export interface LgdVillage   { code: string; name: string; blockCode: string }
export interface LgdKvk       { code: string; name: string; address: string; districtCode: string; stateCode: string }

export const lgdApi = {
  getStates: () =>
    request<{ states: LgdState[] }>('/lgd/states', {}, false),

  getDistricts: (stateCode: string) =>
    request<{ districts: LgdDistrict[] }>(`/lgd/districts?stateCode=${stateCode}`, {}, false),

  getSubDistricts: (districtCode: string) =>
    request<{ subdistricts: LgdSubDistrict[] }>(`/lgd/subdistricts?districtCode=${districtCode}`, {}, false),

  getVillages: (blockCode: string) =>
    request<{ villages: LgdVillage[] }>(`/lgd/villages?blockCode=${blockCode}`, {}, false),

  getKvks: (districtCode: string) =>
    request<{ kvks: LgdKvk[] }>(`/lgd/kvks?districtCode=${districtCode}`, {}, false),
}

// ─── Admin API ─────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () =>
    request<AdminStats>('/admin/stats', {}, true),

  getUsers: (params = {} as Record<string, string | number | undefined>) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<PaginatedResponse<User>>(
      `/admin/users${qs ? `?${qs}` : ''}`,
    )
  },

  getUserDetail: (userId: string) =>
    request<{ user: User; questions: Question[]; paymentDetails: import('@/types').PaymentDetail[] }>(
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
    block: string
    village: string
    languagePreference?: string
  }) =>
    request<{ message: string; user: User }>(
      '/admin/users',
      { method: 'POST', body: JSON.stringify(body) },
      false,
    ).finally(() => invalidateCache('/api/admin')),

  getConfig: () =>
    request<{ items: ConfigItem[] }>('/admin/config'),

  updateConfig: (body: { key: string; value: number }) =>
    request<{ message: string }>('/admin/config', { method: 'PATCH', body: JSON.stringify(body) }, false)
      .finally(() => invalidateCache('/api/admin')),

  getWithdrawalWithTransactions: (id: string) =>
    request<{
      id: string; amount: number; payoutMethod: string; status: string;
      orderId: string | null; createdAt: string; processedAt: string | null;
      rejectionReason: string | null; failureReason: string | null;
      user: { id: string; name: string; mobileNumber: string } | null;
      transactions: Array<{
        id: string; type: string; amount: number; status: string;
        rejectionReason: string | null; description: string; source: string; createdAt: string;
      }>;
      paymentLogs: Array<{
        id: string; orderId: string; pinelabsTransactionId: string | null;
        razorpayPayoutId: string | null; status: string; errorCode: string | null;
        errorMessage: string | null; rawResponse: Record<string, unknown> | null; attemptedAt: string;
      }>;
    }>(`/admin/withdrawals/${id}`, {}, false),

  listWithdrawals: (params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<PaginatedResponse<Withdrawal>>(
      `/admin/withdrawals${qs ? `?${qs}` : ''}`,
      {},
      false, // bypass cache — withdrawal state changes frequently and must reflect immediately
    )
  },

  processWithdrawal: (id: string, body: { action: 'approve' | 'reject'; rejectionReason?: string }) =>
    request<{
      success: boolean
      action: string
      withdrawalId: string
      status: string
      paymentFailed?: boolean
      errorCode?: string
      errorMessage?: string
    }>(`/admin/withdrawals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, false).finally(() => invalidateCache('/api/admin')),

  markWithdrawalFailed: (id: string, reason: string) =>
    request<{ success: boolean; withdrawalId: string; status: string }>(
      `/admin/withdrawals/${id}/fail`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      false,
    ).finally(() => invalidateCache('/api/admin')),

  retryWithdrawal: (id: string) =>
    request<{ success: boolean; withdrawalId: string; status: string }>(
      `/admin/withdrawals/${id}/retry`,
      { method: 'POST' },
      false,
    ).finally(() => invalidateCache('/api/admin')),

  retryFailedWithdrawal: (id: string) =>
    request<{
      success: boolean;
      withdrawalId: string;
      status: string;
      paymentFailed?: boolean;
      errorCode?: string | null;
      errorMessage?: string | null;
    }>(
      `/admin/withdrawals/${id}/retry-refund`,
      { method: 'POST' },
      false,
    ).finally(() => invalidateCache('/api/admin')),

  updateWithdrawalFailureReason: (id: string, reason: string) =>
    request<{ success: boolean; withdrawalId: string }>(
      `/admin/withdrawals/${id}/failure-reason`,
      { method: 'PATCH', body: JSON.stringify({ reason }) },
      false,
    ).finally(() => invalidateCache('/api/admin')),

  // ─── Wallet management ──────────────────────────────────────────────────────
  getWallets: (params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<PaginatedResponse<WalletSummary>>(
      `/admin/wallets${qs ? `?${qs}` : ''}`,
    )
  },

  getUserTransactions: (userId: string, params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<{
      items: Transaction[]
      total: number
      summary: { totalTransactions: number; totalCredits: number; totalDebits: number }
    }>(`/admin/wallets/user/${userId}/transactions${qs ? `?${qs}` : ''}`)
  },

  getUserWithdrawals: (userId: string, params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<PaginatedResponse<Withdrawal>>(
      `/admin/wallets/user/${userId}/withdrawals${qs ? `?${qs}` : ''}`,
    )
  },

  adjustWallet: (userId: string, body: { amount: number; reason: string; description?: string }) =>
    request<{ message: string; newBalance: number }>(`/admin/wallets/adjust`, {
      method: 'POST',
      body: JSON.stringify({ userId, ...body }),
    }, false).finally(() => invalidateCache('/api/admin')),

  getFinancialSummary: (params: Record<string, string | number | undefined> = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<{
      totalPaidOut: number
      pendingWithdrawals: { count: number; amount: number }
      completedWithdrawals: { count: number; amount: number }
      failedWithdrawals: { count: number }
      totalWalletBalance: number
      today: { payoutCount: number; payoutAmount: number }
      dailyPayoutTrend: Array<{ date: string; count: number; amount: number }>
    }>(`/admin/analytics/financial-summary${qs ? `?${qs}` : ''}`)
  },
}

// ─── Analytics API (Task 11) ───────────────────────────────────────────────────

function buildQS(p: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) sp.set(k, String(v))
  }
  return sp.toString()
}

export const analyticsApi = {
  getDashboard: (params: Record<string, string | number | undefined> = {}) => {
    const qs = buildQS(params)
    return request<AnalyticsDashboard>(`/analytics/dashboard${qs ? `?${qs}` : ''}`)
  },

  getUserAnalytics: (params: Record<string, string | number | undefined> = {}) => {
    const qs = buildQS(params)
    return request<UserAnalytics>(`/analytics/users${qs ? `?${qs}` : ''}`)
  },

  getQuestionAnalytics: (params: Record<string, string | number | undefined> = {}) => {
    const qs = buildQS(params)
    return request<QuestionAnalytics>(`/analytics/questions${qs ? `?${qs}` : ''}`)
  },

  getRewardAnalytics: (params: Record<string, string | number | undefined> = {}) => {
    const qs = buildQS(params)
    return request<RewardAnalytics>(`/analytics/rewards${qs ? `?${qs}` : ''}`)
  },

  /** Fetch a file blob with auth and trigger browser download */
  _download: async (path: string, filename: string) => {
    const token = getAccessToken()
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  downloadCSV: (params: ExportParams) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    const filename = `export_${Date.now()}.csv`
    return analyticsApi._download(`/export/csv${qs ? `?${qs}` : ''}`, filename)
  },

  downloadExcel: (params: ExportParams) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    const filename = `export_${Date.now()}.xlsx`
    return analyticsApi._download(`/export/excel${qs ? `?${qs}` : ''}`, filename)
  },
}

// ─── Questions API ─────────────────────────────────────────────────────────

export const questionApi = {
  getQuestions: (params = {} as Record<string, string | number | undefined>) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<PaginatedResponse<Question>>(
      `/questions${qs ? `?${qs}` : ''}`,
    )
  },

  getQuestion: (id: string) =>
    request<Question>(`/questions/${id}`),

  approveQuestion: (id: string) =>
    request<{ message: string }>(`/questions/${id}/approve`, { method: 'POST' }, false)
      .finally(() => invalidateCache('/api/questions')),

  rejectQuestion: (id: string, reason?: string) =>
    request<{ message: string }>(`/questions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, false).finally(() => invalidateCache('/api/questions')),

  /**
   * Public-user submit. The backend derives `state`/`district`/etc. from the
   * authenticated user's profile, but on the web we send them explicitly so
   * the wizard does not have to call `/auth/me` first.
   */
  submitQuestion: (body: {
    questionText: string
    domains: string[]
    season: string
    cropType: string
    state: string
    district: string
    block?: string
    agroClimaticZone?: string
    mediaType?: 'none' | 'image' | 'video' | 'audio'
    mediaUrls?: string[]
  }) =>
    request<{
      id: string
      status: string
      message: string
      duplicate?: {
        isDuplicate: boolean
        matchedQuestion: string | null
        matchedAnswer: string | null
        similarityScore: number | null
        matchedUserName: string | null
      }
    }>('/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    }, false).finally(() => invalidateCache('/api/questions')),

  /** Daily / total submission stats for the current (public) user. */
  getMyStats: () =>
    request<{
      dailyCount: number
      remainingToday: number
      totalApproved: number
      dailyLimit: number
      [k: string]: unknown
    }>('/questions/stats/me', {}, false),

  /**
   * List the current (public) user's own questions.
   *
   * NOTE: we deliberately do NOT pass a `userId` query param here. The backend
   * already scopes `GET /questions` to `req.user.id` (taken from the JWT) for
   * non-admin callers, and the `ListQuestionsDto` has no `userId` field. With
   * the global ValidationPipe's `forbidNonWhitelisted: true`, sending
   * `userId=me` here would cause a 400 ("property userId should not exist").
   */
  listMyQuestions: (params: { page?: number; limit?: number; status?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>,
    ).toString()
    return request<PaginatedResponse<Question>>(
      `/questions${qs ? `?${qs}` : ''}`,
      {},
      false,
    )
  },
}

// ─── Wallet API (public-user dashboard) ────────────────────────────────────

export const walletApi = {
  /** Wallet balance for the authenticated user. */
  getBalance: () =>
    request<{ balance: number; pending: number; totalEarned: number; currency: string }>(
      '/wallets/me',
      {},
      false,
    ),

  /** Current reward tier (1/5/10 rupees per approved question). */
  getRewardTier: (approvedCount?: number) => {
    const qs = approvedCount != null ? `?approvedCount=${approvedCount}` : ''
    return request<{ tier: number; reward: number; nextTierAt: number | null }>(
      `/wallets/me/tier${qs}`,
      {},
      false,
    )
  },

  /** Recent wallet transactions for the authenticated user. */
  getTransactions: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>,
    ).toString()
    return request<{ items: Transaction[]; total: number }>(
      `/wallets/me/transactions${qs ? `?${qs}` : ''}`,
      {},
      false,
    )
  },

  /** Wallet configuration (min withdrawal amount, razorpay key id, …). */
  getWalletConfig: () =>
    request<{ minWithdrawalAmount: number; razorpayKeyId: string }>(
      '/wallets/me/config',
      {},
      false,
    ),

  /** Payout methods (UPI / bank) saved by the authenticated user. */
  getPaymentDetails: () =>
    request<unknown[]>('/wallets/payment-details', {}, false),

  /** Add a new payout method (UPI or bank). Initiates ₹1 micro-transaction
   *  verification on the backend; the native Razorpay SDK is required to
   *  complete verification, which is not available in the web app. */
  addPaymentDetail: (data: {
    payoutMethod: 'upi' | 'bank_transfer'
    upiId?: string
    accountNumber?: string
    confirmAccountNumber?: string
    ifsc?: string
    accountHolderName?: string
    bankName?: string
  }) =>
    request<{ id: string; status: 'pending' | 'in_progress' | 'verified' | 'failed'; message: string }>(
      '/wallets/payment-details',
      { method: 'POST', body: JSON.stringify(data) },
      false,
    ),

  /** Delete a saved payout method (only allowed for non-verified details). */
  deletePaymentDetail: (id: string) =>
    request<{ success: true }>(`/wallets/payment-details/${id}`, { method: 'DELETE' }, false),
}

// ─── Notifications API ─────────────────────────────────────────────────────

export const notificationApi = {
  getNotifications: (params: { page?: number; limit?: number } = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<{ items: Notification[]; unreadCount: number; total: number; page: number; pages: number }>(
      `/users/me/notifications${qs ? `?${qs}` : ''}`,
    )
  },

  markRead: (id: string) =>
    request<void>(`/users/me/notifications/${id}/read`, { method: 'PATCH' }, false)
      .finally(() => invalidateCache('/api/users/me/notifications')),

  markAllRead: () =>
    request<void>(`/users/me/notifications/read-all`, { method: 'PATCH' }, false)
      .finally(() => invalidateCache('/api/users/me/notifications')),
}

// ─── Curator API ───────────────────────────────────────────────────────────

export const curatorApi = {
  getCuratorStats: () =>
    request<import('@/types').CuratorStats>('/curator/stats'),

  getMyStats: (userId: string) =>
    request<import('@/types').CuratorReviewerStats>(`/curator/my-stats?userId=${encodeURIComponent(userId)}`),

  getReviewQueue: (params = {} as Record<string, string | string[] | number | undefined>) => {
    // Backend expects status as an array: ?status[]=pending&status[]=held
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue
      const key = k
      if (Array.isArray(v)) {
        v.forEach((val) => { if (val !== undefined) sp.append(key, val) })
      } else {
        sp.set(key, String(v))
      }
    }
    const qs = sp.toString()
    return request<PaginatedResponse<Question>>(
      `/admin/questions/queue${qs ? `?${qs}` : ''}`,
    )
  },

  getQuestion: (id: string) =>
    request<Question>(`/admin/questions/${id}`),

  checkDuplicate: (id: string) =>
    request<{
      isDuplicate: boolean
      matchedQuestion?: string
      matchedAnswer?: string | null
      similarityScore?: number | null
      matchedUserName?: string | null
    }>(`/admin/questions/${id}/check-duplicate`, { method: 'POST' }),

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

// ─── Audit API (Task 19) ────────────────────────────────────────────────────────

function buildAuditQS(p: Record<string, string | number | undefined | string[]>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue
    if (Array.isArray(v)) {
      v.forEach((val) => sp.append(k, val))
    } else {
      sp.set(k, String(v))
    }
  }
  return sp.toString()
}

export const auditApi = {
  getAuditLogs: (params: Record<string, string | number | undefined | string[]> = {}) => {
    const qs = buildAuditQS(params as Record<string, string | number | undefined | string[]>)
    return request<AuditLogsResponse>(`/admin/audit-logs${qs ? `?${qs}` : ''}`, {}, false)
  },

  getAuditStats: (params: { fromDate?: string; toDate?: string; actorType?: string; role?: string } = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<AuditStatsResponse>(`/admin/audit-logs/stats${qs ? `?${qs}` : ''}`, {}, false)
  },

  getAuditSummary: (params: { fromDate?: string; toDate?: string; granularity?: string; role?: string } = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<AuditSummaryResponse>(`/admin/audit-logs/summary${qs ? `?${qs}` : ''}`, {}, false)
  },

  /** List users belonging to a given role (for the filter dropdown) */
  getAuditUsersByRole: (role: string) =>
    request<AuditUsersByRoleResponse>(`/admin/audit-logs/users-by-role?role=${encodeURIComponent(role)}`, {}, false),

  getEntityHistory: (entityType: string, entityId: string) =>
    request<AuditEntityHistoryResponse>(
      `/admin/audit-logs/entity/${entityType}/${entityId}`,
      {}, false,
    ),

  exportCSV: (params: Record<string, string | number | undefined | string[]> = {}) => {
    const qs = buildAuditQS(params as Record<string, string | number | undefined | string[]>)
    const filename = `audit_logs_${Date.now()}.csv`
    const token = getAccessToken()
    return fetch(`${BASE}/admin/audit-logs?${qs}&format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  },
}

// ─── Reports API ────────────────────────────────────────────────────────────────

export const reportsApi = {
  /** Submit a new report (any authenticated user) */
  create: (body: {
    title: string
    description: string
    category: string
    relatedEntityId?: string
    relatedEntityType?: string
  }) =>
    request<{ id: string; message: string }>('/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }, false),

  /** List all reports (admin/curator/finance) — with optional filters */
  list: (params: {
    status?: string
    category?: string
    priority?: string
    page?: number
    limit?: number
  } = {}) => {
    const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>
    const qs = new URLSearchParams(p).toString()
    return request<{
      items: Report[]
      total: number
      page: number
      limit: number
      pages: number
    }>(`/reports${qs ? `?${qs}` : ''}`, {}, false)
  },

  /** Get a single report with replies */
  get: (reportId: string) =>
    request<Report>(`/reports/${reportId}`, {}, false),

  /** Update report status */
  updateStatus: (reportId: string, status: string) =>
    request<{ id: string; status: string; message: string }>(
      `/reports/${reportId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      false,
    ),

  /** Update report priority */
  updatePriority: (reportId: string, priority: string) =>
    request<{ id: string; priority: string; message: string }>(
      `/reports/${reportId}/priority`,
      { method: 'PATCH', body: JSON.stringify({ priority }) },
      false,
    ),

  /** Add a reply to a report */
  addReply: (reportId: string, message: string) =>
    request<{ id: string; message: string }>(
      `/reports/${reportId}/replies`,
      { method: 'POST', body: JSON.stringify({ message }) },
      false,
    ),
}

// ─── FAQ API ──────────────────────────────────────────────────────────────────

export const faqApi = {
  /** User-facing: visible FAQs only, optionally filtered */
  getVisible: (filters?: { category?: string }) => {
    const params: Record<string, string> = {}
    if (filters?.category) params.category = filters.category
    return request<Faq[]>('/faqs', { params }, false)
  },

  /** Admin: paginated FAQ list */
  getAll: (filters?: {
    category?: string
    search?: string
    page?: number
    limit?: number
    sortBy?: 'displayOrder' | 'createdAt' | 'updatedAt' | 'question'
    sortOrder?: 'ASC' | 'DESC'
  }) => {
    const p: Record<string, string> = {};
    if (filters?.category)  p.category   = filters.category;
    if (filters?.search)    p.search     = filters.search;
    if (filters?.page)      p.page       = String(filters.page);
    if (filters?.limit)     p.limit      = String(filters.limit);
    if (filters?.sortBy)    p.sortBy     = filters.sortBy;
    if (filters?.sortOrder) p.sortOrder  = filters.sortOrder;
    const qs = new URLSearchParams(p).toString();
    return request<PaginatedResponse<Faq>>(`/admin/faqs${qs ? `?${qs}` : ''}`, {}, false);
  },

  /** Admin: FAQ stats */
  getStats: (category?: string) => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    const qs = new URLSearchParams(params).toString();
    return request<{ total: number; visible: number; hidden: number }>(
      `/admin/faqs/stats${qs ? `?${qs}` : ''}`,
      {},
      false,
    );
  },

  create: (body: { question: string; answer: string; category?: string; isVisible?: boolean }) =>
    request<Faq>('/admin/faqs', {
      method: 'POST',
      body: JSON.stringify(body),
    }, false),

  update: (id: string, body: { question?: string; answer?: string; category?: string; isVisible?: boolean }) =>
    request<Faq>(`/admin/faqs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, false),

  toggleVisibility: (id: string, isVisible: boolean) =>
    request<Faq>(`/admin/faqs/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ isVisible }),
    }, false),

  remove: (id: string) =>
    request<void>(`/admin/faqs/${id}`, { method: 'DELETE' }, false),
}

// ─── Distributor ──────────────────────────────────────────────────────────

export interface ListApprovedQuestionsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AssignStatesPayload {
  states: string[];
  notes?: string;
}

export interface ListDistributionsParams {
  page?: number;
  limit?: number;
  /** Filter by the TARGET Indian state (was `state`, renamed to disambiguate
   * from the asker's home state that is now embedded on each row). */
  distributionState?: string;
  search?: string;
}

export const distributor = {
  /** Reference data: list of all 32 Indian states / UTs. */
  listIndianStates: () =>
    request<{ states: string[] }>(`/distributor/indian-states`, {}, false),

  /** Dashboard stats: how many final-questions exist per state. */
  getStats: () =>
    request<DistributorStats>(`/distributor/stats`, {}, false),

  /** Approved-questions queue. */
  listApprovedQuestions: (params: ListApprovedQuestionsParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{
      items: Question[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>(`/distributor/questions${qs ? `?${qs}` : ''}`, {}, false);
  },

  getApprovedQuestion: (id: string) =>
    request<Question>(`/distributor/questions/${id}`, {}, false),

  /** Assign 0..N Indian states to an approved question. Pass `states: []` to move a non-state-specific question to `moved_to_final` without distributing to any state. */
  assignStates: (questionId: string, payload: AssignStatesPayload) =>
    request<{
      questionId: string;
      insertedStates: string[];
      skippedStates: string[];
      insertedCount: number;
      totalStates: number;
      questionStatus: string;
    }>(`/distributor/questions/${questionId}/assign-states`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false),

  /** Browse the final_questions (distributions). */
  listDistributions: (params: ListDistributionsParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return request<{
      items: FinalQuestion[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>(`/distributor/distributions${qs ? `?${qs}` : ''}`, {}, false);
  },

  getDistributionsForQuestion: (questionId: string) =>
    request<{
      questionId: string;
      states: string[];
      entries: FinalQuestion[];
    }>(`/distributor/distributions/by-question/${questionId}`, {}, false),
}

// ─── Error helper ──────────────────────────────────────────────────────────

export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'data' in e) {
    return ((e as { data: { message?: string } }).data?.message) ?? fallback
  }
  return fallback
}
