/**
 * OtpScreen.test.tsx
 *
 * Tests the OtpScreen — 6-digit OTP entry, countdown timer, resend flow,
 * verification success/error outcomes, and back navigation.
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { OtpScreen } from '../screens/Auth/OtpScreen';
import { ThemeProvider } from '../hooks/useTheme';

// ─── Mock useAuth ─────────────────────────────────────────────────────────────

const mockVerifyOtp = jest.fn();
const mockLogin = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    verifyOtp: mockVerifyOtp,
    login: mockLogin,
    user: null,
    isLoading: false,
  }),
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

const defaultNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
const defaultRoute = { params: { mobileNumber: '+919876543210' } };

const renderScreen = (nav = defaultNav, route = defaultRoute) =>
  render(
    <ThemeProvider>
      <OtpScreen
        navigation={nav as never}
        route={route as never}
      />
    </ThemeProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OtpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Initial State ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('shows countdown starting at 60 seconds', () => {
      const { getByText } = renderScreen();
      expect(getByText(/Code expires in 60s/)).toBeTruthy();
    });

    it('shows "Resend in 60s" while countdown is active', () => {
      const { getByText } = renderScreen();
      expect(getByText(/Resend in 60s/)).toBeTruthy();
    });
  });

  // ─── Countdown Timer ───────────────────────────────────────────────────────

  describe('countdown timer', () => {
    it('decrements display every second', async () => {
      const { getByText } = renderScreen();
      expect(getByText(/Code expires in 60s/)).toBeTruthy();

      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(getByText(/Code expires in 59s/)).toBeTruthy();

      await act(async () => { jest.advanceTimersByTime(3000); });
      expect(getByText(/Code expires in 56s/)).toBeTruthy();
    });

    it('shows expired message when countdown reaches zero', async () => {
      const { getByText, queryByText } = renderScreen();

      await act(async () => { jest.advanceTimersByTime(60_000); });

      expect(getByText('Code expired — request a new one')).toBeTruthy();
      expect(queryByText(/Resend in/)).toBeNull();
    });

    it('shows Resend OTP link after expiry', async () => {
      const { getByText } = renderScreen();

      await act(async () => { jest.advanceTimersByTime(60_000); });

      expect(getByText('Resend OTP')).toBeTruthy();
    });
  });

  // ─── Resend OTP ───────────────────────────────────────────────────────────

  describe('resend OTP', () => {
    it('calls login() when Resend OTP is tapped after expiry', async () => {
      mockLogin.mockResolvedValue(undefined);
      const { getByText } = renderScreen();

      await act(async () => { jest.advanceTimersByTime(60_000); });
      fireEvent.press(getByText('Resend OTP'));

      expect(mockLogin).toHaveBeenCalledWith('+919876543210');
    });

    it('resets countdown back to 60s after resend', async () => {
      mockLogin.mockResolvedValue(undefined);
      const { getByText } = renderScreen();

      await act(async () => { jest.advanceTimersByTime(60_000); });
      fireEvent.press(getByText('Resend OTP'));

      expect(getByText(/Resend in 60s/)).toBeTruthy();
    });

    it('does NOT show Resend OTP link while countdown is active', () => {
      const { queryByText } = renderScreen();
      expect(queryByText('Resend OTP')).toBeNull();
    });
  });

  // ─── Navigation on Success ────────────────────────────────────────────────

  describe('navigation on success', () => {
    it('replaces with Register screen when requiresRegistration=true', async () => {
      mockVerifyOtp.mockResolvedValue({
        requiresRegistration: true,
        tempToken: 'temp-token-xyz',
      });
      const mockReplace = jest.fn();
      const { UNSAFE_root } = renderScreen(
        { ...defaultNav, replace: mockReplace },
        defaultRoute,
      );

      // Capture all 6 OTP input refs BEFORE any changes to avoid stale live-collection issue
      const otpInputs = UNSAFE_root.findAllByType('TextInput').filter((t: any) => t.props.placeholder === '•');

      // Type each digit in its own act() so state updates fully before the next input
      for (let i = 0; i < 6; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          fireEvent.changeText(otpInputs[i], String(i + 1));
        });
      }

      // handleVerify resolves asynchronously; use waitFor with fake timers
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('Register', {
          mobileNumber: '+919876543210',
        });
      });
    });

    it('no explicit navigation for returning user (AuthProvider manages state)', async () => {
      mockVerifyOtp.mockResolvedValue({
        requiresRegistration: false,
        user: mockPublicUser,
      });
      const mockReplace = jest.fn();
      const mockNavigate = jest.fn();
      const { UNSAFE_root } = renderScreen(
        { ...defaultNav, replace: mockReplace, navigate: mockNavigate },
        defaultRoute,
      );

      // Capture all 6 OTP input refs BEFORE any changes
      const otpInputs = UNSAFE_root.findAllByType('TextInput').filter((t: any) => t.props.placeholder === '•');

      for (let i = 0; i < 6; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          fireEvent.changeText(otpInputs[i], String((i % 9) + 1));
        });
      }

      await waitFor(() => {
        expect(mockReplace).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });

  // ─── Error Display ────────────────────────────────────────────────────────

  describe('error display', () => {
    it('shows error message from verifyOtp rejection', async () => {
      mockVerifyOtp.mockRejectedValue({
        response: { data: { message: 'Invalid OTP' } },
      });
      const { UNSAFE_root } = renderScreen();

      // Capture all 6 OTP input refs BEFORE any changes to avoid stale live-collection issue
      const otpInputs = UNSAFE_root.findAllByType('TextInput').filter((t: any) => t.props.placeholder === '•');

      // Type each digit in its own act() so state updates fully before the next input.
      // This ensures each handleChange fires and the OtpInput state is fully committed
      // before the next changeText call.
      for (let i = 0; i < 6; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          fireEvent.changeText(otpInputs[i], String(i));
        });
      }

      // handleVerify is called by useEffect after otp.length === 6. It calls verifyOtp(),
      // which rejects. The rejection is a microtask. Flush it with a tick of real timers
      // then check the tree synchronously.
      jest.useRealTimers();
      await act(async () => {
        // Let the useEffect + handleVerify + verifyOtp rejection microtask all settle
      });
      jest.useFakeTimers();

      // Now the error text should be present
      // Use a substring that matches both the full string and comma-joined array representation
      const hasError = UNSAFE_root
        .findAllByType('Text')
        .some((t: any) => String(t.props.children).includes('Invalid OTP'));
      expect(hasError).toBe(true);
    });
  });

  // ─── Back Navigation ──────────────────────────────────────────────────────

  describe('back navigation', () => {
    it('calls goBack when back button is pressed', () => {
      const mockGoBack = jest.fn();
      const { getByText } = renderScreen(
        { ...defaultNav, goBack: mockGoBack },
        defaultRoute,
      );

      fireEvent.press(getByText('← Back'));
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});