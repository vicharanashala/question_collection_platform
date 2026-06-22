import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { userApi, lgdApi } from '../../api/client';
import { LANGUAGES, CROP_OPTIONS, COURSE_OPTIONS } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { UserCategory, UserRole } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const PRIVILEGED_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR];

// ─── FieldGroup ───────────────────────────────────────────────────────────────
function FieldGroup({ icon, label, children, accentColor }: { icon: string; label: string; children: React.ReactNode; accentColor: string }) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldGroupHeader}>
        <Ionicons name={icon as any} size={13} color={accentColor} />
        <Text style={[styles.fieldGroupLabel, { color: accentColor }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

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

  const isPrivileged = PRIVILEGED_ROLES.includes(user?.role as UserRole);

  const profileData = (user as any)?.profileData ?? {};

  const [name, setName] = useState(user?.name ?? '');
  const [selectedState, setSelectedState] = useState(user?.state ?? '');
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState(user?.district ?? '');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [block, setBlock] = useState(user?.block ?? '');
  const [language, setLanguage] = useState(user?.languagePreference ?? 'en');

  // LGD reference data
  const [stateList, setStateList] = useState<{ code: string; name: string }[]>([]);
  const [districtList, setDistrictList] = useState<{ code: string; name: string }[]>([]);
  const [blockList, setBlockList] = useState<{ code: string; name: string }[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Load all states; once loaded, hydrate districts for the existing user state
  useEffect(() => {
    setLoadingStates(true);
    lgdApi.getStates()
      .then((res) => {
        setStateList(res.data.states);
        // If user already has a state, find its code and pre-load districts
        if (user?.state) {
          const match = res.data.states.find((s) => s.name === user.state);
          if (match) {
            setSelectedStateCode(match.code);
            return lgdApi.getDistricts(match.code);
          }
        }
        return null;
      })
      .then((res) => {
        if (!res) return;
        setDistrictList(res.data.districts);
        if (user?.district) {
          const dm = res.data.districts.find((d: any) => d.name === user.district);
          if (dm) {
            setSelectedDistrictCode(dm.code);
            return lgdApi.getSubDistricts(dm.code);
          }
        }
        return null;
      })
      .then((res) => {
        if (!res) return;
        setBlockList(res.data.subdistricts);
      })
      .catch(() => {})
      .finally(() => setLoadingStates(false));
  }, []);
  // Category-specific — only used for non-privileged roles
  const [farmSize, setFarmSize] = useState(profileData?.farmSize ?? '');
  const [primaryCrop, setPrimaryCrop] = useState(profileData?.cropType ?? '');
  const [courseName, setCourseName] = useState(profileData?.courseName ?? '');
  const [courseNameOther, setCourseNameOther] = useState('');
  const [universityName, setUniversityName] = useState(profileData?.universityName ?? '');
  const [organisationName, setOrganisationName] = useState(profileData?.organisationName ?? '');
  const [memberRole, setMemberRole] = useState(profileData?.memberRole ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNameChange = useCallback((text: string) => setName(text), []);
  const handleFarmSizeChange = useCallback((text: string) => setFarmSize(text), []);
  const handlePrimaryCropChange = useCallback((text: string) => setPrimaryCrop(text), []);
  const handleUniversityNameChange = useCallback((text: string) => setUniversityName(text), []);
  const handleOrganisationNameChange = useCallback((text: string) => setOrganisationName(text), []);
  const handleMemberRoleChange = useCallback((text: string) => setMemberRole(text), []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = t('editProfile.nameMinChars');
    if (!selectedState) errs.state = t('editProfile.selectState');
    if (!selectedDistrict.trim()) errs.district = t('editProfile.districtRequired');

    // Category-specific validation — skipped for privileged roles (category is null for them)
    if (!isPrivileged && user?.category === UserCategory.STUDENT) {
      if (!courseName) errs.courseName = t('editProfile.courseNameRequired');
      else if (courseName === '__other__' && !courseNameOther.trim()) errs.courseNameOther = t('courseNameOtherRequired');
      if (!universityName.trim()) errs.universityName = t('editProfile.universityNameRequired');
    }
    if (!isPrivileged && user?.category === UserCategory.VOLUNTEER) {
      if (!organisationName.trim()) errs.organisationName = t('editProfile.organisationNameRequired');
      if (!memberRole.trim()) errs.role = t('editProfile.roleRequired');
    }
    if (!isPrivileged && user?.category === UserCategory.NGO) {
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
        state: selectedState,
        district: selectedDistrict.trim(),
        block: block.trim() || undefined,
        languagePreference: language,
      };

      // Category-specific fields — only for non-privileged users
      if (!isPrivileged) {
        if (user?.category === UserCategory.FARMER || user?.category === UserCategory.FPO) {
          if (farmSize.trim()) payload.farmSize = farmSize.trim();
          if (primaryCrop.trim()) payload.cropType = primaryCrop.trim();
        } else if (user?.category === UserCategory.STUDENT) {
          payload.courseName = courseName === '__other__' ? courseNameOther.trim() : courseName;
          payload.universityName = universityName.trim();
        } else if (user?.category === UserCategory.VOLUNTEER || user?.category === UserCategory.NGO) {
          payload.organisationName = organisationName.trim();
          payload.memberRole = memberRole.trim();
        }
        // else: category is null or unknown — send nothing extra
      }
      await userApi.updateProfile(payload);
      await refreshProfile();
      showToast(t('editProfile.saveSuccess'), 'success');
      navigation.goBack();
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      const msg = getErrorMessage(err, t('editProfile.saveFailed'));
      showToast(msg, 'error');
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[styles.title, { color: c.text }]}>{t('editProfile.title')}</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {isPrivileged
                ? 'Update your admin profile'
                : t('editProfile.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <FieldGroup icon="person-outline" label={t('editProfile.personalInfo')} accentColor={c.primary}>
              <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                <Input
                  label={t('editProfile.fullName')}
                  placeholder={t('editProfile.fullNamePlaceholder')}
                  value={name}
                  onChangeText={handleNameChange}
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

            <FieldGroup icon="location-outline" label={t('editProfile.locationSection')} accentColor={c.primary}>
              <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                <Select
                  label={t('question.state')}
                  value={selectedState}
                  options={stateList.map((s) => ({ value: s.name, label: s.name }))}
                  onChange={async (v) => {
                    setSelectedState(v);
                    setSelectedStateCode(stateList.find((s) => s.name === v)?.code ?? '');
                    setSelectedDistrict('');
                    setSelectedDistrictCode('');
                    setBlockList([]);
                    setBlock('');
                    setErrors({});
                    setLoadingDistricts(true);
                    try {
                      const code = stateList.find((s) => s.name === v)?.code ?? '';
                      const res = await lgdApi.getDistricts(code);
                      setDistrictList(res.data.districts);
                    } catch { setDistrictList([]); }
                    finally { setLoadingDistricts(false); }
                  }}
                  error={errors.state}
                  searchable
                  loading={loadingStates}
                />
                <Select
                  label={t('question.district')}
                  placeholder={t('selectDistrict')}
                  value={selectedDistrict}
                  options={districtList.map((d) => ({ value: d.name, label: d.name }))}
                  onChange={async (v) => {
                    setSelectedDistrict(v);
                    setSelectedDistrictCode(districtList.find((d) => d.name === v)?.code ?? '');
                    setBlockList([]);
                    setBlock('');
                    setErrors({});
                    const code = districtList.find((d) => d.name === v)?.code ?? '';
                    if (!code) return;
                    setLoadingBlocks(true);
                    try {
                      const res = await lgdApi.getSubDistricts(code);
                      setBlockList(res.data.subdistricts);
                    } catch { setBlockList([]); }
                    finally { setLoadingBlocks(false); }
                  }}
                  error={errors.district}
                  searchable
                  loading={loadingDistricts}
                />
                <Select
                  label={t('question.blockOptional')}
                  placeholder={t('selectBlock')}
                  value={block}
                  options={blockList.map((b) => ({ value: b.name, label: b.name }))}
                  onChange={setBlock}
                  searchable
                  loading={loadingBlocks}
                />
              </View>
            </FieldGroup>

            {/* Category-specific fields — hidden for admin/curator/super_admin */}
            {!isPrivileged && (user?.category === UserCategory.FARMER || user?.category === UserCategory.FPO) && (
              <FieldGroup icon="leaf-outline" label={t('editProfile.farmerDetails')} accentColor={c.primary}>
                <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                  <Input
                    label={t('editProfile.farmSize')}
                    placeholder={t('editProfile.farmSizePlaceholder')}
                    value={farmSize}
                    onChangeText={handleFarmSizeChange}
                    error={undefined}
                  />
                  <Select
                    label={t('editProfile.primaryCrop')}
                    placeholder={t('editProfile.primaryCropPlaceholder')}
                    value={primaryCrop}
                    options={CROP_OPTIONS}
                    onChange={(v) => { setPrimaryCrop(v); setErrors({}); }}
                    searchable
                  />
                  <Button
                    title="Manage My Crops"
                    variant="secondary"
                    onPress={() => navigation.navigate('CropManagement')}
                    style={styles.manageCropsButton}
                  />
                </View>
              </FieldGroup>
            )}

            {!isPrivileged && user?.category === UserCategory.STUDENT && (
              <FieldGroup icon="school-outline" label={t('editProfile.studentDetails')} accentColor={c.primary}>
                <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                  <Select
                    label={t('editProfile.courseName')}
                    placeholder={t('editProfile.courseNamePlaceholder')}
                    value={courseName}
                    options={COURSE_OPTIONS}
                    onChange={(v) => { setCourseName(v); setErrors({}); }}
                    error={errors.courseName}
                    searchable
                  />
                  {courseName === '__other__' && (
                    <Input
                      label={t('courseNameOther')}
                      placeholder={t('courseNameOtherPlaceholder')}
                      value={courseNameOther}
                      onChangeText={(txt) => { setCourseNameOther(txt); setErrors({}); }}
                      error={errors.courseNameOther}
                    />
                  )}
                  <Input
                    label={t('editProfile.universityName')}
                    placeholder={t('editProfile.universityNamePlaceholder')}
                    value={universityName}
                    onChangeText={handleUniversityNameChange}
                    error={errors.universityName}
                  />
                </View>
              </FieldGroup>
            )}

            {!isPrivileged && [UserCategory.VOLUNTEER, UserCategory.NGO].includes(user?.category as UserCategory) && (
              <FieldGroup icon="business-outline" label={t('editProfile.organisationDetails')} accentColor={c.primary}>
                <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                  <Input
                    label={t('editProfile.organisationName')}
                    placeholder={t('editProfile.organisationNamePlaceholder')}
                    value={organisationName}
                    onChangeText={handleOrganisationNameChange}
                    error={errors.organisationName}
                  />
                  <Input
                    label={t('editProfile.role')}
                    placeholder={t('editProfile.rolePlaceholder')}
                    value={memberRole}
                    onChangeText={handleMemberRoleChange}
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
  manageCropsButton: {
    marginTop: tokens.spacing2,
  },
});