import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PublicUser } from '../types';
import { authApi, saveAuth, clearAuth, getStoredUser, isAuthenticated } from '../api/client';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isReady: false,
  });

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
          } catch {
            // Use stored snapshot if server unreachable
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
    setState({ user: null, isLoading: false, isReady: true });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setState((prev) => ({ ...prev, user: data.user }));
    } catch {
      // Token likely expired — let the interceptor handle it
    }
  }, []);

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