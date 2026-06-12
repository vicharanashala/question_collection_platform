import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'LoginPhone'> };

export function LoginPhoneScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validMobile = /^[6-9]\d{9}$/.test(mobile);

  async function handleRequestOtp() {
    if (!validMobile) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(`+91${mobile}`);
      navigation.navigate('Otp', { mobileNumber: `+91${mobile}` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>🌾</Text>
            <Text style={styles.title}>AgriQuestion</Text>
            <Text style={styles.subtitle}>
              Empowering farmers with AI-driven{'\n'}agricultural knowledge
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardDesc}>
              Enter your mobile number to receive a verification code
            </Text>

            <Input
              label="Mobile Number"
              placeholder="Enter 10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={(text) => { setMobile(text.replace(/\D/g, '')); setError(''); }}
              error={error}
              leftIcon={<Text style={styles.phoneCode}>+91</Text>}
            />

            <Button
              title="Send OTP"
              onPress={handleRequestOtp}
              disabled={!validMobile}
              loading={loading}
            />

            <Text style={styles.disclaimer}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#1B5E20' },
  subtitle: { fontSize: 14, color: '#558B2F', textAlign: 'center', marginTop: 8, lineHeight: 20 },
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
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#212121', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#757575', marginBottom: 24, lineHeight: 20 },
  phoneCode: { fontSize: 16, fontWeight: '600', color: '#2E7D32' },
  disclaimer: { fontSize: 11, color: '#9E9E9E', textAlign: 'center', marginTop: 16, lineHeight: 16 },
});