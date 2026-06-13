/**
 * LoginPhoneScreen.test.tsx
 *
 * Tests LoginPhoneScreen — phone input validation, country-code display,
 * Send OTP button states, and error handling.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { LoginPhoneScreen } from '../screens/Auth/LoginPhoneScreen';
import { ThemeProvider } from '../hooks/useTheme';
import { Button } from '../components/Button';

// ─── Mock useAuth ─────────────────────────────────────────────────────────────

const mockLogin = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    isReady: true,
  }),
}));

// ─── Test wrapper ─────────────────────────────────────────────────────────────

const renderScreen = () =>
  render(
    <ThemeProvider>
      <LoginPhoneScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() } as never}
      />
    </ThemeProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginPhoneScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Country code ─────────────────────────────────────────────────────────

  describe('country code display', () => {
    it('shows India (+91) country code badge', () => {
      const { getByText } = renderScreen();
      expect(getByText('+91')).toBeTruthy();
    });
  });

  // ─── Input validation ─────────────────────────────────────────────────────

  describe('input validation', () => {
    it('shows error for fewer than 10 digits', async () => {
      const { getByPlaceholderText, queryByText } = renderScreen();
      const input = getByPlaceholderText('Enter 10-digit mobile number');
      await act(async () => {
        fireEvent.changeText(input, '98765');
      });
      // The onChangeText handler sets error reactively for non-empty non-valid input
      await waitFor(() => {
        expect(queryByText('Enter a valid 10-digit mobile number')).toBeTruthy();
      });
    });

    it('shows no error when input is 10 valid digits', async () => {
      const { getByPlaceholderText, queryByText } = renderScreen();
      const input = getByPlaceholderText('Enter 10-digit mobile number');
      await act(async () => {
        fireEvent.changeText(input, '9876543210');
      });
      await waitFor(() => {
        expect(queryByText('Enter a valid 10-digit mobile number')).toBeNull();
      });
    });

    it('removes non-numeric characters', async () => {
      const { getByPlaceholderText } = renderScreen();
      const input = getByPlaceholderText('Enter 10-digit mobile number');
      await act(async () => {
        fireEvent.changeText(input, '987abc!!3210');
      });
      expect(input.props.value).toBe('9873210');
    });

    it('removes error when user corrects to 10 digits', async () => {
      const { getByPlaceholderText, queryByText } = renderScreen();
      const input = getByPlaceholderText('Enter 10-digit mobile number');
      await act(async () => {
        fireEvent.changeText(input, '98765');
      });
      await waitFor(() => {
        expect(queryByText('Enter a valid 10-digit mobile number')).toBeTruthy();
      });
      await act(async () => {
        fireEvent.changeText(input, '9876543210');
      });
      await waitFor(() => {
        expect(queryByText('Enter a valid 10-digit mobile number')).toBeNull();
      });
    });
  });

  // ─── Send OTP button ───────────────────────────────────────────────────────

  describe('Send OTP button', () => {
    it('is disabled when mobile is empty', () => {
      const { UNSAFE_root } = renderScreen();
      const [button] = UNSAFE_root.findAllByType(Button);
      expect(button.props.disabled).toBe(true);
    });

    it('is disabled when mobile has fewer than 10 digits', async () => {
      const { getByPlaceholderText, UNSAFE_root } = renderScreen();
      const input = getByPlaceholderText('Enter 10-digit mobile number');
      await act(async () => {
        fireEvent.changeText(input, '98765');
      });
      const [button] = UNSAFE_root.findAllByType(Button);
      expect(button.props.disabled).toBe(true);
    });

    it('is NOT disabled when mobile has exactly 10 valid digits', async () => {
      const { getByPlaceholderText, UNSAFE_root } = renderScreen();
      const input = getByPlaceholderText('Enter 10-digit mobile number');
      await act(async () => {
        fireEvent.changeText(input, '9876543210');
      });
      const [button] = UNSAFE_root.findAllByType(Button);
      expect(button.props.disabled).toBeFalsy();
    });

    it('calls login with E.164 number when pressed with valid mobile', async () => {
      mockLogin.mockResolvedValue(undefined);
      const { getByPlaceholderText, getByText } = renderScreen();
      fireEvent.changeText(getByPlaceholderText('Enter 10-digit mobile number'), '9876543210');
      await act(async () => {
        fireEvent.press(getByText('Send OTP'));
      });
      expect(mockLogin).toHaveBeenCalledWith('+919876543210');
    });

    it('navigates to Otp screen on successful OTP request', async () => {
      mockLogin.mockResolvedValue(undefined);
      const mockNavigate = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ThemeProvider>
          <LoginPhoneScreen navigation={{ navigate: mockNavigate } as never} />
        </ThemeProvider>,
      );
      fireEvent.changeText(getByPlaceholderText('Enter 10-digit mobile number'), '9876543210');
      await act(async () => {
        fireEvent.press(getByText('Send OTP'));
      });
      expect(mockNavigate).toHaveBeenCalledWith('Otp', { mobileNumber: '+919876543210' });
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows Alert with server error message on login failure', async () => {
      mockLogin.mockRejectedValue({ response: { data: { message: 'Too many OTP requests' } } });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByPlaceholderText, getByText } = renderScreen();
      fireEvent.changeText(getByPlaceholderText('Enter 10-digit mobile number'), '9876543210');
      await act(async () => {
        fireEvent.press(getByText('Send OTP'));
      });
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error', 'Too many OTP requests');
      });
      alertSpy.mockRestore();
    });

    it('shows generic message when server error has no message field', async () => {
      mockLogin.mockRejectedValue(new Error('Network failure'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByPlaceholderText, getByText } = renderScreen();
      fireEvent.changeText(getByPlaceholderText('Enter 10-digit mobile number'), '9876543210');
      await act(async () => {
        fireEvent.press(getByText('Send OTP'));
      });
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error', 'Unable to send OTP. Please try again.');
      });
      alertSpy.mockRestore();
    });
  });
});