import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { OtpInput } from '../../components/Input';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { UserRole } from '../../types';
import { tokens } from '../../utils/theme';
import { parseAccountLocked, AccountLockedInfo } from '../../api/client';
import { config } from '../../config';
import { useTranslation } from 'react-i18next';

const ADMIN_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR];

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
  const { t } = useTranslation();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedInfo, setLockedInfo] = useState<AccountLockedInfo | null>(null);
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
    if (otp.length < 6) { setError(t('otp.invalidOtp')); return; }
    verifyInFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await verifyOtp(mobileNumber, otp) as {
        requiresRegistration?: boolean;
        role?: string;
        user?: unknown;
      };

      if (result.requiresRegistration) {
        if (result.role && ADMIN_ROLES.includes(result.role as UserRole)) {
          await login(mobileNumber);
          return;
        }
        navigation.replace('Terms', { mobileNumber });
      }
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      const locked = parseAccountLocked(err);
      if (locked) {
        setLockedInfo(locked);
        setError('');
        setOtp('');
      } else {
        const msg = getErrorMessage(err, t('otp.invalidOtp'));
        setError(msg);
        setOtp('');
      }
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
    showToast(`${t('otp.otpSentMessage')} ${masked}`, 'success');
  }

  const masked = mobileNumber.replace(/(\+\d{2})(\d{6})(\d)/, '$1 ···· ··$3');

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>← {t('back')}</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{t('otp.verifyOtpTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('otp.otpSentMessage')}{'\n'}{masked}
          </Text>
        </View>

        {/* Account status banner — shown to suspended/banned users */}
        {lockedInfo && (
          <View style={[
            styles.lockedBanner,
            { backgroundColor: lockedInfo.status === 'banned' ? colors.error + '14' : colors.warning + '14' },
          ]}>
            <View style={styles.lockedBannerIconRow}>
              <Ionicons
                name={lockedInfo.status === 'banned' ? 'ban-outline' : 'pause-circle-outline'}
                size={20}
                color={lockedInfo.status === 'banned' ? colors.error : colors.warning}
                style={styles.lockedBannerIcon}
              />
              <Text style={[
                styles.lockedBannerTitle,
                { color: lockedInfo.status === 'banned' ? colors.error : colors.warning },
              ]}>
                {lockedInfo.status === 'banned' ? t('otp.accountBanned') : t('otp.accountSuspended')}
              </Text>
            </View>
            {lockedInfo.reason && (
              <Text style={[styles.lockedBannerReason, { color: colors.text }]}>
                {t('otp.reason')}: {lockedInfo.reason}
              </Text>
            )}
            {(lockedInfo.suspendedAt ?? lockedInfo.bannedAt) && (
              <Text style={[styles.lockedBannerDate, { color: colors.textSecondary }]}>
                {t('otp.since')}: {formatDate(lockedInfo.suspendedAt ?? lockedInfo.bannedAt)}
              </Text>
            )}
            <View style={styles.lockedBannerEmailRow}>
              <Text style={[styles.lockedBannerContactLabel, { color: colors.textSecondary }]}>
                If you believe this was a mistake, contact support
              </Text>
              <TouchableOpacity
                style={[styles.lockedBannerEmailBtn, {
                  borderColor: lockedInfo.status === 'banned' ? colors.error + '88' : colors.warning + '88',
                }]}
                onPress={() => {
                  if (!config.support.email) return;
                  const subject = encodeURIComponent(lockedInfo.status === 'banned'
                    ? t('otp.contactSupportBannedSubject')
                    : t('otp.contactSupportSuspendedSubject'));
                  Linking.openURL(`mailto:${config.support.email}?subject=${subject}`).catch(() => {});
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="mail-outline"
                  size={14}
                  color={lockedInfo.status === 'banned' ? colors.error : colors.warning}
                />
                <Text style={[styles.lockedBannerEmailLabel, {
                  color: lockedInfo.status === 'banned' ? colors.error : colors.warning,
                }]}>Send email</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* OTP Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('otp.enterOtp')}</Text>
          <OtpInput value={otp} onChange={setOtp} error={error} />

          <View style={styles.expiryRow}>
            <Text style={[styles.expiryText, { color: countdown === 0 ? colors.error : colors.textTertiary }]}>
              {countdown === 0 ? t('otp.expiryExpired') : t('otp.expiryWithin').replace('{seconds}', countdown)}
            </Text>
          </View>

          <View style={styles.resendRow}>
            <Text style={[styles.resendPrompt, { color: colors.textSecondary }]}>
              {t('otp.resendPrompt')}
            </Text>
            {countdown === 0 ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.resendLink, { color: colors.primary }]}>{t('otp.resendLink')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.resendWait, { color: colors.textTertiary }]}>{t('otp.resendIn').replace('{seconds}', countdown)}</Text>
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
    width: 72, height: 72,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: tokens.spacing4,
  },
  icon: { fontSize: 32 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: tokens.spacing2, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  lockedBanner: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lockedBannerIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spacing2 },
  lockedBannerIcon: { fontSize: 18, marginRight: tokens.spacing2 },
  lockedBannerTitle: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  lockedBannerReason: { fontSize: 13, marginTop: 2, flexShrink: 1 },
  lockedBannerDate: { fontSize: 12, marginTop: 2, flexShrink: 1 },
  lockedBannerEmailRow: { marginTop: tokens.spacing2 },
  lockedBannerContactLabel: { fontSize: 11, marginBottom: tokens.spacing2 },
  lockedBannerEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing1,
    paddingVertical: 5,
    paddingHorizontal: tokens.spacing3,
    borderRadius: tokens.radiusFull,
    borderWidth: 1,
  },
  lockedBannerEmailLabel: { fontSize: 12, fontWeight: '700' },
  lockedCardLabel: { fontSize: 12, textAlign: 'center', marginBottom: tokens.spacing3, flexShrink: 1 },
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  label: {
    fontSize: 13, fontWeight: '600',
    letterSpacing: 0.01 * 13, textAlign: 'center',
    marginBottom: tokens.spacing3,
  },
  expiryRow: { alignItems: 'center', marginBottom: tokens.spacing5, marginTop: tokens.spacing1 },
  expiryText: { fontSize: 12, letterSpacing: 0.01 * 12, flexShrink: 1, textAlign: 'center' },
  resendRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: tokens.spacing5, gap: tokens.spacing1, flexWrap: 'wrap',
  },
  resendPrompt: { fontSize: 13, flexShrink: 1 },
  resendLink: { fontSize: 13, fontWeight: '700', flexShrink: 0 },
  resendWait: { fontSize: 13, flexShrink: 1, minHeight: 20 },
});