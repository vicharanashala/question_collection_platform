import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
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
    // Validate against the new value (not stale state) so error shows on first keystroke
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
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
              <Text style={[styles.logoText, { color: c.primaryForeground }]}>AQ</Text>
            </View>
            <Text style={[styles.brand, { color: c.text }]}>{t('loginPhone.title')}</Text>
            <Text style={[styles.tagline, { color: c.textSecondary }]}>
              {t('loginPhone.tagline')}
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{t('auth.signIn')}</Text>
            <Text style={[styles.cardDesc, { color: c.textSecondary }]}>
              {t('auth.signInDesc')}
            </Text>

            <Input
              label="Mobile Number"
              placeholder={t('auth.phonePlaceholder')}
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={handleChangeText}
              error={error}
              leftIcon={
                <Text style={[styles.phoneCode, { color: c.primary }]}>+91</Text>
              }
            />

            <Button
              title={t('loginPhone.sendOtp')}
              onPress={handleRequestOtp}
              disabled={!validMobile}
              loading={loading}
              testID="send-otp-button"
            />

            <Text style={[styles.legal, { color: c.textTertiary }]}>
              {t('agreeToTerms')}{' '}
              <Text style={{ color: c.primary }}>{t('termsOfService')}</Text>{' '}{t('and')}{' '}
              <Text style={{ color: c.primary }}>{t('privacyPolicy')}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: tokens.spacing6 },
  header: { alignItems: 'center', marginBottom: tokens.spacing8 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: tokens.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing3,
  },
  logoText: { fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { fontSize: 14, marginTop: tokens.spacing1, letterSpacing: 0.01 * 14 },
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: tokens.spacing1 },
  cardDesc: { fontSize: 14, marginBottom: tokens.spacing5, lineHeight: 20 },
  phoneCode: { fontSize: 15, fontWeight: '700' },
  legal: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: tokens.spacing4,
    lineHeight: 16,
    letterSpacing: 0.01 * 11,
  },
});