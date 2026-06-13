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

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
  route: RouteProp<AuthStackParamList, 'Register'>;
};

const TOTAL_STEPS = 4;

const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: `${l.label} (${l.labelEnglish})` }));

const CATEGORIES = [
  { value: UserCategory.FARMER, label: 'Farmer', icon: '🌾', description: 'Cultivator or landowner' },
  { value: UserCategory.FPO, label: 'FPO Member', icon: '🤝', description: 'Farmer Producer Organisation' },
  { value: UserCategory.STUDENT, label: 'Student', icon: '🎓', description: 'Agriculture / allied sciences student' },
  { value: UserCategory.VOLUNTEER, label: 'Volunteer', icon: '🙋', description: 'Field volunteer or extension worker' },
  { value: UserCategory.NGO, label: 'NGO Partner', icon: '🏢', description: 'Non-governmental organisation' },
];

export function RegisterScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { register } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form fields
  const [category, setCategory] = useState<UserCategory | ''>('');
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [language, setLanguage] = useState('hi');

  // Category-specific
  const [farmSize, setFarmSize] = useState('');
  const [cropType, setCropType] = useState('');
  const [courseName, setCourseName] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState('');

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1 && !category) errs.category = 'Please select a category to continue';
    if (s === 2) {
      if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
      if (!state) errs.state = 'Please select your state';
      if (!district.trim()) errs.district = 'District is required';
    }
    if (s === 3) {
      if (category === UserCategory.FARMER && (!farmSize.trim() || !cropType.trim())) {
        if (!farmSize.trim()) errs.farmSize = 'Farm size is required';
        if (!cropType.trim()) errs.cropType = 'Crop type is required';
      }
      if (category === UserCategory.STUDENT && (!courseName.trim() || !universityName.trim())) {
        if (!courseName.trim()) errs.courseName = 'Course name is required';
        if (!universityName.trim()) errs.universityName = 'University name is required';
      }
      if (
        (category === UserCategory.FPO || category === UserCategory.VOLUNTEER || category === UserCategory.NGO) &&
        (!organizationName.trim() || !role.trim())
      ) {
        if (!organizationName.trim()) errs.organizationName = 'Organisation name is required';
        if (!role.trim()) errs.role = 'Your role is required';
      }
    }
    if (s === 4 && !language) errs.language = 'Please select a language';
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
      const msg = getErrorMessage(err, 'Registration failed. Please try again.');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['Category', 'Location', 'Details', 'Language'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={back}>
            <Text style={[styles.backText, { color: c.primary }]}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}
            </Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {stepLabels.map((label, i) => {
              const num = i + 1;
              const isActive = num === step;
              const isDone = num < step;
              return (
                <React.Fragment key={label}>
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        { borderColor: isDone ? c.primary : isActive ? c.primary : c.borderSubtle },
                        isDone && { backgroundColor: c.primary },
                        isActive && { backgroundColor: c.primary + '18', borderColor: c.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepNum,
                          { color: isDone || isActive ? c.primary : c.textTertiary },
                        ]}
                      >
                        {isDone ? '✓' : num}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        { color: isActive ? c.primary : c.textTertiary },
                        isActive && { fontWeight: '700' },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                  {i < stepLabels.length - 1 && (
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
                <Text style={[styles.sectionTitle, { color: c.text }]}>Select Your Category</Text>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.catCard,
                      {
                        borderColor: category === cat.value ? c.primary : c.borderSubtle,
                        backgroundColor: category === cat.value ? c.primary + '10' : 'transparent',
                      },
                    ]}
                    onPress={() => { setCategory(cat.value as UserCategory); setErrors({}); }}
                  >
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <View style={styles.catInfo}>
                      <Text
                        style={[
                          styles.catLabel,
                          { color: category === cat.value ? c.primary : c.text },
                        ]}
                      >
                        {cat.label}
                      </Text>
                      <Text style={[styles.catDesc, { color: c.textSecondary }]}>{cat.description}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: category === cat.value ? c.primary : c.borderSubtle },
                      ]}
                    >
                      {category === cat.value && (
                        <View style={[styles.radioInner, { backgroundColor: c.primary }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                {errors.category && <Text style={[styles.error, { color: c.error }]}>{errors.category}</Text>}
                <Button title="Continue" onPress={next} disabled={!category} />
              </>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Location Details</Text>
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
                  placeholder="Search your state"
                  value={state}
                  options={stateOptions}
                  onChange={(v) => { setState(v); setErrors({}); }}
                  error={errors.state}
                  searchable
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
                <Button title="Continue" onPress={next} />
              </>
            )}

            {/* Step 3: Category Details */}
            {step === 3 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Additional Details</Text>
                {category === UserCategory.FARMER && (
                  <>
                    <Input
                      label="Farm Size"
                      placeholder="e.g., 2.5 acres"
                      value={farmSize}
                      onChangeText={(t) => { setFarmSize(t); setErrors({}); }}
                      error={errors.farmSize}
                    />
                    <Input
                      label="Primary Crop Type"
                      placeholder="e.g., Rice, Wheat, Cotton"
                      value={cropType}
                      onChangeText={(t) => { setCropType(t); setErrors({}); }}
                      error={errors.cropType}
                    />
                  </>
                )}
                {category === UserCategory.STUDENT && (
                  <>
                    <Input
                      label="Course Name"
                      placeholder="e.g., B.Sc. Agriculture"
                      value={courseName}
                      onChangeText={(t) => { setCourseName(t); setErrors({}); }}
                      error={errors.courseName}
                    />
                    <Input
                      label="University / College"
                      placeholder="Enter your university name"
                      value={universityName}
                      onChangeText={(t) => { setUniversityName(t); setErrors({}); }}
                      error={errors.universityName}
                    />
                  </>
                )}
                {(category === UserCategory.FPO || category === UserCategory.VOLUNTEER || category === UserCategory.NGO) && (
                  <>
                    <Input
                      label="Organisation Name"
                      placeholder="Enter organisation name"
                      value={organizationName}
                      onChangeText={(t) => { setOrganizationName(t); setErrors({}); }}
                      error={errors.organizationName}
                    />
                    <Input
                      label="Your Role"
                      placeholder="e.g., Coordinator, Field Officer"
                      value={role}
                      onChangeText={(t) => { setRole(t); setErrors({}); }}
                      error={errors.role}
                    />
                  </>
                )}
                <Button title="Continue" onPress={next} />
              </>
            )}

            {/* Step 4: Language */}
            {step === 4 && (
              <>
                <Text style={[styles.sectionTitle, { color: c.text }]}>App Language</Text>
                <Text style={[styles.sectionSubtitle, { color: c.textSecondary }]}>
                  This will be the default language for the app interface and question submissions
                </Text>
                <Select
                  label="Language"
                  placeholder="Search language"
                  value={language}
                  options={languageOptions}
                  onChange={(v) => { setLanguage(v); setErrors({}); }}
                  error={errors.language}
                  searchable
                />
                <Button title="Complete Registration" onPress={handleSubmit} loading={loading} />
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
  backBtn: { marginBottom: tokens.spacing4 },
  backText: { fontSize: 15, fontWeight: '600' },
  header: { marginBottom: tokens.spacing5 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spacing6, flexWrap: 'wrap' },
  stepItem: { alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: tokens.radiusFull, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 10, marginTop: 3 },
  stepLine: { height: 2, width: 24, marginHorizontal: 2, marginBottom: 16 },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: tokens.spacing2 },
  sectionSubtitle: { fontSize: 13, marginTop: -tokens.spacing2, marginBottom: tokens.spacing4, lineHeight: 18 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing4,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
    marginBottom: tokens.spacing3,
  },
  catIcon: { fontSize: 28, marginRight: tokens.spacing3 },
  catInfo: { flex: 1 },
  catLabel: { fontSize: 15, fontWeight: '600' },
  catDesc: { fontSize: 12, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: tokens.radiusFull, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: tokens.radiusFull },
  error: { fontSize: 12, marginBottom: tokens.spacing3, letterSpacing: 0.01 * 12 },
});