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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
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
const languageOptions = LANGUAGES.map((l) => ({
  value: l.code,
  label: `${l.label} (${l.labelEnglish})`,
}));

const CATEGORIES = [
  {
    value: UserCategory.FARMER,
    tKey: 'cat.farmer',
    descKey: 'cat.farmerDesc',
    icon: 'leaf-outline',
    color: '#16A34A',
  },
  {
    value: UserCategory.FPO,
    tKey: 'cat.fpoMember',
    descKey: 'cat.fpoMemberDesc',
    icon: 'people-outline',
    color: '#2563EB',
  },
  {
    value: UserCategory.STUDENT,
    tKey: 'cat.student',
    descKey: 'cat.studentDesc',
    icon: 'school-outline',
    color: '#7C3AED',
  },
  {
    value: UserCategory.VOLUNTEER,
    tKey: 'cat.volunteer',
    descKey: 'cat.volunteerDesc',
    icon: 'hand-right-outline',
    color: '#D97706',
  },
  {
    value: UserCategory.NGO,
    tKey: 'cat.ngoPartner',
    descKey: 'cat.ngoPartnerDesc',
    icon: 'business-outline',
    color: '#0891B2',
  },
];

const STEP_KEYS = ['stepCategory', 'stepLocation', 'stepDetails', 'stepLanguage'] as const;

export function RegisterScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { register } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [langModalVisible, setLangModalVisible] = useState(false);

  const [category, setCategory] = useState<UserCategory | ''>('');
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [language, setLanguage] = useState('en');

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
      if (!name.trim() || name.trim().length < 2) errs.name = t('nameMinLength');
      if (!state) errs.state = t('stateRequired');
      if (!district.trim()) errs.district = t('districtRequired');
    }
    if (s === 3) {
      if (category === UserCategory.FARMER) {
        if (!farmSize.trim()) errs.farmSize = t('farmSizeRequired');
        if (!cropType.trim()) errs.cropType = t('cropTypeRequired');
      }
      if (category === UserCategory.STUDENT) {
        if (!courseName.trim()) errs.courseName = t('courseNameRequired');
        if (!universityName.trim()) errs.universityName = t('universityNameRequired');
      }
      if (
        (category === UserCategory.FPO ||
          category === UserCategory.VOLUNTEER ||
          category === UserCategory.NGO) &&
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

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }
  function back() {
    if (step > 1) setStep((s) => s - 1);
    else navigation.goBack();
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;
    setLoading(true);
    const profileData: Record<string, string> = {};
    if (category === UserCategory.FARMER) {
      profileData.farmSize = farmSize;
      profileData.cropType = cropType;
    } else if (category === UserCategory.STUDENT) {
      profileData.courseName = courseName;
      profileData.universityName = universityName;
    } else {
      profileData.organizationName = organizationName;
      profileData.role = role;
    }

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

  const langLabel = i18n.language === 'en' ? 'English'
    : i18n.language === 'hi' ? 'हिन्दी'
    : i18n.language === 'kn' ? 'ಕನ್ನಡ'
    : i18n.language === 'ta' ? 'தமிழ்'
    : i18n.language === 'te' ? 'తెలుగు'
    : i18n.language === 'bn' ? 'বাংলা'
    : i18n.language === 'mr' ? 'मराठी'
    : i18n.language === 'gu' ? 'ગુજરાતી'
    : i18n.language === 'pa' ? 'ਪੰਜਾਬੀ'
    : i18n.language === 'or' ? 'ଓଡ଼ିଆ'
    : i18n.language === 'ml' ? 'മലയാളം'
    : i18n.language;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Ionicons name="arrow-back" size={22} color={c.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, { borderColor: c.border }]}
          onPress={() => setLangModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={15} color={c.primary} />
          <Text style={[styles.langBtnText, { color: c.primary }]} numberOfLines={1}>
            {langLabel}
          </Text>
          <Ionicons name="chevron-down" size={13} color={c.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
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
                          backgroundColor: isDone ? c.primary : isActive ? c.primary + '15' : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepNum,
                          { color: isDone ? c.primaryForeground : isActive ? c.primary : c.textTertiary },
                        ]}
                      >
                        {isDone ? '✓' : num}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        { color: isActive ? c.primary : c.textTertiary },
                        isActive && styles.stepLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {t(key)}
                    </Text>
                  </View>
                  {i < STEP_KEYS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: isDone ? c.primary : c.borderSubtle },
                      ]}
                    />
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
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.catCard,
                        {
                          borderColor: isSelected ? cat.color : c.borderSubtle,
                          backgroundColor: isSelected ? cat.color + '12' : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        setCategory(cat.value as UserCategory);
                        setErrors({});
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.catIconWrap,
                          { backgroundColor: cat.color + '18' },
                        ]}
                      >
                        <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                      </View>
                      <View style={styles.catInfo}>
                        <Text
                          style={[
                            styles.catLabel,
                            { color: isSelected ? cat.color : c.text },
                          ]}
                        >
                          {t(cat.tKey)}
                        </Text>
                        <Text style={[styles.catDesc, { color: c.textSecondary }]}>
                          {t(cat.descKey)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          { borderColor: isSelected ? cat.color : c.borderSubtle },
                        ]}
                      >
                        {isSelected && (
                          <View
                            style={[styles.radioInner, { backgroundColor: cat.color }]}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {errors.category && (
                  <Text style={[styles.error, { color: c.error }]}>{errors.category}</Text>
                )}
                <Button title={t('continue')} onPress={next} disabled={!category} />
              </>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>{t('locationDetails')}</Text>
                <Input
                  label={t('fullName')}
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChangeText={(txt) => {
                    setName(txt);
                    setErrors({});
                  }}
                  error={errors.name}
                  autoCapitalize="words"
                />
                <Select
                  label={t('state')}
                  placeholder={t('statePlaceholder')}
                  value={state}
                  options={stateOptions}
                  onChange={(v) => {
                    setState(v);
                    setErrors({});
                  }}
                  error={errors.state}
                  searchable
                />
                <Input
                  label={t('district')}
                  placeholder={t('districtPlaceholder')}
                  value={district}
                  onChangeText={(txt) => {
                    setDistrict(txt);
                    setErrors({});
                  }}
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

            {/* Step 3: Category Details */}
            {step === 3 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>{t('additionalDetails')}</Text>
                {category === UserCategory.FARMER && (
                  <>
                    <Input
                      label={t('farmSize')}
                      placeholder={t('farmSizePlaceholder')}
                      value={farmSize}
                      onChangeText={(txt) => {
                        setFarmSize(txt);
                        setErrors({});
                      }}
                      error={errors.farmSize}
                    />
                    <Input
                      label={t('primaryCropType')}
                      placeholder={t('cropTypePlaceholder')}
                      value={cropType}
                      onChangeText={(txt) => {
                        setCropType(txt);
                        setErrors({});
                      }}
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
                      onChangeText={(txt) => {
                        setCourseName(txt);
                        setErrors({});
                      }}
                      error={errors.courseName}
                    />
                    <Input
                      label={t('university')}
                      placeholder={t('universityNamePlaceholder')}
                      value={universityName}
                      onChangeText={(txt) => {
                        setUniversityName(txt);
                        setErrors({});
                      }}
                      error={errors.universityName}
                    />
                  </>
                )}
                {(category === UserCategory.FPO ||
                  category === UserCategory.VOLUNTEER ||
                  category === UserCategory.NGO) && (
                  <>
                    <Input
                      label={t('organisationName')}
                      placeholder={t('organisationNamePlaceholder')}
                      value={organizationName}
                      onChangeText={(txt) => {
                        setOrganizationName(txt);
                        setErrors({});
                      }}
                      error={errors.organizationName}
                    />
                    <Input
                      label={t('yourRole')}
                      placeholder={t('rolePlaceholder')}
                      value={role}
                      onChangeText={(txt) => {
                        setRole(txt);
                        setErrors({});
                      }}
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
                  onChange={(v) => {
                    setLanguage(v);
                    setErrors({});
                  }}
                  error={errors.language}
                  searchable
                />
                <Button
                  title={t('completeRegistration')}
                  onPress={handleSubmit}
                  loading={loading}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LanguageSwitcher
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing2,
  },
  backBtn: { padding: tokens.spacing2 },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: 6,
    maxWidth: 110,
  },
  langBtnText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  scroll: { flexGrow: 1, padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing6 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing6,
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
  stepLabel: { fontSize: 10, marginTop: 3, maxWidth: 52 },
  stepLabelActive: { fontWeight: '700' },
  stepLine: { height: 2, width: 20, marginHorizontal: 2, marginBottom: 16 },
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: tokens.spacing2 },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: -tokens.spacing1,
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
    width: 42,
    height: 42,
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
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: tokens.radiusFull,
  },
  error: { fontSize: 12, marginBottom: tokens.spacing3 },
});