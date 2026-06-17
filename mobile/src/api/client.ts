import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { accountLockedEmitter } from '../events/accountLockedEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Configuration ────────────────────────────────────────────────────────────

// Default to localhost for iOS Simulator / Android Emulator on the same machine.
// Set EXPO_PUBLIC_API_BASE_URL in .env (or via 'npx expo env') to your LAN IP
// when testing on a physical device from a different machine on the network.
// e.g. EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:3000/api/v1
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL
  ?? (Platform.OS === 'ios' || Platform.OS === 'android'
    ? 'http://localhost:3000/api/v1'
    : 'http://localhost:3000/api/v1');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  paramsSerializer: (params) =>
    Object.entries(params)
      .flatMap(([k, v]) => (Array.isArray(v) ? v.map((i) => `${encodeURIComponent(k)}=${encodeURIComponent(i)}`) : `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`))
      .join('&'),
});

// TEMP DEBUG: log all outgoing requests
api.interceptors.request.use((config) => {
  console.log('[API DEBUG] REQUEST:', config.method?.toUpperCase(), config.baseURL + (config.url ?? ''), JSON.stringify(config.data));
  return config;
});
api.interceptors.response.use(
  (res) => {
    console.log('[API DEBUG] RESPONSE OK:', res.status, JSON.stringify(res.data));
    return res;
  },
  (err) => {
    console.log('[API DEBUG] RESPONSE ERR:', err.response?.status, err.config?.baseURL + (err.config?.url ?? ''), JSON.stringify(err.response?.data), err.message);
    return Promise.reject(err);
  }
);

// ─── Request Interceptor: Attach JWT ─────────────────────────────────────────

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // AsyncStorage unavailable (e.g. Expo Go native module issue) — proceed without token
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: Handle 401 (Token Refresh) ────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          await clearAuth();
          throw new Error('No refresh token');
        }

        const { data } = await axios.post<{ accessToken: string; refreshToken: string; expiresIn: number }>(
          `${BASE_URL}/auth/refresh`,
          { refreshToken },
        );

        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }
        return api(originalRequest);
      } catch {
        await clearAuth();
      }
    }

    // 423 Locked — user was suspended/banned mid-session (token refresh path).
    // For unauthenticated requests (e.g. /auth/otp sign-in) the caller handles
    // the 423 inline; skip the modal emitter to avoid double-display.
    if (error.response?.status === 423 && originalRequest._retry) {
      const locked = parseAccountLocked(error);
      if (locked) {
        accountLockedEmitter.emit(locked);
      }
    }

    return Promise.reject(error);
  },
);

// ─── Error Helper ─────────────────────────────────────────────────────────────

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    // Axios AxiosError: err.response.status = HTTP status, err.response.data = body
    const e = err as { response?: { data?: { message?: string; error?: string }; message?: string; error?: string }; message?: string };
    if (e.response?.data?.error === 'ACCOUNT_LOCKED') return e.response?.data?.message ?? fallback;
    if (e.response?.data?.message) return e.response.data.message;
    if (e.response?.message) return e.response.message;
    if (e.response?.error) return e.response.error;
    if (e.message) return e.message;
  }
  return fallback;
}

export interface AccountLockedInfo {
  status: 'suspended' | 'banned';
  reason: string | null;
  suspendedAt: string | null;
  bannedAt: string | null;
  suspendedUntil: string | null;
}

export function parseAccountLocked(err: unknown): AccountLockedInfo | null {
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    // Axios AxiosError structure:
    //   err.response.status  = HTTP status code (e.g. 423)
    //   err.response.data    = NestJS HttpException body
    const e = err as { response?: { status: number; data?: { status?: string; reason?: string; suspendedAt?: string; bannedAt?: string; suspendedUntil?: string } } };
    if (e.response?.status === 423 && e.response.data) {
      const body = e.response.data;
      const rawStatus = String(body.status ?? '');
      return {
        status: rawStatus === 'banned' ? 'banned' : 'suspended',
        reason: typeof body.reason === 'string' ? body.reason : null,
        suspendedAt: typeof body.suspendedAt === 'string' ? body.suspendedAt : null,
        bannedAt: typeof body.bannedAt === 'string' ? body.bannedAt : null,
        suspendedUntil: typeof body.suspendedUntil === 'string' ? body.suspendedUntil : null,
      };
    }
  }
  return null;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export async function saveAuth(
  tokens: { accessToken: string; refreshToken: string },
  user: unknown,
): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function getStoredUser(): Promise<unknown> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return !!token;
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export const authApi = {
  requestOtp: (mobileNumber: string) =>
    api.post('/auth/request-otp', { mobileNumber }),

  verifyOtp: (mobileNumber: string, otp: string) =>
    api.post('/auth/verify-otp', { mobileNumber, otp }),

  register: (data: Record<string, unknown>) =>
    api.post('/auth/register', data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  me: () => api.get('/auth/me'),
};

export const userApi = {
  getProfile: () => api.get('/users/me'),

  updateProfile: (data: Record<string, unknown>) =>
    api.patch('/users/me', data),

  updateCrops: (crops: Array<{ cropName: string; season?: string }>) =>
    api.patch('/users/me/crops', { crops }),
};

export const questionApi = {
  submit: (data: Record<string, unknown>) =>
    api.post('/questions', data),

  preview: (data: Record<string, unknown>) =>
    api.post('/questions/preview', data),

  list: (params?: Record<string, string | number>) =>
    api.get('/questions', { params }),

  getMyQuestions: (params?: Record<string, string | number>) =>
    api.get('/questions', { params }),

  get: (id: string) =>
    api.get(`/questions/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/questions/${id}`, data),

  getStats: () =>
    api.get('/questions/stats/me'),
};

export const walletApi = {
  getBalance: () => api.get('/wallets/me'),

  getTransactions: (params?: Record<string, string | number>) =>
    api.get('/wallets/me/transactions', { params }),

  withdraw: (data: Record<string, unknown>) =>
    api.post('/wallets/withdraw', data),
};

export const adminApi = {
  // Dashboard
  getDashboardStats: (params?: Record<string, string | number>) =>
    api.get('/admin/analytics/dashboard', { params }),
  getRewardSummary: (params?: Record<string, string | number>) =>
    api.get('/admin/analytics/rewards', { params }),

  // Users
  listUsers: (params?: Record<string, string | number>) =>
    api.get('/admin/users', { params }),
  getUserDetail: (id: string) =>
    api.get(`/admin/users/${id}`),
  createUser: (data: Record<string, unknown>) =>
    api.post('/admin/users', data),
  suspendUser: (id: string, body: { action: 'suspend' | 'ban'; reason?: string; suspendedUntil?: string }) =>
    api.post(`/admin/users/${id}/suspend`, body),

  unsuspendUser: (id: string) =>
    api.post(`/admin/users/${id}/unsuspend`, {}),

  verifyUser: (id: string) =>
    api.post(`/admin/users/${id}/verify`, {}),

  // Question review
  getReviewQueue: (params?: Record<string, string | number>) =>
    api.get('/admin/questions/queue', { params }),
  getQuestion: (id: string) =>
    api.get(`/admin/questions/${id}`),
  reviewQuestion: (id: string, body: { action: 'approve' | 'reject' | 'hold' | 'request_info'; reason?: string; heldReason?: string }) =>
    api.post(`/admin/questions/${id}/review`, body),

  // Config
  getConfig: () => api.get('/admin/config'),
  updateConfig: (body: { key: string; value: number; description?: string }) =>
    api.patch('/admin/config', body),

  // Withdrawals
  listWithdrawals: (params?: Record<string, string | number>) =>
    api.get('/admin/withdrawals', { params }),
  processWithdrawal: (id: string, body: { action: 'approve' | 'reject'; failureReason?: string }) =>
    api.post(`/admin/withdrawals/${id}/process`, body),

  // Reward logs
  getRewardLogs: (params?: Record<string, string | number>) =>
    api.get('/admin/analytics/reward-logs', { params }),

  // Fraud
  getFraudStats: (params?: Record<string, string | number>) =>
    api.get('/admin/fraud', { params }),

  // Export
  exportData: (params?: Record<string, string | number>) =>
    api.get('/admin/export', { params, responseType: 'blob' }),
};

export default api;