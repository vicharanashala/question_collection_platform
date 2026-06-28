import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';
import { config } from '../../config';
import { systemApi } from '../../api/client';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PrivacyPolicy'>;
};

interface Section { id: string; title: string; body: string }

const FALLBACK_SECTIONS: Section[] = [
  { id: '1', title: 'Information We Collect', body: 'We collect your mobile number and registration details (name, state, district, category, and preferred language) when you create an account. We also collect questions, answers, and any media you submit through the platform.' },
  { id: '2', title: 'How We Use Your Information', body: 'Your mobile number and registration details are used solely for platform authentication and agricultural knowledge services. Questions and content you submit are used for agricultural research, AI model training, and policy planning purposes.' },
  { id: '3', title: 'Data Storage & Security', body: 'All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion. We implement reasonable security measures to protect your personal information.' },
  { id: '4', title: 'Data Sharing', body: 'We do not sell your personal information. Your data may be used for research and policy purposes in an anonymised or aggregated form. We may share data when required by law.' },
  { id: '5', title: 'Your Rights', body: 'You have the right to access, correct, or delete your personal data at any time. You may withdraw consent and request data deletion at any time by contacting our support team. Upon deletion, your personal data will be removed as per applicable data protection laws.' },
  { id: '6', title: "Children's Privacy", body: 'The platform is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.' },
  { id: '7', title: 'Changes to This Policy', body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy within the app. Continued use of the platform constitutes acceptance of the updated policy.' },
  { id: '8', title: 'Contact & Data Requests', body: `For questions about this Privacy Policy, to access or delete your data, or to withdraw consent, please contact our support team at ${config.support.email}.` },
];

function parseMarkdownSections(md: string): Section[] {
  const lines = md.split('\n');
  const result: Section[] = [];
  let current: { id: string; title: string; body: string[] } | null = null;
  let id = 1;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      if (current) result.push({ id: current.id, title: current.title, body: current.body.join('\n').trim() });
      current = { id: String(id++), title: h2[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) result.push({ id: current.id, title: current.title, body: current.body.join('\n').trim() });
  return result;
}

export function PrivacyPolicyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [openId, setOpenId] = useState<string | null>('1');
  const [sections, setSections] = useState<Section[]>(FALLBACK_SECTIONS);
  const [pageTitle, setPageTitle] = useState('Privacy Policy');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    systemApi.getPublicContent()
      .then(({ data }) => {
        if (data?.privacyPolicy) {
          const pp = data.privacyPolicy;
          if (pp.content) {
            const parsed = parseMarkdownSections(pp.content);
            if (parsed.length > 0) setSections(parsed);
          }
          if (pp.title) setPageTitle(pp.title);
          if (pp.updatedAt) setLastUpdated(pp.updatedAt);
        }
      })
      .catch(() => { /* use fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>{pageTitle}</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="shield-checkmark" size={32} color={c.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: c.text }]}>{pageTitle}</Text>
          <Text style={[styles.heroSub, { color: c.textSecondary }]}>
            {loading ? 'Loading…' : lastUpdated
              ? `Last updated: ${new Date(lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} · ${sections.length} sections`
              : `Last updated: June 2026 · ${sections.length} sections`}
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
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        ) : (
          <View style={styles.sections}>
            {sections.map(({ id: sid, title: stitle, body: sbody }) => {
              const isOpen = openId === sid;
              return (
                <View key={sid} style={[styles.sectionCard, { backgroundColor: c.surface }]}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => setOpenId(isOpen ? null : sid)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sectionLeft}>
                      <View style={[styles.sectionIconBox, { backgroundColor: c.muted }]}>
                        <Ionicons name="information-circle" size={16} color={c.primary} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: c.text }]}>{stitle}</Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textTertiary} />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={[styles.sectionBody, { borderTopColor: c.borderSubtle }]}>
                      <Text style={[styles.sectionBodyText, { color: c.textSecondary }]}>{sbody}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing4, paddingVertical: tokens.spacing3, borderBottomWidth: 1 },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 15, fontWeight: '600' },
  topBarTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  spacer: { minWidth: 60 },
  scroll: { padding: tokens.spacing6 },
  hero: { alignItems: 'center', marginBottom: tokens.spacing5 },
  heroIcon: { width: 72, height: 72, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing3 },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSub: { fontSize: 13 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing5 },
  bannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
  loadingWrap: { alignItems: 'center', paddingVertical: tokens.spacing8 },
  sections: { gap: tokens.spacing2 },
  sectionCard: { borderRadius: tokens.radiusLg, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: tokens.spacing4, paddingHorizontal: tokens.spacing4 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: tokens.spacing3 },
  sectionIconBox: { width: 30, height: 30, borderRadius: tokens.radiusMd, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionBody: { borderTopWidth: 1, paddingTop: tokens.spacing3, paddingBottom: tokens.spacing4, paddingHorizontal: tokens.spacing4 },
  sectionBodyText: { fontSize: 13, lineHeight: 20 },
});