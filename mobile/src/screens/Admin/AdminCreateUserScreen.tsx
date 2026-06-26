import React, { useState, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';
import { adminApi, getErrorMessage, lgdApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { KVKS } from '../../utils/constants';

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
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'curator'>('user');
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [district, setDistrict] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [block, setBlock] = useState('');
  const [showOtherBlock, setShowOtherBlock] = useState(false);
  const [village, setVillage] = useState('');
  const [showOtherVillage, setShowOtherVillage] = useState(false);
  const [kvk, setKvk] = useState('');
  const [showOtherKvk, setShowOtherKvk] = useState(false);

  // LGD data
  const [stateList, setStateList] = useState<{ code: string; name: string }[]>([]);
  const [districtList, setDistrictList] = useState<{ code: string; name: string }[]>([]);
  const [subdistrictList, setSubdistrictList] = useState<{ code: string; name: string }[]>([]);
  const [villageList, setVillageList] = useState<{ code: string; name: string }[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  // Load states on mount
  useEffect(() => {
    setLoadingStates(true);
    lgdApi.getStates()
      .then((res) => setStateList(res.data.states))
      .catch(() => setStateList([]))
      .finally(() => setLoadingStates(false));
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!mobileNumber.trim() || !/^\d{10}$/.test(mobileNumber.trim())) errs.mobileNumber = 'Enter a valid 10-digit mobile number';
    if (role === 'user' && !category) errs.category = 'Category is required for users';
    if (!state) errs.state = 'State is required';
    if (!district.trim()) errs.district = 'District is required';
    // Block, village, and KVK are only mandatory for Farmers
    if (category === 'farmer') {
      if (showOtherBlock) {
        if (!block.trim()) errs.blockOther = t('blockOtherRequired');
      } else {
        if (!block.trim()) errs.block = 'Block is required';
      }
      if (showOtherVillage) {
        if (!village.trim()) errs.villageOther = t('villageOtherRequired');
      } else {
        if (!village.trim()) errs.village = 'Village is required';
      }
      if (showOtherKvk) {
        if (!kvk.trim()) errs.kvkOther = t('kvkOtherRequired');
      } else {
        if (!kvk.trim()) errs.kvk = t('kvkRequired');
      }
    }
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
        block: block.trim(),
        village: village.trim(),
        kvk: kvk.trim(),
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
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
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
              placeholder={t('namePlaceholder')}
              value={name}
              onChangeText={(txt) => { setName(txt); setErrors({}); }}
              error={errors.name}
              autoCapitalize="words"
            />
            <Input
              label="Mobile Number"
              placeholder={t('mobileNumberPlaceholder')}
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
              placeholder={t('selectState')}
              value={state}
              options={stateList.map((s) => ({ value: s.name, label: s.name }))}
              onChange={(v) => {
                const val = v as string;
                setState(val);
                setStateCode(stateList.find((s) => s.name === val)?.code ?? '');
                setDistrict('');
                setDistrictCode('');
                setBlock('');
                setShowOtherBlock(false);
                setVillage('');
                setShowOtherVillage(false);
                setKvk('');
                setShowOtherKvk(false);
                setSubdistrictList([]);
                setVillageList([]);
                setErrors({});
                const code = stateList.find((s) => s.name === v)?.code ?? '';
                if (!code) return;
                setLoadingDistricts(true);
                lgdApi.getDistricts(code)
                  .then((res) => setDistrictList(res.data.districts))
                  .catch(() => setDistrictList([]))
                  .finally(() => setLoadingDistricts(false));
              }}
              error={errors.state}
              searchable
              loading={loadingStates}
              disabled={loadingStates}
              disabledMessage={t('stateLoadingMessage')}
            />
            <Select
              label="District"
              placeholder={t('selectDistrict')}
              value={district}
              options={districtList.map((d) => ({ value: d.name, label: d.name }))}
              onChange={(v) => {
                const val = v as string;
                setDistrict(val);
                setDistrictCode(districtList.find((d) => d.name === val)?.code ?? '');
                setBlock('');
                setShowOtherBlock(false);
                setVillage('');
                setShowOtherVillage(false);
                setKvk('');
                setShowOtherKvk(false);
                setSubdistrictList([]);
                setVillageList([]);
                setErrors({});
                const code = districtList.find((d) => d.name === v)?.code ?? '';
                if (!code) return;
                setLoadingSubdistricts(true);
                lgdApi.getSubDistricts(code)
                  .then((res) => setSubdistrictList(res.data.subdistricts))
                  .catch(() => setSubdistrictList([]))
                  .finally(() => setLoadingSubdistricts(false));
              }}
              error={errors.district}
              searchable
              loading={loadingDistricts}
              disabled={loadingDistricts || !state}
              disabledMessage={
                !state ? t('selectStateBeforeDistrict') : t('districtLoadingMessage')
              }
            />
            <Select
              label={category === 'farmer' ? t('block') : t('blockOptional')}
              placeholder={t('selectBlock')}
              value={showOtherBlock ? '__other__' : block}
              options={[
                ...subdistrictList.map((s) => ({ value: s.code, label: s.name })),
                { value: '__other__', label: t('others') },
              ]}
              onChange={(v) => {
                const val = v as string;
                if (val === '__other__') {
                  setShowOtherBlock(true);
                  setBlock('');
                } else {
                  setShowOtherBlock(false);
                  setBlock(val);
                  setVillage('');
                  setShowOtherVillage(false);
                  setVillageList([]);
                  setErrors({});
                  setLoadingVillages(true);
                  lgdApi.getVillages(val)
                    .then((res) => setVillageList(res.data.villages))
                    .catch(() => setVillageList([]))
                    .finally(() => setLoadingVillages(false));
                }
                setErrors({});
              }}
              error={errors.block}
              searchable
              loading={loadingSubdistricts}
              disabled={loadingSubdistricts || !district}
              disabledMessage={
                !district ? t('selectDistrictBeforeBlock') : t('blockLoadingMessage')
              }
            />
            {showOtherBlock && (
              <Input
                label={category === 'farmer' ? t('blockOther') : t('blockOtherOptional')}
                placeholder={t('blockOtherPlaceholder')}
                value={block}
                onChangeText={(txt) => { setBlock(txt); setErrors({}); }}
                error={errors.blockOther}
              />
            )}
            <Select
              label={category === 'farmer' ? t('village') : t('villageOptional')}
              placeholder={t('selectVillage')}
              value={showOtherVillage ? '__other__' : village}
              options={[
                ...villageList.map((v) => ({ value: v.code, label: v.name })),
                { value: '__other__', label: t('others') },
              ]}
              onChange={(v) => {
                if (v === '__other__') {
                  setShowOtherVillage(true);
                  setVillage('');
                } else {
                  setShowOtherVillage(false);
                  setVillage(v);
                }
                setErrors({});
              }}
              error={errors.village}
              searchable
              loading={loadingVillages}
              disabled={loadingVillages || (!block && !showOtherBlock)}
              disabledMessage={
                !block && !showOtherBlock
                  ? t('selectBlockBeforeVillage')
                  : t('villageLoadingMessage')
              }
            />
            {showOtherVillage && (
              <Input
                label={category === 'farmer' ? t('villageOther') : t('villageOtherOptional')}
                placeholder={t('villageOtherPlaceholder')}
                value={village}
                onChangeText={(txt) => { setVillage(txt); setErrors({}); }}
                error={errors.villageOther}
              />
            )}
            <Select
              label={category === 'farmer' ? t('kvk') : t('kvkOptional')}
              placeholder={t('selectKvk')}
              value={showOtherKvk ? '__other__' : kvk}
              options={[
                ...(KVKS[district] ?? []).map((k) => ({ value: k, label: k })),
                { value: '__other__', label: t('kvkNotListed') },
              ]}
              onChange={(v) => {
                if (v === '__other__') {
                  setShowOtherKvk(true);
                  setKvk('');
                } else {
                  setShowOtherKvk(false);
                  setKvk(v);
                }
                setErrors({});
              }}
              error={errors.kvk}
              searchable
              disabled={category === 'farmer' && !block}
              disabledMessage={t('selectVillageBeforeKvk')}
            />
            {showOtherKvk && (
              <Input
                label={category === 'farmer' ? t('kvkOther') : t('kvkOtherOptional')}
                placeholder={t('kvkOtherPlaceholder')}
                value={kvk}
                onChangeText={(txt) => { setKvk(txt); setErrors({}); }}
                error={errors.kvkOther}
              />
            )}

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