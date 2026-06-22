import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';
import { useTranslation } from 'react-i18next';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Consent'>;
  route: RouteProp<AuthStackParamList, 'Consent'>;
};

const CLAUSES = [
  'consentClause1',
  'consentClause2',
  'consentClause3',
  'consentClause4',
  'consentClause5',
] as const;

export function ConsentScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { login } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!accepted) { showToast(t('acceptConsentRequired'), 'warning'); return; }
    setLoading(true);
    try { await login(mobileNumber); }
    catch (err) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, t('serverError')), 'error');
    }
    finally { setLoading(false); }
    navigation.navigate('Terms', { mobileNumber });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="document-text-outline" size={28} color={c.primary} />
          </View>
          <Text style={[styles.title, { color: c.text }]}>{t('privacyConsent')}</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>{t('termsTitle')}</Text>

          <View style={[styles.clauseBox, { backgroundColor: c.muted }]}>
            <Text style={[styles.clauseText, { color: c.textSecondary }]}>
              {t('consentIntro')}
            </Text>
          </View>

          <View style={styles.clauses}>
            {CLAUSES.map((key, i) => (
              <View key={key} style={styles.clause}>
                <Text style={[styles.clauseNum, { color: c.primary }]}>{i + 1}.</Text>
                <Text style={[styles.clauseBody, { color: c.textSecondary }]}>{t(key)}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.policyLink}
            onPress={() => Linking.openURL('https://example.com/privacy')}
          >
            <Text style={[styles.policyLinkText, { color: c.primary }]}>
              {t('readFullPolicy')}
            </Text>
          </TouchableOpacity>

          {/* Consent checkbox */}
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkboxBox,
                { borderColor: accepted ? c.primary : c.borderSubtle, backgroundColor: accepted ? c.primary : 'transparent' },
              ]}
            >
              {accepted && <Text style={[styles.checkmark, { color: c.primaryForeground }]}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, { color: c.text }]}>
              {t('agreeToConsent')}
            </Text>
          </TouchableOpacity>

          <Button
            title={t('iAcceptContinue')}
            onPress={handleContinue}
            disabled={!accepted}
            loading={loading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: tokens.spacing6 },
  header: { alignItems: 'center', marginBottom: tokens.spacing6 },
  iconBadge: { width: 72, height: 72, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing4 },
  icon: { fontSize: 32 },
  title: { fontSize: 26, fontWeight: '800' },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: tokens.spacing4 },
  clauseBox: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4 },
  clauseText: { fontSize: 13, lineHeight: 20 },
  clauses: { marginBottom: tokens.spacing4 },
  clause: { flexDirection: 'row', marginBottom: tokens.spacing3, gap: tokens.spacing2 },
  clauseNum: { fontSize: 13, fontWeight: '700', width: 16 },
  clauseBody: { flex: 1, fontSize: 13, lineHeight: 20 },
  policyLink: { marginBottom: tokens.spacing5 },
  policyLinkText: { fontSize: 14, fontWeight: '600' },
  checkbox: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: tokens.spacing6, gap: tokens.spacing3 },
  checkboxBox: { width: 22, height: 22, borderRadius: tokens.radius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkmark: { fontSize: 13, fontWeight: '800' },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 20 },
});