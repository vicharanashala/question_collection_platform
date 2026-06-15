import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Terms'>;
  route: RouteProp<AuthStackParamList, 'Terms'>;
};

export function TermsScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const [accepted, setAccepted] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header bar */}
      <View style={[styles.topBar, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>Terms of Service</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Card */}
        <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.lastUpdated, { color: c.textTertiary }]}>
            Last updated: June 2026
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            By accessing or using the AgriQuestion platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>2. Purpose of the Platform</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            AgriQuestion is an agricultural knowledge platform that allows users to submit questions, share expertise, and receive answers related to farming, crops, and agricultural practices.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>3. User Accounts</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            You agree to provide accurate and complete information during registration. You are solely responsible for maintaining the confidentiality of your account and for all activities under your account.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>4. Content You Submit</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Questions and content submitted by you will be used for agricultural research, AI model training, and policy planning purposes. All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>5. Moderation</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            The platform reserves the right to moderate, edit, approve, or reject any submitted content at any time without prior notice. We may suspend or terminate your access if you violate these terms.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>6. Rewards and Incentives</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Rewards and incentives are subject to platform policy and may be changed or withdrawn at any time without prior notice. All rewards are subject to verification and approval of submitted content.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>7. Privacy</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Your mobile number and registration details will be stored securely and used solely for platform authentication and agricultural knowledge services. For full details, please refer to our Privacy Policy.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>8. Account Deletion</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            You may withdraw consent and request data deletion at any time by contacting our support team. Upon deletion, your personal data will be removed as per applicable data protection laws.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>9. Limitation of Liability</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            The platform is provided "as is." We do not guarantee the accuracy, completeness, or usefulness of any information on the platform. You are solely responsible for the accuracy of information submitted through your account.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>10. Changes to Terms</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.
          </Text>

          <Text style={[styles.sectionTitle, { color: c.text }]}>11. Contact</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            For questions about these Terms of Service, please contact our support team.
          </Text>

          {/* Privacy Policy link */}
          <TouchableOpacity
            style={styles.policyLink}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={[styles.policyLinkText, { color: c.primary }]}>
              Read Privacy Policy →
            </Text>
          </TouchableOpacity>

          {/* Checkbox */}
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkboxBox,
                {
                  borderColor: accepted ? c.primary : c.borderSubtle,
                  backgroundColor: accepted ? c.primary : 'transparent',
                },
              ]}
            >
              {accepted && (
                <Text style={[styles.checkmark, { color: c.primaryForeground }]}>✓</Text>
              )}
            </View>
            <Text style={[styles.checkboxLabel, { color: c.text }]}>
              I have read and agree to the Terms of Service and Privacy Policy
            </Text>
          </TouchableOpacity>

          {/* Confirm button */}
          <Button
            title="Confirm"
            onPress={() => navigation.navigate('Register', { mobileNumber })}
            disabled={!accepted}
          />
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
  policyLink: { marginTop: tokens.spacing5, marginBottom: tokens.spacing5 },
  policyLinkText: { fontSize: 14, fontWeight: '600' },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing5,
    gap: tokens.spacing3,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: { fontSize: 13, fontWeight: '800' },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 20 },
});