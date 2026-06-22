import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { INDIAN_STATES } from '../../utils/constants';

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminCreateUser'>;
  route: RouteProp<AdminStackParamList, 'AdminCreateUser'>;
};

const ROLE_OPTIONS = [
  { value: 'user',     label: 'User' },
  { value: 'admin',    label: 'Admin' },
  { value: 'curator',  label: 'Curator' },
];

const CATEGORY_OPTIONS = [
  { value: 'farmer',    label: 'Farmer' },
  { value: 'fpo',       label: 'FPO' },
  { value: 'student',   label: 'Student' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'ngo',       label: 'NGO' },
];

const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));

const CATEGORY_COLORS: Record<string, string> = {
  farmer:    '#2D9A3E',
  fpo:       '#7B5EA7',
  student:   '#2563EB',
  volunteer: '#D97706',
  ngo:       '#DC2626',
};

export function AdminCreateUserScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'curator'>('user');
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!mobileNumber.trim() || !/^\d{10}$/.test(mobileNumber.trim())) errs.mobileNumber = 'Enter a valid 10-digit mobile number';
    if (role === 'user' && !category) errs.category = 'Category is required for users';
    if (!state) errs.state = 'State is required';
    if (!district.trim()) errs.district = 'District is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await adminApi.createUser({
        name: name.trim(),
        mobileNumber: mobileNumber.trim(),
        role,
        ...(role === 'user' ? { category } : {}),
        state,
        district: district.trim(),
        block: block.trim() || undefined,
      });
      showToast('User created successfully', 'success');
      navigation.goBack();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to create user'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text }]}>Create User</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.pageHeader}>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Add a new user account manually
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Input
              label="Full Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={(txt) => { setName(txt); setErrors({}); }}
              error={errors.name}
              autoCapitalize="words"
            />
            <Input
              label="Mobile Number"
              placeholder="10-digit number"
              value={mobileNumber}
              onChangeText={(txt) => { setMobileNumber(txt.replace(/\D/g, '').slice(0, 10)); setErrors({}); }}
              error={errors.mobileNumber}
              keyboardType="phone-pad"
            />

            <Text style={[styles.fieldLabel, { color: c.text }]}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.roleChip,
                    {
                      borderColor: role === opt.value ? c.primary : c.borderSubtle,
                      backgroundColor: role === opt.value ? c.primary + '14' : 'transparent',
                    },
                  ]}
                  onPress={() => { setRole(opt.value as typeof role); setErrors({}); }}
                >
                  <Text style={[styles.roleChipText, { color: role === opt.value ? c.primary : c.textSecondary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.role && <Text style={[styles.fieldError, { color: c.error }]}>{errors.role}</Text>}

            {role === 'user' && (
              <>
                <Text style={[styles.fieldLabel, { color: c.text }]}>Category</Text>
                <View style={styles.catGrid}>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.catChip,
                        {
                          borderColor: category === opt.value ? CATEGORY_COLORS[opt.value] : c.borderSubtle,
                          backgroundColor: category === opt.value ? CATEGORY_COLORS[opt.value] + '12' : 'transparent',
                        },
                      ]}
                      onPress={() => { setCategory(opt.value); setErrors({}); }}
                    >
                      <Text style={[styles.catChipText, { color: category === opt.value ? CATEGORY_COLORS[opt.value] : c.textSecondary }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.category && <Text style={[styles.fieldError, { color: c.error }]}>{errors.category}</Text>}
              </>
            )}

            <Select
              label="State"
              placeholder="Select state"
              value={state}
              options={stateOptions}
              onChange={(v) => { setState(v); setErrors({}); }}
              error={errors.state}
              searchable
            />
            <Input
              label="District"
              placeholder="Enter district"
              value={district}
              onChangeText={(txt) => { setDistrict(txt); setErrors({}); }}
              error={errors.district}
            />
            <Input
              label="Block (Optional)"
              placeholder="Enter block"
              value={block}
              onChangeText={setBlock}
            />

            <Button title="Create User" onPress={handleSubmit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: tokens.spacing6, paddingBottom: tokens.spacing6, paddingTop: tokens.spacing2 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing5,
    paddingVertical: tokens.spacing3,
  },
  screenTitle: { fontSize: 18, fontWeight: '700' },
  pageHeader: { marginBottom: tokens.spacing5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing2, marginTop: tokens.spacing3 },
  fieldError: { fontSize: 12, marginTop: 4 },
  roleRow: { flexDirection: 'row', gap: tokens.spacing2, marginBottom: tokens.spacing1 },
  roleChip: {
    flex: 1,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  roleChipText: { fontSize: 13, fontWeight: '700' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2, marginBottom: tokens.spacing1 },
  catChip: {
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
  },
  catChipText: { fontSize: 13, fontWeight: '700' },
});