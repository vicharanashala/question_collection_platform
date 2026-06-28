import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { tokens } from '../utils/theme';
import { UserCategory } from '../types';
import type { PublicUser, ProfileCompletionStatus } from '../types';

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

function buildStatus(
  user: PublicUser | null,
  hasCrops: boolean,
  t: (k: string) => string,
): ProfileCompletionStatus {
  if (!user) return { percentage: 0, fields: [], isComplete: false };

  const check = (key: string, value: unknown) => ({
    field: key,
    label: fieldLabel(key, t),
    completed: value !== undefined && value !== null && value !== '',
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
    catFields.push(check('farmSize', user.farmSize));
    catFields.push(check('cropType', user.cropType));
  } else if (user.category === UserCategory.STUDENT) {
    catFields.push(check('courseName', user.courseName));
    catFields.push(check('universityName', user.universityName));
  } else {
    catFields.push(check('organisationName', user.organizationName));
    catFields.push(check('role', user.organizationRole));
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

  const status = useMemo(() => buildStatus(user, hasCrops, t), [user, hasCrops, t]);

  if (status.isComplete) return null;

  const completed = status.fields.filter((f) => f.completed).length;
  const total = status.fields.length;
  const missing = status.fields.filter((f) => !f.completed);

  // Choose bar colour by how close to done
  const barColor = status.percentage >= 75 ? c.success : status.percentage >= 40 ? c.warning : c.error;

  return (
    <View style={[styles.wrap, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* ── Header row ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.heading, { color: c.text }]}>
            {t('profile.completion.title')}
          </Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            {completed}/{total} {t('profile.completion.fieldsComplete', { defaultValue: 'fields complete' })}
            {' · '}
            <Text style={{ color: barColor, fontWeight: '700' }}>{status.percentage}%</Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={onEdit}
          activeOpacity={0.7}
          style={[styles.editBtn, { backgroundColor: c.primary + '18' }]}
        >
          <Ionicons name="create-outline" size={13} color={c.primary} />
          <Text style={[styles.editBtnText, { color: c.primary }]}>{t('profile.edit')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ────────────────────────────────────── */}
      <View style={[styles.barTrack, { backgroundColor: c.borderSubtle }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: barColor, width: `${status.percentage}%` },
          ]}
        />
      </View>

      {/* ── Missing fields ──────────────────────────────────── */}
      {missing.length > 0 && (
        <View style={styles.fieldsSection}>
          <Text style={[styles.fieldsLabel, { color: c.textTertiary }]}>
            {t('profile.completion.stillMissing', { defaultValue: 'Still missing' })}:
          </Text>
          <View style={styles.pillRow}>
            {missing.slice(0, 6).map((f) => (
              <View
                key={f.field}
                style={[styles.pill, { backgroundColor: barColor + '18', borderColor: barColor + '40' }]}
              >
                <Ionicons name="add-circle" size={10} color={barColor} style={{ marginRight: 4 }} />
                <Text style={[styles.pillText, { color: c.text }]} numberOfLines={1}>
                  {f.label}
                </Text>
              </View>
            ))}
            {missing.length > 6 && (
              <View style={[styles.pill, { backgroundColor: c.muted, borderColor: c.border }]}>
                <Text style={[styles.pillText, { color: c.textSecondary }]}>
                  +{missing.length - 6}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: tokens.spacing4,
    marginBottom: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing3,
    gap: tokens.spacing2,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  sub: {
    fontSize: 12,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing1 + 2,
    borderRadius: tokens.radiusFull,
    gap: 4,
    flexShrink: 0,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    borderRadius: tokens.radiusFull,
    overflow: 'hidden',
    marginBottom: tokens.spacing3,
  },
  barFill: {
    height: '100%',
    borderRadius: tokens.radiusFull,
  },
  fieldsSection: {
    gap: tokens.spacing2,
  },
  fieldsLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing1 + 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing2 + 2,
    paddingVertical: 3,
    borderRadius: tokens.radiusFull,
    borderWidth: 1,
    maxWidth: '100%',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
  },
});