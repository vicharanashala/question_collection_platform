import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import { INDIAN_STATES, LANGUAGES } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { UserCategory } from '../../types';
import { useTranslation } from 'react-i18next';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
  route: RouteProp<AuthStackParamList, 'Register'>;
};

const TOTAL_STEPS = 4;

const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: `${l.label} (${l.labelEnglish})` }));

const CATEGORY_COLORS: Record<string, string> = {
  farmer:    '#2D9A3E',
  fpo:       '#7B5EA7',
  student:   '#2563EB',
  volunteer: '#D97706',
  ngo:       '#DC2626',
};

const CATEGORIES = [
  { value: UserCategory.FARMER,     tKey: 'cat.farmer',      descKey: 'cat.farmerDesc',      icon: 'leaf' },
  { value: UserCategory.FPO,        tKey: 'cat.fpoMember',   descKey: 'cat.fpoMemberDesc',   icon: 'people' },
  { value: UserCategory.STUDENT,    tKey: 'cat.student',     descKey: 'cat.studentDesc',     icon: 'school' },
  { value: UserCategory.VOLUNTEER,  tKey: 'cat.volunteer',   descKey: 'cat.volunteerDesc',   icon: 'hand-right' },
  { value: UserCategory.NGO,        tKey: 'cat.ngoPartner',  descKey: 'cat.ngoPartnerDesc',  icon: 'business' },
];

const STEP_KEYS = ['stepCategory', 'stepLocation', 'stepDetails', 'stepLanguage'] as const;

export function RegisterScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { register } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [category, setCategory] = useState<UserCategory | ''>('');
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [language, setLanguage] = useState('hi');

  const [farmSize, setFarmSize] = useState('');
  const [cropType, setCropType] = useState('');
  const [courseName, setCourseName] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState('');

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1 && !category) errs.category = t('selectCategoryRequired');
    if (s === 2) {
      if (!state) errs.state = t('stateRequired');
      if (!district.trim()) errs.district = t('districtRequired');
    }
    if (s === 3) {
      if (!name.trim() || name.trim().length < 2) errs.name = t('nameMinLength');
      if (category === UserCategory.FARMER) {
        if (!farmSize.trim()) errs.farmSize = t('farmSizeRequired');
        if (!cropType.trim()) errs.cropType = t('cropTypeRequired');
      }
      if (category === UserCategory.STUDENT) {
        if (!courseName.trim()) errs.courseName = t('courseNameRequired');
        if (!universityName.trim()) errs.universityName = t('universityNameRequired');
      }
      if (
        (category === UserCategory.FPO || category === UserCategory.VOLUNTEER || category === UserCategory.NGO) &&
        (!organizationName.trim() || !role.trim())
      ) {
        if (!organizationName.trim()) errs.organizationName = t('organisationRequired');
        if (!role.trim()) errs.role = t('roleRequired');
      }
    }
    if (s === 4 && !language) errs.language = t('languageRequired');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() { if (validateStep(step)) setStep((s) => Math.min(s + 1, TOTAL_STEPS)); }
  function back() { if (step > 1) setStep((s) => s - 1); else navigation.goBack(); }

  async function handleSubmit() {
    if (!validateStep(4)) return;
    setLoading(true);
    const profileData: Record<string, string> = {};
    if (category === UserCategory.FARMER) { profileData.farmSize = farmSize; profileData.cropType = cropType; }
    else if (category === UserCategory.STUDENT) { profileData.courseName = courseName; profileData.universityName = universityName; }
    else { profileData.organizationName = organizationName; profileData.role = role; }

    try {
      await register({
        name: name.trim(),
        mobileNumber,
        state,
        district: district.trim(),
        block: block.trim() || undefined,
        category,
        languagePreference: language,
        consentGiven: true,
        profileData,
      });
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, t('serverError')), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Top nav row */}
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={back}>
              <Ionicons name="chevron-back" size={22} color={c.primary} />
              <Text style={[styles.backText, { color: c.primary }]}>{step === 1 ? t('back') : t(STEP_KEYS[step - 2])}</Text>
            </TouchableOpacity>

          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{t('createAccount')}</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {t('stepOf', { step, total: TOTAL_STEPS })} — {t(STEP_KEYS[step - 1])}
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {STEP_KEYS.map((key, i) => {
              const num = i + 1;
              const isActive = num === step;
              const isDone = num < step;
              return (
                <React.Fragment key={key}>
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          borderColor: isDone ? c.primary : isActive ? c.primary : c.borderSubtle,
                          backgroundColor: isDone ? c.primary : isActive ? c.primary + '18' : 'transparent',
                        },
                      ]}
                    >
                      {isDone ? (
                        <Ionicons name="checkmark" size={12} color={c.surface} />
                      ) : (
                        <Text style={[styles.stepNum, { color: isDone || isActive ? c.primary : c.textTertiary }]}>
                          {num}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        { color: isActive ? c.primary : c.textTertiary },
                        isActive && styles.stepLabelActive,
                      ]}
                    >
                      {t(key)}
                    </Text>
                  </View>
                  {i < STEP_KEYS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: isDone ? c.primary : c.borderSubtle }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            {/* Step 1: Category */}
            {step === 1 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>{t('selectCategory')}</Text>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.catCard,
                      {
                        borderColor: category === cat.value ? CATEGORY_COLORS[cat.value as string] : c.borderSubtle,
                        backgroundColor: category === cat.value ? CATEGORY_COLORS[cat.value as string] + '12' : 'transparent',
                      },
                    ]}
                    onPress={() => { setCategory(cat.value as UserCategory); setErrors({}); }}
                  >
                    <View style={[styles.catIconWrap, { backgroundColor: category === cat.value ? CATEGORY_COLORS[cat.value as string] + '18' : c.background }]}>
                      <Ionicons
                        name={cat.icon as any}
                        size={22}
                        color={category === cat.value ? CATEGORY_COLORS[cat.value as string] : c.textSecondary}
                      />
                    </View>
                    <View style={styles.catInfo}>
                      <Text style={[styles.catLabel, { color: category === cat.value ? CATEGORY_COLORS[cat.value as string] : c.text }]}>
                        {t(cat.tKey)}
                      </Text>
                      <Text style={[styles.catDesc, { color: c.textSecondary }]}>{t(cat.descKey)}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: category === cat.value ? CATEGORY_COLORS[cat.value as string] : c.borderSubtle },
                      ]}
                    >
                      {category === cat.value && (
                        <View style={[styles.radioInner, { backgroundColor: CATEGORY_COLORS[cat.value as string] }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                {errors.category && <Text style={[styles.error, { color: c.error }]}>{errors.category}</Text>}
                <Button title={t('continue')} onPress={next} disabled={!category} />
              </>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>{t('locationDetails')}</Text>
                <Select
                  label={t('state')}
                  placeholder={t('selectState')}
                  value={state}
                  options={stateOptions}
                  onChange={(v) => { setState(v); setErrors({}); }}
                  error={errors.state}
                  searchable
                />
                <Input
                  label={t('district')}
                  placeholder={t('districtPlaceholder')}
                  value={district}
                  onChangeText={(txt) => { setDistrict(txt); setErrors({}); }}
                  error={errors.district}
                />
                <Input
                  label={t('blockOptional')}
                  placeholder={t('blockPlaceholder')}
                  value={block}
                  onChangeText={setBlock}
                />
                <Button title={t('continue')} onPress={next} />
              </>
            )}

            {/* Step 3: Details (includes name + category-specific fields) */}
            {step === 3 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>{t('additionalDetails')}</Text>
                <Input
                  label={t('fullName')}
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChangeText={(txt) => { setName(txt); setErrors({}); }}
                  error={errors.name}
                  autoCapitalize="words"
                />
                {category === UserCategory.FARMER && (
                  <>
                    <Input
                      label={t('farmSize')}
                      placeholder={t('farmSizePlaceholder')}
                      value={farmSize}
                      onChangeText={(txt) => { setFarmSize(txt); setErrors({}); }}
                      error={errors.farmSize}
                    />
                    <Input
                      label={t('primaryCropType')}
                      placeholder={t('cropTypePlaceholder')}
                      value={cropType}
                      onChangeText={(txt) => { setCropType(txt); setErrors({}); }}
                      error={errors.cropType}
                    />
                  </>
                )}
                {category === UserCategory.STUDENT && (
                  <>
                    <Input
                      label={t('courseName')}
                      placeholder={t('courseNamePlaceholder')}
                      value={courseName}
                      onChangeText={(txt) => { setCourseName(txt); setErrors({}); }}
                      error={errors.courseName}
                    />
                    <Input
                      label={t('university')}
                      placeholder={t('universityNamePlaceholder')}
                      value={universityName}
                      onChangeText={(txt) => { setUniversityName(txt); setErrors({}); }}
                      error={errors.universityName}
                    />
                  </>
                )}
                {(category === UserCategory.FPO || category === UserCategory.VOLUNTEER || category === UserCategory.NGO) && (
                  <>
                    <Input
                      label={t('organisationName')}
                      placeholder={t('organisationNamePlaceholder')}
                      value={organizationName}
                      onChangeText={(txt) => { setOrganizationName(txt); setErrors({}); }}
                      error={errors.organizationName}
                    />
                    <Input
                      label={t('yourRole')}
                      placeholder={t('rolePlaceholder')}
                      value={role}
                      onChangeText={(txt) => { setRole(txt); setErrors({}); }}
                      error={errors.role}
                    />
                  </>
                )}
                <Button title={t('continue')} onPress={next} />
              </>
            )}

            {/* Step 4: Language */}
            {step === 4 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>{t('profileLanguage')}</Text>
                <Text style={[styles.sectionSubtitle, { color: c.textSecondary }]}>
                  {t('profileLanguageDesc')}
                </Text>
                <Select
                  label={t('language')}
                  placeholder={t('searchLanguage')}
                  value={language}
                  options={languageOptions}
                  onChange={(v) => { setLanguage(v); setErrors({}); }}
                  error={errors.language}
                  searchable
                />
                <Button title={t('completeRegistration')} onPress={handleSubmit} loading={loading} />
              </>
            )}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  backText: { fontSize: 15, fontWeight: '600', marginLeft: 2 },
  header: { marginBottom: tokens.spacing5 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing6,
    flexWrap: 'wrap',
  },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: tokens.radiusFull,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 10, marginTop: 3, textAlign: 'center' },
  stepLabelActive: { fontWeight: '700' },
  stepLine: { height: 2, width: 24, marginHorizontal: 2, marginBottom: 16 },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: tokens.spacing2 },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: -tokens.spacing2,
    marginBottom: tokens.spacing4,
    lineHeight: 18,
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing4,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
    marginBottom: tokens.spacing3,
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing3,
  },
  catInfo: { flex: 1 },
  catLabel: { fontSize: 15, fontWeight: '600' },
  catDesc: { fontSize: 12, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: tokens.radiusFull,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: tokens.radiusFull },
  error: { fontSize: 12, marginBottom: tokens.spacing3, letterSpacing: 0.01 * 12 },
});