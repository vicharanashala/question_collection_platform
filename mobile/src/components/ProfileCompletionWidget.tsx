import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { tokens } from '../utils/theme';
import { UserCategory } from '../types';
import type { PublicUser, ProfileCompletionStatus } from '../types';

const WARNING = '#F59E0B';
const WARNING_BG = '#FEF3C7';
const WARNING_ALPHA = '#F59E0B';

function fieldLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    name: t('profile.completion.fieldName'),
    state: t('profile.completion.fieldState'),
    district: t('profile.completion.fieldDistrict'),
    block: t('profile.completion.fieldBlock'),
    category: t('profile.completion.fieldCategory'),
    language: t('profile.completion.fieldLanguage'),
    farmSize: t('profile.completion.fieldFarmSize'),
    cropType: t('profile.completion.fieldCropType'),
    courseName: t('profile.completion.fieldCourseName'),
    universityName: t('profile.completion.fieldUniversityName'),
    organisationName: t('profile.completion.fieldOrganisationName'),
    role: t('profile.completion.fieldRole'),
    crops: t('profile.completion.fieldCrops'),
  };
  return map[key] ?? key;
}

function buildStatus(user: PublicUser | null, hasCrops: boolean): ProfileCompletionStatus {
  if (!user) return { percentage: 0, fields: [], isComplete: false };

  const check = (key: string, value: unknown) => ({
    field: key,
    label: fieldLabel(key, (k) => k),
    completed: !!value,
  });

  const baseFields = [
    check('name', user.name),
    check('state', user.state),
    check('district', user.district),
    check('block', user.block),
    check('category', user.category),
    check('language', user.languagePreference),
  ];

  const catFields: ReturnType<typeof check>[] = [];
  if (user.category === UserCategory.FARMER || user.category === UserCategory.FPO) {
    catFields.push(check('farmSize', (user as any).farmSize));
    catFields.push(check('cropType', (user as any).cropType));
  } else if (user.category === UserCategory.STUDENT) {
    catFields.push(check('courseName', (user as any).courseName));
    catFields.push(check('universityName', (user as any).universityName));
  } else {
    catFields.push(check('organisationName', (user as any).organisationName));
    catFields.push(check('role', (user as any).role));
  }

  const allFields = [...baseFields, ...catFields, check('crops', hasCrops)];
  const completed = allFields.filter((f) => f.completed).length;
  const percentage = Math.round((completed / allFields.length) * 100);

  return { percentage, fields: allFields, isComplete: percentage === 100 };
}

interface Props {
  onEdit: () => void;
  hasCrops: boolean;
}

export function ProfileCompletionWidget({ onEdit, hasCrops }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const { user } = useAuth();

  const status = useMemo(() => buildStatus(user, hasCrops), [user, hasCrops]);

  if (status.isComplete) return null;

  const missing = status.fields.filter((f) => !f.completed);

  return (
    <View style={[styles.wrap, { backgroundColor: WARNING_BG, borderColor: WARNING }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: WARNING_ALPHA + '22' }]}>
          <Ionicons name="alert-circle" size={16} color={WARNING} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]}>{t('profile.completion.title')}</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            {t('profile.completion.incomplete', { percent: status.percentage })}
          </Text>
        </View>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
          <Text style={[styles.editBtn, { color: c.primary }]}>{t('profile.edit')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fields}>
        {missing.slice(0, 4).map((f) => (
          <View key={f.field} style={[styles.fieldPill, { backgroundColor: WARNING_ALPHA + '18' }]}>
            <Ionicons name="ellipse" size={6} color={WARNING} style={{ marginRight: 5 }} />
            <Text style={[styles.fieldPillText, { color: c.text }]}>{f.label}</Text>
          </View>
        ))}
        {missing.length > 4 && (
          <Text style={[styles.moreText, { color: c.textSecondary }]}>
            +{missing.length - 4} more
          </Text>
        )}
      </View>

      <View style={[styles.progressTrack, { backgroundColor: c.borderSubtle }]}>
        <View style={[styles.progressFill, { backgroundColor: WARNING, width: `${status.percentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: tokens.spacing4,
    marginBottom: tokens.spacing4,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    borderWidth: 1,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: tokens.spacing3 },
  iconWrap: { width: 28, height: 28, borderRadius: tokens.radius, alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing2 },
  headerText: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 12 },
  editBtn: { fontSize: 13, fontWeight: '700' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing1 + 2, marginBottom: tokens.spacing3 },
  fieldPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing2 + 2, paddingVertical: 3, borderRadius: tokens.radiusFull },
  fieldPillText: { fontSize: 11, fontWeight: '500' },
  moreText: { fontSize: 11, alignSelf: 'center', marginLeft: tokens.spacing1 },
  progressTrack: { height: 4, borderRadius: tokens.radiusFull, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: tokens.radiusFull },
});