import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/client';
import { INDIAN_STATES, LANGUAGES } from '../../utils/constants';
import { tokens } from '../../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const languageOptions = LANGUAGES.map((l) => ({
  value: l.code,
  label: `${l.label} (${l.labelEnglish})`,
}));

export function EditProfileScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [name, setName] = useState(user?.name ?? '');
  const [state, setState] = useState(user?.state ?? '');
  const [district, setDistrict] = useState(user?.district ?? '');
  const [block, setBlock] = useState(user?.block ?? '');
  const [language, setLanguage] = useState(user?.languagePreference ?? 'en');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = t('editProfile.nameMinChars');
    if (!state) errs.state = t('editProfile.selectState');
    if (!district.trim()) errs.district = t('editProfile.districtRequired');
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
      showToast(t('editProfile.saveSuccess'), 'success');
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      const msg = getErrorMessage(err, t('editProfile.saveFailed'));
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  function FieldGroup({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
    return (
      <View style={styles.fieldGroup}>
        <View style={styles.fieldGroupHeader}>
          <Ionicons name={icon as any} size={13} color={c.primary} />
          <Text style={[styles.fieldGroupLabel, { color: c.textSecondary }]}>{label}</Text>
        </View>
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[styles.title, { color: c.text }]}>{t('editProfile.title')}</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {t('editProfile.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <FieldGroup icon="person-outline" label={t('editProfile.personalInfo')}>
              <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                <Input
                  label={t('editProfile.fullName')}
                  placeholder={t('editProfile.fullNamePlaceholder')}
                  value={name}
                  onChangeText={(t) => { setName(t); setErrors({}); }}
                  error={errors.name}
                  autoCapitalize="words"
                />
                <Select
                  label={t('editProfile.preferredLanguage')}
                  value={language}
                  options={languageOptions}
                  onChange={setLanguage}
                />
              </View>
            </FieldGroup>

            <FieldGroup icon="location-outline" label={t('editProfile.locationSection')}>
              <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                <Select
                  label={t('question.state')}
                  value={state}
                  options={stateOptions}
                  onChange={(v) => { setState(v); setErrors({}); }}
                  error={errors.state}
                />
                <Input
                  label={t('question.district')}
                  placeholder={t('editProfile.districtPlaceholder')}
                  value={district}
                  onChangeText={(t) => { setDistrict(t); setErrors({}); }}
                  error={errors.district}
                />
                <Input
                  label={t('question.blockOptional')}
                  placeholder={t('question.blockPlaceholder')}
                  value={block}
                  onChangeText={setBlock}
                />
              </View>
            </FieldGroup>

            <Button
              title={t('editProfile.saveChanges')}
              onPress={handleSave}
              loading={loading}
              style={styles.saveButton}
            />
            <Button
              title={t('editProfile.cancel')}
              variant="ghost"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: tokens.spacing8 },
  header: {
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing5,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: '800', marginBottom: tokens.spacing1 },
  subtitle: { fontSize: 13 },
  form: {
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing5,
  },
  fieldGroup: {
    marginBottom: tokens.spacing5,
  },
  fieldGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing3,
  },
  fieldGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: { borderRadius: tokens.radiusLg, padding: tokens.spacing4 },
  saveButton: {
    marginTop: tokens.spacing2,
  },
  cancelButton: {
    marginTop: tokens.spacing2,
    marginBottom: tokens.spacing4,
  },
});