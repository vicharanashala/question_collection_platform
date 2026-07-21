import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { PublicUser } from '../types';
import { authApi, saveAuth, clearAuth, getStoredUser, isAuthenticated } from '../api/client';
import { accountLockedEmitter } from '../events/accountLockedEvents';
import { useAccountLocked } from '../context/AccountLockedContext';

interface AuthState {
  user: PublicUser | null;
  isLoading: boolean;
  isReady: boolean;
}

interface AuthContextValue extends AuthState {
  login: (mobileNumber: string) => Promise<void>;
  verifyOtp: (mobileNumber: string, otp: string) => Promise<{ requiresRegistration: boolean; user?: PublicUser; tempToken?: string }>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isReady: false,
  });
  const { clearLocked } = useAccountLocked();

  // Restore session on app start and sync with server
  useEffect(() => {
    (async () => {
      try {
        const [stored, hasToken] = await Promise.all([
          getStoredUser(),
          isAuthenticated(),
        ]);
        if (stored && hasToken) {
          // Show stored user immediately to avoid flicker
          setState({ user: stored as PublicUser, isLoading: false, isReady: true });
          // Then refresh from server to get latest verificationStatus and flat profile fields.
          try {
            const { data } = await authApi.me();
            setState((prev) => ({ ...prev, user: data.user }));
          } catch (e: any) {
            if (e?.response?.status === 423) {
              // Banned mid-session — auto-logout and clear lock state
              accountLockedEmitter.emit(e.response.data);
              await clearAuth();
              clearLocked();
              setState({ user: null, isLoading: false, isReady: true });
            }
            // Use stored snapshot for other errors (network unreachable, etc.)
          }
        } else {
          setState({ user: null, isLoading: false, isReady: true });
        }
      } catch {
        setState({ user: null, isLoading: false, isReady: true });
      }
    })();
  }, []);

  const login = useCallback(async (mobileNumber: string) => {
    // Nothing to persist here — OTP is server-side
    await authApi.requestOtp(mobileNumber);
  }, []);

  const verifyOtp = useCallback(async (mobileNumber: string, otp: string) => {
    const { data } = await authApi.verifyOtp(mobileNumber, otp);

    if ('requiresRegistration' in data && data.requiresRegistration) {
      // New user — registration token is in data.tempToken
      return { requiresRegistration: true, tempToken: (data as { tempToken?: string }).tempToken };
    }

    if ('tokens' in data && 'user' in data) {
      const userData = data.user as PublicUser;
      await saveAuth(data.tokens, userData);
      setState({ user: userData, isLoading: false, isReady: true });
      return { requiresRegistration: false, user: userData };
    }

    throw new Error('Unexpected response from verify-otp');
  }, []);

  const register = useCallback(async (formData: Record<string, unknown>) => {
    const { data } = await authApi.register(formData);
    if ('tokens' in data && 'user' in data) {
      await saveAuth(data.tokens, data.user);
      setState({ user: data.user, isLoading: false, isReady: true });
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    clearLocked();
    setState({ user: null, isLoading: false, isReady: true });
  }, [clearLocked]);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setState((prev) => ({ ...prev, user: data.user }));
    } catch {
      // Token likely expired — let the interceptor handle it
    }
  }, []);

  // Auto-logout when 423 fires from the API interceptor (mid-session ban)
  useEffect(() => {
    const unsubscribe = accountLockedEmitter.subscribe(() => {
      clearAuth();
      clearLocked();
      setState({ user: null, isLoading: false, isReady: true });
    });
    return unsubscribe;
  }, [clearLocked]);

  // Heartbeat: probe /auth/me every 30s to detect mid-session bans even during idle
  useEffect(() => {
    if (!state.isReady || !state.user) return;
    const interval = setInterval(async () => {
      try {
        await authApi.me();
      } catch (e: any) {
        if (e?.response?.status === 423) {
          accountLockedEmitter.emit(e.response.data);
          clearAuth();
          clearLocked();
          setState({ user: null, isLoading: false, isReady: true });
        }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [state.isReady, !!state.user]);

  // Probe on app resume from background — catches bans that happened while app was backgrounded
  useEffect(() => {
    if (!state.isReady || !state.user) return;
    function handleAppStateChange(next: AppStateStatus) {
      if (next === 'active') {
        authApi.me().catch((e: any) => {
          if (e?.response?.status === 423) {
            accountLockedEmitter.emit(e.response.data);
            clearAuth();
            clearLocked();
            setState({ user: null, isLoading: false, isReady: true });
          }
        });
      }
    }
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [state.isReady, !!state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, verifyOtp, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}