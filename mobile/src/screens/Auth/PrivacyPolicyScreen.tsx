import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PrivacyPolicy'>;
};

export function PrivacyPolicyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header bar */}
      <View style={[styles.topBar, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>Privacy Policy</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>
            Last updated: June 2026
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>1. Information We Collect</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            We collect your mobile number and registration details (name, state, district, category, and preferred language) when you create an account. We also collect questions, answers, and any media you submit through the platform.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>2. How We Use Your Information</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Your mobile number and registration details are used solely for platform authentication and agricultural knowledge services. Questions and content you submit are used for agricultural research, AI model training, and policy planning purposes.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>3. Data Storage and Security</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion. We implement reasonable security measures to protect your personal information.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>4. Data Sharing</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            We do not sell your personal information. Your data may be used for research and policy purposes in an anonymised or aggregated form. We may share data when required by law.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>5. Your Rights</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            You have the right to access, correct, or delete your personal data at any time. You may withdraw consent and request data deletion at any time by contacting our support team. Upon deletion, your personal data will be removed as per applicable data protection laws.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>6. Cookies and Analytics</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            We may use cookies and analytics tools to improve the platform experience and understand usage patterns. You can control cookie preferences through your device settings.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>7. Children's Privacy</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            The platform is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>8. Changes to This Policy</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy within the app. Continued use of the platform constitutes acceptance of the updated policy.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>9. Contact</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            For questions about this Privacy Policy or to request data deletion, please contact our support team.
          </Text>
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
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  lastUpdated: { fontSize: 12, marginBottom: tokens.spacing5 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: tokens.spacing5, marginBottom: tokens.spacing2 },
  body: { fontSize: 13, lineHeight: 20 },
});