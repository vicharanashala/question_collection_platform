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
import { UserCategory } from '../../types';

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
  // Category-specific
  const [farmSize, setFarmSize] = useState((user as any)?.farmSize ?? '');
  const [primaryCrop, setPrimaryCrop] = useState((user as any)?.cropType ?? '');
  const [courseName, setCourseName] = useState((user as any)?.courseName ?? '');
  const [universityName, setUniversityName] = useState((user as any)?.universityName ?? '');
  const [organisationName, setOrganisationName] = useState((user as any)?.organisationName ?? '');
  const [memberRole, setMemberRole] = useState((user as any)?.memberRole ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = t('editProfile.nameMinChars');
    if (!state) errs.state = t('editProfile.selectState');
    if (!district.trim()) errs.district = t('editProfile.districtRequired');
    // farmSize is optional — no validation required
    if (user?.category === UserCategory.STUDENT) {
      if (!courseName.trim()) errs.courseName = t('editProfile.courseNameRequired');
      if (!universityName.trim()) errs.universityName = t('editProfile.universityNameRequired');
    }
    if ([UserCategory.VOLUNTEER, UserCategory.NGO].includes(user?.category as UserCategory)) {
      if (!organisationName.trim()) errs.organisationName = t('editProfile.organisationNameRequired');
      if (!memberRole.trim()) errs.role = t('editProfile.roleRequired');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        state,
        district: district.trim(),
        block: block.trim() || undefined,
        languagePreference: language,
      };
      if (user?.category === UserCategory.FARMER || user?.category === UserCategory.FPO) {
        if (farmSize.trim()) payload.farmSize = farmSize.trim();
        if (primaryCrop.trim()) payload.cropType = primaryCrop.trim();
      } else if (user?.category === UserCategory.STUDENT) {
        payload.courseName = courseName.trim();
        payload.universityName = universityName.trim();
      } else {
        payload.organisationName = organisationName.trim();
        payload.memberRole = memberRole.trim();
      }
      await userApi.updateProfile(payload);
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
                  onChangeText={setName}
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
                  onChangeText={setDistrict}
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

            {/* Category-specific fields */}
            {(user?.category === UserCategory.FARMER || user?.category === UserCategory.FPO) && (
              <FieldGroup icon="leaf-outline" label={t('editProfile.farmerDetails')}>
                <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                  <Input
                    label={t('editProfile.farmSize')}
                    placeholder={t('editProfile.farmSizePlaceholder')}
                    value={farmSize}
                    onChangeText={setFarmSize}
                    error={undefined}
                  />
                  <Input
                    label={t('editProfile.primaryCrop')}
                    placeholder={t('editProfile.primaryCropPlaceholder')}
                    value={primaryCrop}
                    onChangeText={setPrimaryCrop}
                  />
                </View>
              </FieldGroup>
            )}

            {user?.category === UserCategory.STUDENT && (
              <FieldGroup icon="school-outline" label={t('editProfile.studentDetails')}>
                <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                  <Input
                    label={t('editProfile.courseName')}
                    placeholder={t('editProfile.courseNamePlaceholder')}
                    value={courseName}
                    onChangeText={setCourseName}
                    error={errors.courseName}
                  />
                  <Input
                    label={t('editProfile.universityName')}
                    placeholder={t('editProfile.universityNamePlaceholder')}
                    value={universityName}
                    onChangeText={setUniversityName}
                    error={errors.universityName}
                  />
                </View>
              </FieldGroup>
            )}

            {[UserCategory.VOLUNTEER, UserCategory.NGO].includes(user?.category as UserCategory) && (
              <FieldGroup icon="business-outline" label={t('editProfile.organisationDetails')}>
                <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                  <Input
                    label={t('editProfile.organisationName')}
                    placeholder={t('editProfile.organisationNamePlaceholder')}
                    value={organisationName}
                    onChangeText={setOrganisationName}
                    error={errors.organisationName}
                  />
                  <Input
                    label={t('editProfile.role')}
                    placeholder={t('editProfile.rolePlaceholder')}
                    value={memberRole}
                    onChangeText={setMemberRole}
                    error={errors.role}
                  />
                </View>
              </FieldGroup>
            )}

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