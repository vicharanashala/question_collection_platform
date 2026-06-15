import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';
import { useTranslation } from 'react-i18next';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'LoginPhone'> };

export function LoginPhoneScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { login } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validMobile = /^[6-9]\d{9}$/.test(mobile);

  function handleChangeText(text: string) {
    const newMobile = text.replace(/\D/g, '');
    setMobile(newMobile);
    const newValid = /^[6-9]\d{9}$/.test(newMobile);
    const isShort = newMobile.length > 0 && !newValid;
    setError(isShort ? t('errors.invalidPhone') : '');
  }

  async function handleRequestOtp() {
    if (!validMobile) { setError(t('errors.invalidPhone')); return; }
    setError('');
    setLoading(true);
    try {
      await login(`+91${mobile}`);
      navigation.navigate('Otp', { mobileNumber: `+91${mobile}` });
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, 'Unable to send OTP. Please try again.'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
              <Text style={[styles.logoText, { color: c.primaryForeground }]}>KD</Text>
            </View>
            <Text style={[styles.brand, { color: c.text }]}>{t('loginPhone.title')}</Text>
            <Text style={[styles.tagline, { color: c.textSecondary }]}>
              {t('loginPhone.tagline')}
            </Text>
          </View>

          {/* Phone card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Sign In</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSecondary }]}>
                Enter your mobile number to continue
              </Text>
            </View>

            <Input
              label="Mobile Number"
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={handleChangeText}
              error={error}
              leftIcon={
                <View style={styles.countryCode}>
                  <Text style={[styles.countryFlag]}>🇮🇳</Text>
                  <Text style={[styles.countryCodeText, { color: c.primary }]}>+91</Text>
                </View>
              }
            />

            <Button
              title="Send OTP"
              onPress={handleRequestOtp}
              disabled={!validMobile}
              loading={loading}
              testID="send-otp-button"
            />

            {/* What happens next */}
            <View style={[styles.hintBox, { backgroundColor: c.muted }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={c.textTertiary} style={styles.hintIcon} />
              <Text style={[styles.hintText, { color: c.textTertiary }]}>
                We'll send a 6-digit OTP to verify your number. No password needed.
              </Text>
            </View>
          </View>

          {/* Legal + links */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: c.textTertiary }]}>
              By continuing, you agree to our{' '}
              <Pressable onPress={() => navigation.navigate('TermsOfService')}>
                <Text style={[styles.link, { color: c.primary }]}>Terms of Service</Text>
              </Pressable>
              {' '}and{' '}
              <Pressable onPress={() => navigation.navigate('PrivacyPolicy')}>
                <Text style={[styles.link, { color: c.primary }]}>Privacy Policy</Text>
              </Pressable>
            </Text>
          </View>

          {/* Steps preview */}
          <View style={styles.stepsSection}>
            {[
              { num: '1', label: 'Enter mobile number' },
              { num: '2', label: 'Verify with OTP' },
              { num: '3', label: 'Create account' },
            ].map(({ num, label }) => (
              <View key={num} style={styles.stepItem}>
                <View style={[styles.stepDot, { borderColor: c.primary }]}>
                  <Text style={[styles.stepNum, { color: c.primary }]}>{num}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: c.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing6,
    paddingVertical: tokens.spacing8,
  },

  // Logo section
  logoSection: { alignItems: 'center', marginBottom: tokens.spacing8 },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: tokens.radiusXl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing3,
  },
  logoText: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  brand: { fontSize: 28, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
  tagline: { fontSize: 14, letterSpacing: 0.01 * 14 },

  // Card
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
    marginBottom: tokens.spacing5,
  },
  cardHeader: { marginBottom: tokens.spacing5 },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, lineHeight: 20 },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countryFlag: { fontSize: 16 },
  countryCodeText: { fontSize: 14, fontWeight: '700' },

  // Hint
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginTop: tokens.spacing4,
    gap: tokens.spacing2,
  },
  hintIcon: { marginTop: 1 },
  hintText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Footer
  footer: { paddingHorizontal: tokens.spacing2, marginBottom: tokens.spacing6 },
  footerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  link: { fontSize: 12, fontWeight: '600' },

  // Steps
  stepsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing5,
  },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: tokens.radiusFull,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 11, textAlign: 'center' },
});