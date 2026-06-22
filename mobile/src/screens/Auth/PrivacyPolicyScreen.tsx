import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';
import { config } from '../../config';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PrivacyPolicy'>;
};

const SECTIONS = [
  {
    id: '1',
    title: 'Information We Collect',
    icon: 'information-circle-outline',
    body: 'We collect your mobile number and registration details (name, state, district, category, and preferred language) when you create an account. We also collect questions, answers, and any media you submit through the platform.',
  },
  {
    id: '2',
    title: 'How We Use Your Information',
    icon: 'settings-outline',
    body: 'Your mobile number and registration details are used solely for platform authentication and agricultural knowledge services. Questions and content you submit are used for agricultural research, AI model training, and policy planning purposes.',
  },
  {
    id: '3',
    title: 'Data Storage & Security',
    icon: 'shield-checkmark-outline',
    body: 'All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion. We implement reasonable security measures to protect your personal information.',
  },
  {
    id: '4',
    title: 'Data Sharing',
    icon: 'share-outline',
    body: 'We do not sell your personal information. Your data may be used for research and policy purposes in an anonymised or aggregated form. We may share data when required by law.',
  },
  {
    id: '5',
    title: 'Your Rights',
    icon: 'person-outline',
    body: 'You have the right to access, correct, or delete your personal data at any time. You may withdraw consent and request data deletion at any time by contacting our support team. Upon deletion, your personal data will be removed as per applicable data protection laws.',
  },
  {
    id: '6',
    title: 'Cookies & Analytics',
    icon: 'analytics-outline',
    body: 'We may use cookies and analytics tools to improve the platform experience and understand usage patterns. You can control cookie preferences through your device settings.',
  },
  {
    id: '7',
    title: "Children's Privacy",
    icon: 'people-outline',
    body: 'The platform is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.',
  },
  {
    id: '8',
    title: 'Changes to This Policy',
    icon: 'refresh-outline',
    body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy within the app. Continued use of the platform constitutes acceptance of the updated policy.',
  },
  {
    id: '9',
    title: 'Contact & Data Requests',
    icon: 'mail-outline',
    body: `For questions about this Privacy Policy, to access or delete your data, or to withdraw consent, please contact our support team at ${config.support.email}.`,
  },
];

export function PrivacyPolicyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>Privacy Policy</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="shield-checkmark" size={32} color={c.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: c.text }]}>Privacy Policy</Text>
          <Text style={[styles.heroSub, { color: c.textSecondary }]}>
            Last updated: June 2026 · {SECTIONS.length} sections
          </Text>
        </View>

        {/* Info banner */}
        <View style={[styles.banner, { backgroundColor: c.primary + '12' }]}>
          <Ionicons name="lock-closed-outline" size={16} color={c.primary} />
          <Text style={[styles.bannerText, { color: c.primary }]}>
            Your data is stored securely and never sold to third parties.
          </Text>
        </View>

        {/* Sections */}
        <View style={styles.sections}>
          {SECTIONS.map(({ id, title, icon, body }) => {
            const isOpen = openId === id;
            return (
              <View key={id} style={[styles.sectionCard, { backgroundColor: c.surface }]}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setOpenId(isOpen ? null : id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionLeft}>
                    <View style={[styles.sectionIconBox, { backgroundColor: c.muted }]}>
                      <Ionicons name={icon as any} size={16} color={c.primary} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={c.textTertiary}
                  />
                </TouchableOpacity>
                {isOpen && (
                  <View style={[styles.sectionBody, { borderTopColor: c.borderSubtle }]}>
                    <Text style={[styles.sectionBodyText, { color: c.textSecondary }]}>
                      {body}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  topBarTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  spacer: { minWidth: 60 },
  scroll: { padding: tokens.spacing6 },
  hero: { alignItems: 'center', marginBottom: tokens.spacing5 },
  heroIcon: {
    width: 72, height: 72,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: tokens.spacing3,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSub: { fontSize: 13 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing5,
  },
  bannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
  sections: { gap: tokens.spacing2 },
  sectionCard: {
    borderRadius: tokens.radiusLg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing4,
    paddingHorizontal: tokens.spacing4,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: tokens.spacing3,
  },
  sectionIconBox: {
    width: 30, height: 30,
    borderRadius: tokens.radiusMd,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionBody: {
    borderTopWidth: 1,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing4,
    paddingHorizontal: tokens.spacing4,
  },
  sectionBodyText: { fontSize: 13, lineHeight: 20 },
});