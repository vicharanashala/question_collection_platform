import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Consent'>;
  route: RouteProp<AuthStackParamList, 'Consent'>;
};

export function ConsentScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!accepted) {
      Alert.alert('Consent Required', 'Please accept the Privacy Policy to continue.');
      return;
    }
    setLoading(true);
    try {
      await useAuth().login(mobileNumber);
      navigation.navigate('Register', { mobileNumber });
    } catch {
      // Even if OTP request fails, proceed to registration
      navigation.navigate('Register', { mobileNumber });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.logo}>📜</Text>
          <Text style={styles.title}>Privacy & Consent</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Terms of Service & Privacy Policy</Text>
          <Text style={styles.body}>
            By clicking "I Accept" below, you agree to the following:{'\n\n'}
            1. Your mobile number and registration details will be stored securely.{'\n\n'}
            2. Questions you submit will be used for agricultural research, AI training, and policy planning.{'\n\n'}
            3. You may withdraw your consent at any time by contacting support.{'\n\n'}
            4. All data collected is owned by the organization and will be retained indefinitely.{'\n\n'}
            5. You are responsible for the accuracy of information submitted.
          </Text>

          <TouchableOpacity
            style={styles.link}
            onPress={() => Linking.openURL('https://example.com/privacy')}
          >
            <Text style={styles.linkText}>Read full Privacy Policy →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setAccepted(!accepted)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkboxBox, accepted && styles.checkboxChecked]}>
              {accepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
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
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#1B5E20' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#212121', marginBottom: 16 },
  body: { fontSize: 14, color: '#616161', lineHeight: 22, marginBottom: 16 },
  link: { marginBottom: 24 },
  linkText: { fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  checkbox: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { flex: 1, fontSize: 14, color: '#424242', lineHeight: 20 },
});