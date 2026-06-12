import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/client';
import { INDIAN_STATES, LANGUAGES } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList } from '../../navigation/types';

type Props = { navigation: NativeStackNavigationProp<MainTabParamList, 'Profile'> };

const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: `${l.label} (${l.labelEnglish})` }));

export function EditProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, refreshProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [state, setState] = useState(user?.state ?? '');
  const [district, setDistrict] = useState(user?.district ?? '');
  const [block, setBlock] = useState(user?.block ?? '');
  const [language, setLanguage] = useState(user?.languagePreference ?? 'en');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!state) errs.state = 'Please select your state';
    if (!district.trim()) errs.district = 'District is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    try {
      await userApi.updateProfile({
        name: name.trim(),
        state,
        district: district.trim(),
        block: block.trim() || undefined,
        languagePreference: language,
      });
      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update profile. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Edit Profile</Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Input
              label="Full Name"
              placeholder="Enter your full legal name"
              value={name}
              onChangeText={(t) => { setName(t); setErrors({}); }}
              error={errors.name}
              autoCapitalize="words"
            />
            <Select
              label="State"
              value={state}
              options={stateOptions}
              onChange={(v) => { setState(v); setErrors({}); }}
              error={errors.state}
            />
            <Input
              label="District"
              placeholder="Enter your district"
              value={district}
              onChangeText={(t) => { setDistrict(t); setErrors({}); }}
              error={errors.district}
            />
            <Input
              label="Block (Optional)"
              placeholder="Enter your block or mandal"
              value={block}
              onChangeText={setBlock}
            />
            <Select
              label="App Language"
              value={language}
              options={languageOptions}
              onChange={setLanguage}
            />
            <Button title="Save Changes" onPress={handleSave} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing4 },
  title: { fontSize: 26, fontWeight: '800' },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
});