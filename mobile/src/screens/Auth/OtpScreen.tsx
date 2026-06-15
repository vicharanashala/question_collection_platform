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
import { Ionicons } from '@expo/vector-icons';
import { OtpInput } from '../../components/Input';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';
import { useTranslation } from 'react-i18next';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Otp'>;
  route: RouteProp<AuthStackParamList, 'Otp'>;
};

export function OtpScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { verifyOtp, login } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [langModalVisible, setLangModalVisible] = useState(false);
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
    if (otp.length < 6) { setError(t('invalidOtp')); return; }
    verifyInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await verifyOtp(mobileNumber, otp) as { requiresRegistration: boolean; user?: unknown };
      if (result.requiresRegistration) {
        navigation.replace('Register', { mobileNumber });
      }
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      const msg = getErrorMessage(err, t('errors.invalidOtp') ?? 'Invalid OTP. Please try again.');
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
    login(mobileNumber).catch(() => { /* proceed; user can retry */ });
    showToast(t('otpSent'), 'success');
  }

  const masked = mobileNumber.replace(/(\+\d{2})(\d{6})(\d)/, '$1 ···· ··$3');

  const langLabel = i18n.language === 'en' ? 'English'
    : i18n.language === 'hi' ? 'हिन्दी'
    : i18n.language === 'kn' ? 'ಕನ್ನಡ'
    : i18n.language === 'ta' ? 'தமிழ்'
    : i18n.language === 'te' ? 'తెలుగు'
    : i18n.language === 'bn' ? 'বাংলা'
    : i18n.language === 'mr' ? 'मराठी'
    : i18n.language === 'gu' ? 'ગુજરાતી'
    : i18n.language === 'pa' ? 'ਪੰਜਾਬੀ'
    : i18n.language === 'or' ? 'ଓଡ଼ିଆ'
    : i18n.language === 'ml' ? 'മലയാളം'
    : i18n.language;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={c.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, { borderColor: c.border }]}
          onPress={() => setLangModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={15} color={c.primary} />
          <Text style={[styles.langBtnText, { color: c.primary }]} numberOfLines={1}>
            {langLabel}
          </Text>
          <Ionicons name="chevron-down" size={13} color={c.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="shield-checkmark" size={36} color={c.primary} />
          </View>
          <Text style={[styles.title, { color: c.text }]}>{t('verifyOtpTitle')}</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            {t('otpSent')}{'\n'}{masked}
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('enterOtp')}</Text>
          <OtpInput value={otp} onChange={setOtp} error={error} />

          {/* Countdown chip */}
          <View style={[styles.countdownChip, {
            backgroundColor: countdown === 0 ? c.error + '15' : c.textTertiary + '15',
          }]}>
            <Ionicons
              name="time-outline"
              size={14}
              color={countdown === 0 ? c.error : c.textTertiary}
            />
            <Text style={[styles.countdownText, {
              color: countdown === 0 ? c.error : c.textTertiary,
            }]}>
              {countdown === 0
                ? t('otpExpired')
                : t('resendWait', { seconds: countdown })}
            </Text>
          </View>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={[styles.resendPrompt, { color: c.textSecondary }]}>
              {t('resendPrompt')}{' '}
            </Text>
            {countdown === 0 ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.resendLink, { color: c.primary }]}>{t('resendOtp')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <LanguageSwitcher
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing2,
  },
  backBtn: { padding: tokens.spacing2 },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: 6,
    maxWidth: 110,
  },
  langBtnText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  content: { flex: 1, padding: tokens.spacing6 },
  header: { alignItems: 'center', marginBottom: tokens.spacing8 },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: tokens.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing5,
  },
  title: { fontSize: 26, fontWeight: '800', marginBottom: tokens.spacing2 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: tokens.spacing4,
    textTransform: 'uppercase',
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    borderRadius: tokens.radiusFull,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: 6,
    marginTop: tokens.spacing4,
    marginBottom: tokens.spacing1,
  },
  countdownText: { fontSize: 12, fontWeight: '600' },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing4,
  },
  resendPrompt: { fontSize: 13 },
  resendLink: { fontSize: 13, fontWeight: '700' },
});