import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useTheme } from '../../hooks/useTheme';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';
import { config } from '../../config';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Terms'>;
  route: RouteProp<AuthStackParamList, 'Terms'>;
};

const SECTIONS = [
  {
    id: '1',
    title: 'Acceptance of Terms',
    body: 'By accessing or using the AnnaDatha platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.',
  },
  {
    id: '2',
    title: 'Purpose of the Platform',
    body: 'AnnaDatha is an agricultural knowledge platform that allows users to submit questions, share expertise, and receive answers related to farming, crops, and agricultural practices.',
  },
  {
    id: '3',
    title: 'User Accounts',
    body: 'You agree to provide accurate and complete information during registration. You are solely responsible for maintaining the confidentiality of your account and for all activities under your account.',
  },
  {
    id: '4',
    title: 'Content You Submit',
    body: 'Questions and content submitted by you will be used for agricultural research, AI model training, and policy planning purposes. All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion.',
  },
  {
    id: '5',
    title: 'Moderation',
    body: 'The platform reserves the right to moderate, edit, approve, or reject any submitted content at any time without prior notice. We may suspend or terminate your access if you violate these terms.',
  },
  {
    id: '6',
    title: 'Rewards and Incentives',
    body: 'Rewards and incentives are subject to platform policy and may be changed or withdrawn at any time without prior notice. All rewards are subject to verification and approval of submitted content.',
  },
  {
    id: '7',
    title: 'Privacy',
    body: 'Your mobile number and registration details will be stored securely and used solely for platform authentication and agricultural knowledge services. For full details, please refer to our Privacy Policy.',
  },
  {
    id: '8',
    title: 'Account Deletion',
    body: 'You may withdraw consent and request data deletion at any time by contacting our support team. Upon deletion, your personal data will be removed as per applicable data protection laws.',
  },
  {
    id: '9',
    title: 'Limitation of Liability',
    body: 'The platform is provided "as is." We do not guarantee the accuracy, completeness, or usefulness of any information on the platform. You are solely responsible for the accuracy of information submitted through your account.',
  },
  {
    id: '10',
    title: 'Changes to Terms',
    body: 'We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
  },
  {
    id: '11',
    title: 'Contact',
    body: `For questions about these Terms of Service, please contact our support team at ${config.support.email}.`,
  },
];

export function TermsScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const [accepted, setAccepted] = useState(false);
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: c.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>Terms of Service</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="document-text-outline" size={32} color={c.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: c.text }]}>Terms of Service</Text>
          <Text style={[styles.heroSub, { color: c.textSecondary }]}>
            Read and accept to continue · {SECTIONS.length} sections
          </Text>
        </View>

        {/* Accordion sections */}
        <View style={styles.sections}>
          {SECTIONS.map(({ id, title, body }) => {
            const isOpen = openId === id;
            return (
              <View key={id} style={[styles.sectionCard, { backgroundColor: c.surface }]}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setOpenId(isOpen ? null : id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionLeft}>
                    <View style={[styles.sectionNum, { backgroundColor: c.primary + '18' }]}>
                      <Text style={[styles.sectionNumText, { color: c.primary }]}>{id}</Text>
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

        {/* Privacy Policy link */}
        <TouchableOpacity
          style={styles.policyLink}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={c.primary} />
          <Text style={[styles.policyLinkText, { color: c.primary }]}>
            Read our Privacy Policy →
          </Text>
        </TouchableOpacity>

        {/* Checkbox */}
        <TouchableOpacity
          style={[styles.checkbox, { backgroundColor: c.surface }]}
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
              <Ionicons name="checkmark" size={13} color={c.primaryForeground} />
            )}
          </View>
          <Text style={[styles.checkboxLabel, { color: c.text }]}>
            I have read and agree to the{' '}
            <Text style={{ fontWeight: '700' }}>Terms of Service</Text> and{' '}
            <Text style={{ fontWeight: '700' }}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        {/* Confirm */}
        <Button
          title="Confirm & Continue"
          onPress={() => navigation.navigate('Register', { mobileNumber })}
          disabled={!accepted}
        />
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
  hero: { alignItems: 'center', marginBottom: tokens.spacing6 },
  heroIcon: {
    width: 72, height: 72,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: tokens.spacing3,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSub: { fontSize: 13 },
  sections: { marginBottom: tokens.spacing5, gap: tokens.spacing2 },
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
  sectionNum: {
    width: 26, height: 26,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionBody: {
    borderTopWidth: 1,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing4,
    paddingHorizontal: tokens.spacing4,
  },
  sectionBodyText: { fontSize: 13, lineHeight: 20 },
  policyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing5,
  },
  policyLinkText: { fontSize: 14, fontWeight: '600' },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing4,
    gap: tokens.spacing3,
  },
  checkboxBox: {
    width: 22, height: 22,
    borderRadius: tokens.radius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 20 },
});