import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { reportsApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import type { Report } from '../../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: string; labelKey: string; icon: string }[] = [
  { value: 'bug',             labelKey: 'report.categories.bug',             icon: 'bug-outline' },
  { value: 'payout_issue',    labelKey: 'report.categories.payout_issue',    icon: 'card-outline' },
  { value: 'question_issue',  labelKey: 'report.categories.question_issue',  icon: 'help-circle-outline' },
  { value: 'abuse',           labelKey: 'report.categories.abuse',           icon: 'shield-outline' },
  { value: 'feature_request', labelKey: 'report.categories.feature_request', icon: 'bulb-outline' },
  { value: 'other',           labelKey: 'report.categories.other',           icon: 'ellipsis-horizontal-outline' },
];

const CATEGORY_ICON_MAP: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.icon]),
);

const STATUS_CONFIG: Record<string, { color: string; bg: string; labelKey: string }> = {
  open:        { color: '#3B82F6', bg: '#DBEAFE', labelKey: 'report.status.open' },
  in_progress: { color: '#F59E0B', bg: '#FEF3C7', labelKey: 'report.status.in_progress' },
  resolved:    { color: '#22C55E', bg: '#DCFCE7', labelKey: 'report.status.resolved' },
  closed:      { color: '#6B7280', bg: '#F3F4F6', labelKey: 'report.status.closed' },
};

// ─── Report Card ──────────────────────────────────────────────────────────────

interface ReportCardProps {
  report: Report;
  onPress: () => void;
}

function ReportCard({ report, onPress }: ReportCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  const statusCfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.closed;
  const categoryIcon = CATEGORY_ICON_MAP[report.category] ?? 'flag-outline';
  const hasReplies = (report.replies?.length ?? 0) > 0;

  const formattedDate = new Date(report.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[cardStyles.wrapper, { shadowColor: c.text }]}
    >
      {/* Left accent bar */}
      <View style={[cardStyles.accentBar, { backgroundColor: statusCfg.color }]} />

      {/* Card body */}
      <View style={[cardStyles.body, { backgroundColor: c.surface }]}>
        {/* Row 1: category + date */}
        <View style={cardStyles.row1}>
          <View style={cardStyles.categoryPill}>
            <Ionicons
              name={categoryIcon as any}
              size={12}
              color={c.primary}
            />
            <Text style={[cardStyles.categoryText, { color: c.primary }]}>
              {t(`report.categories.${report.category}` as any) ?? report.category}
            </Text>
          </View>
          <Text style={[cardStyles.date, { color: c.textTertiary }]}>{formattedDate}</Text>
        </View>

        {/* Row 2: title */}
        <Text style={[cardStyles.title, { color: c.text }]} numberOfLines={2}>
          {report.title}
        </Text>

        {/* Row 3: description */}
        <Text style={[cardStyles.description, { color: c.textSecondary }]} numberOfLines={2}>
          {report.description}
        </Text>

        {/* Row 4: footer */}
        <View style={cardStyles.footer}>
          {hasReplies ? (
            <View style={[cardStyles.replyBadge, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="chatbubble-ellipses" size={11} color={c.primary} />
              <Text style={[cardStyles.replyText, { color: c.primary }]}>
                {report.replies!.length} {report.replies!.length === 1 ? 'reply' : 'replies'}
              </Text>
            </View>
          ) : (
            <View /> /* spacer */
          )}

          <View style={[cardStyles.statusPill, { backgroundColor: statusCfg.bg }]}>
            <View style={[cardStyles.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[cardStyles.statusText, { color: statusCfg.color }]}>
              {t(statusCfg.labelKey)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginBottom: tokens.spacing3,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  body: {
    flex: 1,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    padding: tokens.spacing4,
    paddingLeft: tokens.spacing4 - 2, /* pull content left to align with rest */
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  date: {
    fontSize: 11,
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: tokens.spacing1 + 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: tokens.spacing3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  replyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ReportScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [myReports, setMyReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formError, setFormError] = useState('');

  const fetchMyReports = useCallback(async () => {
    try {
      const { data } = await reportsApi.getMyReports();
      setMyReports(data.items);
    } catch {
      showToast(t('report.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t, showToast]);

  useFocusEffect(
    useCallback(() => {
      fetchMyReports();
    }, [fetchMyReports]),
  );

  const handleSubmit = async () => {
    if (!title.trim())                              { setFormError(t('report.titleMinLength')); return; }
    if (title.trim().length < 5)                    { setFormError(t('report.titleMinLength')); return; }
    if (description.trim().length < 10)             { setFormError(t('report.descriptionMinLength')); return; }
    if (!selectedCategory)                          { setFormError(t('report.categoryPlaceholder')); return; }
    setSubmitting(true);
    setFormError('');
    try {
      await reportsApi.create({
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
      });
      showToast(t('report.submitSuccess'), 'success');
      setShowForm(false);
      setTitle('');
      setDescription('');
      setSelectedCategory('');
      fetchMyReports();
    } catch {
      setFormError(t('report.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('report.title')}</Text>
        <TouchableOpacity
          style={[styles.newButton, { backgroundColor: c.primary }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newButtonText}>{t('report.newReport')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : myReports.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: c.surface }]}>
            <Ionicons name="flag-outline" size={48} color={c.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('report.noReports')}</Text>
          <Text style={[styles.emptySubtitle, { color: c.textTertiary }]}>{t('report.noReportsHint')}</Text>
          <Button
            title={t('report.newReport')}
            onPress={() => setShowForm(true)}
            variant="primary"
            style={{ marginTop: tokens.spacing5 }}
          />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: tokens.spacing4 }}
          showsVerticalScrollIndicator={false}
        >
          {myReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onPress={() => navigation.navigate('ReportDetail', { reportId: report.id })}
            />
          ))}
          <View style={{ height: tokens.spacing4 }} />
        </ScrollView>
      )}

      {/* New Report Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: c.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color={c.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: c.text }]}>{t('report.newReport')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: tokens.spacing4 }}>
            {formError ? (
              <View style={[styles.formErrorBanner, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.formErrorText}>{formError}</Text>
                <TouchableOpacity onPress={() => setFormError('')}>
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, { color: c.text }]}>{t('report.category')} *</Text>
            <View style={[styles.categoryGrid, { backgroundColor: c.surface }]}>
              {CATEGORY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.categoryItem,
                    { borderColor: c.border },
                    selectedCategory === opt.value && { borderColor: c.primary, backgroundColor: c.primary + '18' },
                  ]}
                  onPress={() => setSelectedCategory(opt.value)}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={selectedCategory === opt.value ? c.primary : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryItemLabel,
                      { color: selectedCategory === opt.value ? c.primary : c.text },
                    ]}
                    numberOfLines={2}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: c.text, marginTop: tokens.spacing4 }]}>
              {t('report.titleField')} *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
              placeholder={t('report.titlePlaceholder')}
              placeholderTextColor={c.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={[styles.charCount, { color: c.textTertiary }]}>{title.length}/100</Text>

            <Text style={[styles.fieldLabel, { color: c.text, marginTop: tokens.spacing4 }]}>
              {t('report.descriptionField')} *
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
              placeholder={t('report.descriptionPlaceholder')}
              placeholderTextColor={c.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={[styles.charCount, { color: c.textTertiary }]}>{description.length}/2000</Text>

            <View style={{ marginTop: tokens.spacing6 }}>
              <Button
                title={submitting ? t('report.submitting') : t('report.submit')}
                onPress={handleSubmit}
                variant="primary"
                disabled={submitting}
                loading={submitting}
              />
              <Button
                title={t('report.cancel')}
                onPress={() => setShowForm(false)}
                variant="ghost"
                style={{ marginTop: tokens.spacing2 }}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 22,
  },
  newButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Empty state
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: tokens.spacing1 },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: tokens.spacing1,
    paddingHorizontal: tokens.spacing6,
    lineHeight: 20,
  },

  // Modal form
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  categoryGrid: { borderRadius: 12, padding: 8, flexDirection: 'row', flexWrap: 'wrap' },
  categoryItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    margin: '1%',
  },
  categoryItemLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  formErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: tokens.spacing4,
  },
  formErrorText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#EF4444' },
});