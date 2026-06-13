import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Configuration ────────────────────────────────────────────────────────────

// iOS Simulator / Android Emulator → use localhost (same machine as backend)
// Physical device → use LAN IP of the machine running the backend
const BASE_URL =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? 'http://localhost:3000/api/v1'
    : 'http://localhost:3000/api/v1';
// TODO(abiram): Replace with your LAN IP (e.g. http://192.168.1.5:3000/api/v1)
// when testing on a physical device from a different machine on the network.

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
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

    return Promise.reject(error);
  },
);

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

export default api;