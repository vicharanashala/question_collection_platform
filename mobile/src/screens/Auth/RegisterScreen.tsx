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
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/types';
import {
  INDIAN_STATES,
  LANGUAGES,
  USER_CATEGORIES,
} from '../../utils/constants';
import { UserCategory } from '../../types';

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

export function RegisterScreen({ navigation, route }: Props) {
  const { mobileNumber } = route.params;
  const { register } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
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
    if (s === 1 && !category) errs.category = 'Please select a category';
    if (s === 2) {
      if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
      if (!state) errs.state = 'Please select your state';
      if (!district.trim()) errs.district = 'District is required';
    }
    if (s === 3) {
      if (category === UserCategory.FARMER) {
        if (!farmSize.trim()) errs.farmSize = 'Farm size is required';
        if (!cropType.trim()) errs.cropType = 'Crop type is required';
      }
      if (category === UserCategory.STUDENT) {
        if (!courseName.trim()) errs.courseName = 'Course name is required';
        if (!universityName.trim()) errs.universityName = 'University name is required';
      }
      if (category === UserCategory.FPO || category === UserCategory.VOLUNTEER || category === UserCategory.NGO) {
        if (!organizationName.trim()) errs.organizationName = 'Organization name is required';
        if (!role.trim()) errs.role = 'Role is required';
      }
    }
    if (s === 4 && !language) errs.language = 'Please select a language';
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

    const formData = {
      name: name.trim(),
      mobileNumber,
      state,
      district: district.trim(),
      block: block.trim() || undefined,
      category,
      languagePreference: language,
      consentGiven: true,
      profileData,
    };

    try {
      await register(formData);
      // Auth state update triggers navigation to app
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Registration failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['Category', 'Location', 'Details', 'Language'];

  function renderStepIndicator() {
    return (
      <View style={styles.stepIndicator}>
        {stepLabels.map((label, i) => {
          const num = i + 1;
          const isActive = num === step;
          const isDone = num < step;
          return (
            <React.Fragment key={label}>
              <View style={[styles.stepDot, isActive && styles.stepDotActive, isDone && styles.stepDotDone]}>
                <Text style={[styles.stepNum, (isActive || isDone) && styles.stepNumActive]}>
                  {isDone ? '✓' : num}
                </Text>
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</Text>
              {i < stepLabels.length - 1 && (
                <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Step {step} of {TOTAL_STEPS}</Text>
          </View>

          {renderStepIndicator()}

          <View style={styles.card}>
            {/* ─── Step 1: Category ─────────────────────────── */}
            {step === 1 && (
              <>
                <Text style={styles.sectionTitle}>Select Your Category</Text>
                {USER_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.categoryCard, category === cat.value && styles.categorySelected]}
                    onPress={() => { setCategory(cat.value as UserCategory); setErrors({}); }}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <View style={styles.categoryInfo}>
                      <Text style={[styles.categoryLabel, category === cat.value && styles.categoryLabelSelected]}>
                        {cat.label}
                      </Text>
                      <Text style={styles.categoryDesc}>{cat.description}</Text>
                    </View>
                    <View style={[styles.radio, category === cat.value && styles.radioSelected]}>
                      {category === cat.value && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                ))}
                {errors.category && <Text style={styles.error}>{errors.category}</Text>}
                <Button title="Continue" onPress={next} disabled={!category} />
              </>
            )}

            {/* ─── Step 2: Location ─────────────────────────── */}
            {step === 2 && (
              <>
                <Text style={styles.sectionTitle}>Location Details</Text>
                <Input
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={(t) => { setName(t); setErrors({}); }}
                  error={errors.name}
                  autoCapitalize="words"
                />
                <Select
                  label="State"
                  placeholder="Select your state"
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
                  placeholder="Enter your block"
                  value={block}
                  onChangeText={setBlock}
                />
                <Button title="Continue" onPress={next} />
              </>
            )}

            {/* ─── Step 3: Category Details ─────────────────── */}
            {step === 3 && (
              <>
                <Text style={styles.sectionTitle}>Additional Details</Text>

                {category === UserCategory.FARMER && (
                  <>
                    <Input
                      label="Farm Size (e.g., 2.5 acres)"
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
                      label="University / College Name"
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
                      label="Organization Name"
                      placeholder="Enter organization name"
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

            {/* ─── Step 4: Language ─────────────────────────── */}
            {step === 4 && (
              <>
                <Text style={styles.sectionTitle}>Select Your Language</Text>
                <Text style={styles.sectionSubtitle}>
                  This will be the default language for your app interface and question submissions
                </Text>
                <Select
                  label="Language"
                  value={language}
                  options={languageOptions}
                  onChange={(v) => { setLanguage(v); setErrors({}); }}
                  error={errors.language}
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
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 16, color: '#2E7D32', fontWeight: '600' },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1B5E20' },
  subtitle: { fontSize: 13, color: '#558B2F', marginTop: 4 },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  stepDotActive: { borderColor: '#2E7D32', backgroundColor: '#F1F8E9' },
  stepDotDone: { borderColor: '#2E7D32', backgroundColor: '#2E7D32' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#9E9E9E' },
  stepNumActive: { color: '#2E7D32' },
  stepLabel: { fontSize: 11, color: '#9E9E9E', marginLeft: 4, marginRight: 4 },
  stepLabelActive: { color: '#2E7D32', fontWeight: '600' },
  stepLine: { width: 20, height: 2, backgroundColor: '#E0E0E0', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#2E7D32' },
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
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#212121', marginBottom: 16 },
  sectionSubtitle: { fontSize: 13, color: '#757575', marginTop: -8, marginBottom: 16, lineHeight: 18 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  categorySelected: { borderColor: '#2E7D32', backgroundColor: '#F1F8E9' },
  categoryIcon: { fontSize: 32, marginRight: 14 },
  categoryInfo: { flex: 1 },
  categoryLabel: { fontSize: 15, fontWeight: '600', color: '#424242' },
  categoryLabelSelected: { color: '#2E7D32' },
  categoryDesc: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#2E7D32' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2E7D32' },
  error: { fontSize: 12, color: '#E53935', marginBottom: 12 },
});