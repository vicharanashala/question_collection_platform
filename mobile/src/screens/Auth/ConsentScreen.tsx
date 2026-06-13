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
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Consent'>;
  route: RouteProp<AuthStackParamList, 'Consent'>;
};

export function ConsentScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { login } = useAuth();
  const { showToast } = useToast();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!accepted) { showToast('Please accept the Privacy Policy to continue.', 'warning'); return; }
    setLoading(true);
    try { await login(mobileNumber); }
    catch (err) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, 'Unable to send OTP. Please try again.'), 'error');
    }
    finally { setLoading(false); }
    navigation.navigate('Register', { mobileNumber });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: c.primary + '18' }]}>
            <Text style={styles.icon}>📜</Text>
          </View>
          <Text style={[styles.title, { color: c.text }]}>Privacy & Consent</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Terms of Service & Privacy Policy</Text>

          <View style={[styles.clauseBox, { backgroundColor: c.muted }]}>
            <Text style={[styles.clauseText, { color: c.textSecondary }]}>
              Please read the following terms carefully before creating your account:
            </Text>
          </View>

          <View style={styles.clauses}>
            {[
              ['1.', 'Your mobile number and registration details will be stored securely and used solely for platform authentication and agricultural knowledge services.'],
              ['2.', 'Questions and content you submit will be used for agricultural research, AI model training, and policy planning purposes.'],
              ['3.', 'All submitted data is owned by the organisation and will be retained indefinitely unless you request account deletion.'],
              ['4.', 'You are solely responsible for the accuracy of information submitted through your account.'],
              ['5.', 'You may withdraw consent and request data deletion at any time by contacting our support team.'],
            ].map(([num, text]) => (
              <View key={num} style={styles.clause}>
                <Text style={[styles.clauseNum, { color: c.primary }]}>{num}</Text>
                <Text style={[styles.clauseBody, { color: c.textSecondary }]}>{text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.policyLink}
            onPress={() => Linking.openURL('https://example.com/privacy')}
          >
            <Text style={[styles.policyLinkText, { color: c.primary }]}>
              Read full Privacy Policy →
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
              I have read and agree to the Terms of Service and Privacy Policy
            </Text>
          </TouchableOpacity>

          <Button
            title="I Accept & Continue"
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