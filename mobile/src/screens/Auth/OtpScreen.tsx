import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { OtpInput } from '../../components/Input';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Otp'>;
  route: RouteProp<AuthStackParamList, 'Otp'>;
};

export function OtpScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const colors = theme.colors;
  const { verifyOtp, login } = useAuth();
  const { showToast } = useToast();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyInFlight = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (otp.length === 6 && !loading) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleVerify() {
    if (verifyInFlight.current) return;
    if (otp.length < 6) { setError('Enter the complete 6-digit code'); return; }
    verifyInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await verifyOtp(mobileNumber, otp) as { requiresRegistration: boolean; user?: unknown };

      if (result.requiresRegistration) {
        navigation.replace('Terms', { mobileNumber });
      }
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      const msg = getErrorMessage(err, 'Enter a valid OTP');
      setError(msg);
      setOtp('');
    } finally {
      setLoading(false);
      verifyInFlight.current = false;
    }
  }

  function handleResend() {
    if (countdown > 0) return;
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    login(mobileNumber)
      .catch(() => { /* proceed; user can retry from login screen */ });
    const masked = mobileNumber.replace(/(\+\d{2})(\d{6})(\d)/, '$1 ···· ··$3');
    showToast(`A 6-digit code has been sent to ${masked}`, 'success');
  }

  const masked = mobileNumber.replace(/(\+\d{2})(\d{6})(\d)/, '$1 ···· ··$3');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primary + '18' }]}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Verify OTP</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            A 6-digit code has been sent to{'\n'}{masked}
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Enter OTP</Text>
          <OtpInput value={otp} onChange={setOtp} error={error} />

          <View style={styles.expiryRow}>
            <Text style={[styles.expiryText, { color: countdown === 0 ? colors.error : colors.textTertiary }]}>
              {countdown === 0 ? 'Code expired — request a new one' : `Resend in ${countdown} seconds`}
            </Text>
          </View>

          <View style={styles.resendRow}>
            <Text style={[styles.resendPrompt, { color: colors.textSecondary }]}>
              Didn't receive the code?
            </Text>
            {countdown === 0 ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.resendLink, { color: colors.primary }]}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.resendWait, { color: colors.textTertiary }]}>Resend in {countdown}s</Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: tokens.spacing6 },
  backBtn: { marginBottom: tokens.spacing6 },
  backText: { fontSize: 15, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: tokens.spacing8 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: tokens.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing4,
  },
  icon: { fontSize: 32 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: tokens.spacing2 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.01 * 13, textAlign: 'center', marginBottom: tokens.spacing3 },
  expiryRow: { alignItems: 'center', marginBottom: tokens.spacing5, marginTop: tokens.spacing1 },
  expiryText: { fontSize: 12, letterSpacing: 0.01 * 12 },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing5,
    gap: tokens.spacing1,
  },
  resendPrompt: { fontSize: 13 },
  resendLink: { fontSize: 13, fontWeight: '700' },
  resendWait: { fontSize: 13 },
});