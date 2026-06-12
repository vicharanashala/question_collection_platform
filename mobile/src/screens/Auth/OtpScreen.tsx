import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { OtpInput } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Otp'>;
  route: RouteProp<AuthStackParamList, 'Otp'>;
};

export function OtpScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { verifyOtp, register } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6) {
      handleVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleVerify() {
    if (otp.length < 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyOtp(mobileNumber, otp);
      // If verifyOtp returns without throwing, user is logged in
      // AuthProvider state update handles navigation via navigation container
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid OTP. Please try again.';
      setError(msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
    try {
      const { login } = useAuth();
      // re-request OTP through the auth context
    } catch { /* ignore */ }
  }

  const masked = mobileNumber.replace(/(\+\d{2})(\d{6})(\d)/, '$1******$3');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>📱</Text>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}{masked}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Enter OTP</Text>
          <OtpInput value={otp} onChange={setOtp} error={error} />

          <Text style={styles.hint}>
            This code expires in {countdown > 0 ? `${countdown}s` : '0s'}
          </Text>

          <Button
            title="Verify & Continue"
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length < 6}
          />

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            {countdown === 0 ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendText}>{countdown}s</Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  content: { flex: 1, padding: 24 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 16, color: '#2E7D32', fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1B5E20', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#558B2F', textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12, textAlign: 'center' },
  hint: { fontSize: 12, color: '#9E9E9E', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  resendText: { fontSize: 14, color: '#757575' },
  resendLink: { fontSize: 14, color: '#2E7D32', fontWeight: '700' },
});