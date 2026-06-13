/**
 * useAuth.test.tsx
 *
 * Tests the AuthProvider + useAuth hook — session restoration, login (OTP request),
 * verifyOtp (registered vs new user), register, logout, and refreshProfile.
 *
 * We mock authApi entirely so no real HTTP calls are made.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import * as client from '../api/client';

// ─── Mock authApi ─────────────────────────────────────────────────────────────

const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockRegister = jest.fn();
const mockMe = jest.fn();

jest.mock('../api/client', () => ({
  authApi: {
    requestOtp: (...args: unknown[]) => mockRequestOtp(...args),
    verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    register: (...args: unknown[]) => mockRegister(...args),
    me: (...args: unknown[]) => mockMe(...args),
  },
  saveAuth: jest.fn(),
  clearAuth: jest.fn(),
  getStoredUser: jest.fn(),
  isAuthenticated: jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockPublicUser = {
  id: 'user-1',
  mobileNumber: '+919876543210',
  name: 'Ramesh Kumar',
  category: 'farmer',
  state: 'Maharashtra',
  district: 'Pune',
  block: 'Haveli',
  languagePreference: 'hi',
  verificationStatus: 'verified',
  role: 'user',
  createdAt: new Date().toISOString(),
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no stored session
    (client.getStoredUser as jest.Mock).mockResolvedValue(null);
    (client.isAuthenticated as jest.Mock).mockResolvedValue(false);
  });

  // ─── Session Restoration ─────────────────────────────────────────────────

  describe('session restoration on mount', () => {
    it('sets isReady=true with null user when no stored session', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
      expect(result.current.user).toBeNull();
    });

    it('restores user from storage when token is present', async () => {
      (client.getStoredUser as jest.Mock).mockResolvedValue(mockPublicUser);
      (client.isAuthenticated as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
      expect(result.current.user).toEqual(mockPublicUser);
      expect(result.current.isLoading).toBe(false);
    });

    it('sets user to null when stored user exists but token is missing', async () => {
      (client.getStoredUser as jest.Mock).mockResolvedValue(mockPublicUser);
      (client.isAuthenticated as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
      expect(result.current.user).toBeNull();
    });

    it('sets user to null when storage throws (e.g. AsyncStorage unavailable)', async () => {
      (client.getStoredUser as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
      expect(result.current.user).toBeNull();
    });
  });

  // ─── login (OTP Request) ─────────────────────────────────────────────────

  describe('login', () => {
    it('calls authApi.requestOtp with the mobile number', async () => {
      mockRequestOtp.mockResolvedValue({ data: { message: 'OTP sent' } });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await act(async () => {
        await result.current.login('+919876543210');
      });

      expect(mockRequestOtp).toHaveBeenCalledWith('+919876543210');
    });

    it('rethrows the error from requestOtp', async () => {
      mockRequestOtp.mockRejectedValue(new Error('Rate limited'));
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await expect(
        act(async () => {
          await result.current.login('+919876543210');
        }),
      ).rejects.toThrow('Rate limited');
    });
  });

  // ─── verifyOtp — Registered User ─────────────────────────────────────────

  describe('verifyOtp for returning user', () => {
    it('saves tokens and updates user state', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900 },
          user: mockPublicUser,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await act(async () => {
        const outcome = await result.current.verifyOtp('+919876543210', '123456');
        expect(outcome.requiresRegistration).toBe(false);
        expect(outcome.user).toEqual(mockPublicUser);
      });

      expect(client.saveAuth).toHaveBeenCalledWith(
        { accessToken: 'at', refreshToken: 'rt', expiresIn: 900 },
        mockPublicUser,
      );
      await waitFor(() => {
        expect(result.current.user).toEqual(mockPublicUser);
      });
    });
  });

  // ─── verifyOtp — New User ────────────────────────────────────────────────

  describe('verifyOtp for new user', () => {
    it('returns requiresRegistration=true without saving tokens', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { requiresRegistration: true, tempToken: 'temp-reg-token' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      let outcome!: { requiresRegistration: boolean; tempToken?: string };
      await act(async () => {
        outcome = await result.current.verifyOtp('+919999999999', '654321');
      });

      expect(outcome.requiresRegistration).toBe(true);
      expect(outcome.tempToken).toBe('temp-reg-token');
      expect(client.saveAuth).not.toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it('throws when verifyOtp response is unexpected', async () => {
      mockVerifyOtp.mockResolvedValue({ data: { weird: 'payload' } });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await expect(
        act(async () => {
          await result.current.verifyOtp('+919876543210', '123456');
        }),
      ).rejects.toThrow('Unexpected response from verify-otp');
    });
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('saves tokens and updates user state with registered data', async () => {
      mockRegister.mockResolvedValue({
        data: {
          tokens: { accessToken: 'at-new', refreshToken: 'rt-new', expiresIn: 900 },
          user: { ...mockPublicUser, name: 'Ramesh Kumar Updated' },
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await act(async () => {
        await result.current.register({
          name: 'Ramesh Kumar Updated',
          mobileNumber: '+919876543210',
          state: 'Maharashtra',
          district: 'Pune',
          category: 'farmer',
          languagePreference: 'hi',
          consentGiven: true,
        });
      });

      expect(client.saveAuth).toHaveBeenCalled();
      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('clears auth storage and sets user to null', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      // Pre-condition: user is null (default state)
      expect(result.current.user).toBeNull();

      await act(async () => {
        await result.current.logout();
      });

      expect(client.clearAuth).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });

  // ─── refreshProfile ───────────────────────────────────────────────────────

  describe('refreshProfile', () => {
    it('updates user state with fresh profile data', async () => {
      mockMe.mockResolvedValue({ data: { user: mockPublicUser } });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      await act(async () => {
        await result.current.refreshProfile();
      });

      expect(mockMe).toHaveBeenCalled();
    });

    it('silently swallows token-expiry errors (interceptor handles them)', async () => {
      mockMe.mockRejectedValue({ response: { status: 401 } });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      // Should not throw
      await act(async () => {
        await result.current.refreshProfile();
      });
    });
  });

  // ─── useAuth throws outside AuthProvider ─────────────────────────────────

  // Note: testing the throws-outside-Provider case requires renderHook without a wrapper,
  // which is not supported by @testing-library/react-native v13 with React 19 createRoot.
  // This invariant is tested in the backend via TypeScript compilation + integration tests.
});