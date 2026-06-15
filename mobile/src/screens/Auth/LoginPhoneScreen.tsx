import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
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
  const { t, i18n } = useTranslation();

  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [langModalVisible, setLangModalVisible] = useState(false);

  const validMobile = /^[6-9]\d{9}$/.test(mobile);

  function handleChangeText(text: string) {
    const newMobile = text.replace(/\D/g, '');
    setMobile(newMobile);
    const newValid = /^[6-9]\d{9}$/.test(newMobile);
    const isShort = newMobile.length > 0 && !newValid;
    setError(isShort ? t('invalidPhone') : '');
  }

  async function handleRequestOtp() {
    if (!validMobile) { setError(t('invalidPhone')); return; }
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

  const selectedLang = i18n.language;
  const langLabel = selectedLang === 'en' ? 'English'
    : selectedLang === 'hi' ? 'हिन्दी'
    : selectedLang === 'kn' ? 'ಕನ್ನಡ'
    : selectedLang === 'ta' ? 'தமிழ்'
    : selectedLang === 'te' ? 'తెలుగు'
    : selectedLang === 'bn' ? 'বাংলা'
    : selectedLang === 'mr' ? 'मराठी'
    : selectedLang === 'gu' ? 'ગુજરાતી'
    : selectedLang === 'pa' ? 'ਪੰਜਾਬੀ'
    : selectedLang === 'or' ? 'ଓଡ଼ିଆ'
    : selectedLang === 'ml' ? 'മലയാളം'
    : selectedLang;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header row: logo + language */}
      <View style={styles.topBar}>
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}
          <View style={styles.branding}>
            <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
              <Ionicons name="leaf" size={32} color={c.primaryForeground} />
            </View>
            <Text style={[styles.brand, { color: c.text }]}>{t('loginPhone.title')}</Text>
            <Text style={[styles.tagline, { color: c.textSecondary }]}>
              {t('loginPhone.tagline')}
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Text style={[styles.cardDesc, { color: c.textSecondary }]}>
              {t('signInDesc')}
            </Text>

            <Input
              label={t('auth.phone')}
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
              title={t('auth.sendOtp')}
              onPress={handleRequestOtp}
              disabled={!validMobile}
              loading={loading}
              testID="send-otp-button"
            />
          </View>

          {/* Legal */}
          <Text style={[styles.legal, { color: c.textTertiary }]}>
            {t('agreeToTerms')}{' '}
            <Text style={{ color: c.primary }}>{t('termsOfService')}</Text>{' '}
            {t('and')}{' '}
            <Text style={{ color: c.primary }}>{t('privacyPolicy')}</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <LanguageSwitcher
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing2,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: tokens.radiusXl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: tokens.spacing4,
  },
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: tokens.spacing6 },
  branding: { alignItems: 'center', marginBottom: tokens.spacing8 },
  brand: { fontSize: 28, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { fontSize: 14, marginTop: tokens.spacing2, letterSpacing: 0.01 * 14 },
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  cardDesc: { fontSize: 14, marginBottom: tokens.spacing5, lineHeight: 20 },
  phoneCode: { fontSize: 15, fontWeight: '700' },
  legal: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: tokens.spacing6,
    lineHeight: 18,
  },
});