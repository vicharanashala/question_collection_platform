import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TooltipIcon } from '../../components/TooltipIcon';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { questionApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { MainTabParamList } from '../../navigation/types';
import { SEASONS, DOMAIN_CATEGORIES, INDIAN_STATES } from '../../utils/constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  questionText: string;
  domainCategory: string;
  season: string;
  cropType: string;
  state: string;
  district: string;
  block?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  mediaType: 'none' | 'image' | 'video' | 'audio';
  submittedAt: string;
  editWindowClosesAt: string | null;
  rejectionReason?: string;
}

interface QuestionsResponse {
  items: Question[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface FilterState {
  status: string;
  season: string;
  domainCategory: string;
  search: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending', color: '#E88B00', icon: 'time-outline' },
  approved:  { label: 'Approved', color: '#16A34A', icon: 'checkmark-circle' },
  rejected:  { label: 'Rejected', color: '#DC2626', icon: 'close-circle' },
};

const SEASON_OPTIONS = [
  { value: '', label: 'All Seasons' },
  ...SEASONS.map((s) => ({ value: s.value, label: s.label })),
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...DOMAIN_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

const STATE_OPTIONS = [
  { value: '', label: 'All States' },
  ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
];

function isWithinEditWindow(q: Question): boolean {
  if (!q.editWindowClosesAt) return false;
  return new Date(q.editWindowClosesAt) > new Date();
}

function getEditTimeRemaining(q: Question, now: number): string | null {
  if (!q.editWindowClosesAt) return null;
  const remainingMs = new Date(q.editWindowClosesAt).getTime() - now;
  if (remainingMs <= 0) return null;
  const seconds = Math.floor(remainingMs / 1000);
  if (seconds < 60) return `${seconds}s left`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s left`;
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────

interface FilterModalProps {
  visible: boolean;
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClose: () => void;
  onReset: () => void;
}

function FilterModal({ visible, filters, onChange, onClose, onReset }: FilterModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  function ChipGroup({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <View style={styles.chipGroup}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? c.primary : c.input,
                  borderColor: active ? c.primary : c.borderSubtle,
                },
              ]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? '#fff' : c.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.filterOverlay}>
        <SafeAreaView style={[styles.filterModal, { backgroundColor: c.surface }]}>
          {/* Header */}
          <View style={[styles.filterHeader, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[styles.filterTitle, { color: c.text }]}>{t('submissions.filters')}</Text>
            <View style={styles.filterHeaderActions}>
              <TouchableOpacity onPress={onReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.resetBtn, { color: c.primary }]}>{t('submissions.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.closeBtn, { color: c.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.filterBody} showsVerticalScrollIndicator={false}>
            {/* Search */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: c.text }]}>{t('submissions.search')}</Text>
              <TouchableOpacity
                style={[styles.searchBar, { backgroundColor: c.input, borderColor: c.borderSubtle }]}
                onPress={() => {}}
                activeOpacity={0.7}
              >
                <Ionicons name="search" size={16} color={c.textTertiary} />
                <Text
                  style={[
                    styles.searchPlaceholder,
                    { color: filters.search ? c.text : c.textTertiary },
                  ]}
                >
                  {filters.search || t('submissions.searchPlaceholder')}
                </Text>
                {filters.search ? (
                  <TouchableOpacity onPress={() => onChange({ ...filters, search: '' })}>
                    <Ionicons name="close-circle" size={16} color={c.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              {filters.search ? null : (
                <Text style={[styles.searchHint, { color: c.textTertiary }]}>
                  {t('submissions.searchHint')}
                </Text>
              )}
            </View>

            {/* Status */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: c.text }]}>{t('submissions.status')}</Text>
              <ChipGroup
                options={STATUS_OPTIONS}
                value={filters.status}
                onChange={(v) => onChange({ ...filters, status: v })}
              />
            </View>

            {/* Season */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: c.text }]}>{t('submissions.season')}</Text>
              <ChipGroup
                options={SEASON_OPTIONS}
                value={filters.season}
                onChange={(v) => onChange({ ...filters, season: v })}
              />
            </View>

            {/* Category */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: c.text }]}>{t('submissions.category')}</Text>
              <ChipGroup
                options={CATEGORY_OPTIONS}
                value={filters.domainCategory}
                onChange={(v) => onChange({ ...filters, domainCategory: v })}
              />
            </View>
          </ScrollView>

          {/* Apply button */}
          <View style={[styles.filterFooter, { borderTopColor: c.borderSubtle }]}>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: c.primary }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>{t('submissions.applyFilters')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Question View Modal ───────────────────────────────────────────────────────

interface QuestionViewModalProps {
  question: Question | null;
  onClose: () => void;
  onEdit: (q: Question) => void;
  now: number;
}

function QuestionViewModal({ question, onClose, onEdit, now }: QuestionViewModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  if (!question) return null;

  const statusMeta = STATUS_META[question.status] ?? STATUS_META.pending;
  const withinEditWindow = isWithinEditWindow(question);
  const editTimeRemaining = getEditTimeRemaining(question, now);
  const submittedDate = new Date(question.submittedAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const mediaLabel: Record<string, string> = {
    none: 'No media', image: '📷 Photo', video: '🎥 Video', audio: '🎙️ Audio',
  };

  function DetailRow({
    icon,
    label,
    value,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }) {
    return (
      <View style={styles.detailRow}>
        <Ionicons name={icon} size={15} color={c.textTertiary} />
        <Text style={[styles.detailLabel, { color: c.textTertiary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: c.text }]}>{value}</Text>
      </View>
    );
  }

  return (
    <Modal visible={!!question} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.viewModalOverlay}>
        <SafeAreaView style={[styles.viewModal, { backgroundColor: c.surface }]}>
          {/* Header */}
          <View style={[styles.viewModalHeader, { borderBottomColor: c.borderSubtle }]}>
            <Text style={[styles.viewModalTitle, { color: c.text }]}>{t('submissions.questionDetails')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.viewModalClose, { color: c.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.viewModalBody} showsVerticalScrollIndicator={false}>
            {/* Status + media badge */}
            <View style={styles.viewModalBadges}>
              <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '18' }]}>
                <Ionicons name={statusMeta.icon as keyof typeof Ionicons.glyphMap} size={13} color={statusMeta.color} />
                <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              </View>
              <View style={[styles.mediaBadge, { backgroundColor: c.input }]}>
                <Text style={[styles.mediaBadgeText, { color: c.textSecondary }]}>
                  {mediaLabel[question.mediaType] ?? question.mediaType}
                </Text>
              </View>
            </View>

            {/* Full question text */}
            <Text style={[styles.viewQuestionText, { color: c.text }]}>{question.questionText}</Text>

            {/* Details list */}
            <View style={[styles.detailsCard, { backgroundColor: c.input, borderColor: c.borderSubtle }]}>
              <DetailRow icon="leaf-outline" label="Crop" value={question.cropType} />
              <View style={[styles.detailDivider, { backgroundColor: c.borderSubtle }]} />
              <DetailRow
                icon="grid-outline"
                label="Category"
                value={CATEGORY_LABELS[question.domainCategory] ?? question.domainCategory}
              />
              <View style={[styles.detailDivider, { backgroundColor: c.borderSubtle }]} />
              <DetailRow icon="calendar-outline" label="Season" value={SEASON_LABELS[question.season] ?? question.season} />
              <View style={[styles.detailDivider, { backgroundColor: c.borderSubtle }]} />
              <DetailRow icon="location-outline" label="Location" value={`${question.district}${question.state ? ', ' + question.state : ''}`} />
              {question.block && (
                <>
                  <View style={[styles.detailDivider, { backgroundColor: c.borderSubtle }]} />
                  <DetailRow icon="map-outline" label="Block" value={question.block} />
                </>
              )}
              <View style={[styles.detailDivider, { backgroundColor: c.borderSubtle }]} />
              <DetailRow icon="time-outline" label="Submitted" value={submittedDate} />
              {question.editWindowClosesAt && (
                <>
                  <View style={[styles.detailDivider, { backgroundColor: c.borderSubtle }]} />
                  <DetailRow
                    icon="timer-outline"
                    label="Edit window"
                    value={
                      withinEditWindow
                        ? `${editTimeRemaining} remaining`
                        : `Closed ${new Date(question.editWindowClosesAt!).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    }
                  />
                </>
              )}
            </View>

            {/* Rejection reason */}
            {question.status === 'rejected' && question.rejectionReason && (
              <View style={[styles.viewRejectionBox, { backgroundColor: c.error + '12', borderColor: c.error + '30' }]}>
                <Ionicons name="warning" size={16} color={c.error} />
                <View style={styles.viewRejectionContent}>
                  <Text style={[styles.viewRejectionLabel, { color: c.error }]}>{t('submissions.rejectionReason')}</Text>
                  <Text style={[styles.viewRejectionText, { color: c.error }]}>{question.rejectionReason}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          {question.status === 'pending' && (
            <View style={[styles.viewModalFooter, { borderTopColor: c.borderSubtle }]}>
              {editTimeRemaining ? (
                <View style={styles.editWindowNote}>
                  <Ionicons name="timer" size={14} color={c.textTertiary} />
                  <Text style={[styles.editWindowNoteText, { color: c.textTertiary }]}>
                    {t('submissions.editWindowNote', { time: editTimeRemaining })}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.editWindowExpired, { color: c.textTertiary }]}>{t('submissions.editWindowExpiredNote')}</Text>
              )}
              <TouchableOpacity
                style={[
                  styles.viewEditBtn,
                  { backgroundColor: withinEditWindow ? c.primary : c.textTertiary + '40' },
                ]}
                onPress={() => { onClose(); onEdit(question); }}
                disabled={!withinEditWindow}
              >
                <Ionicons name="pencil" size={16} color={withinEditWindow ? '#fff' : c.textTertiary} />
                <Text style={[styles.viewEditBtnText, { color: withinEditWindow ? '#fff' : c.textTertiary }]}>
                  {t('submissions.editQuestion')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubmissionsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<MainTabParamList>>();
  const { t } = useTranslation();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hasMore, setHasMore] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    season: '',
    domainCategory: '',
    search: '',
  });

  const activeFilterCount = [filters.status, filters.season, filters.domainCategory, filters.search].filter(
    Boolean,
  ).length;

  const fetchQuestions = useCallback(
    async (pageNum = 1, isRefresh = false, currentFilters?: FilterState) => {
      const f = currentFilters ?? filters;
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      try {
        const params: Record<string, string | number> = { page: pageNum, limit: 20 };
        if (f.status) params.status = f.status;
        if (f.season) params.season = f.season;
        if (f.domainCategory) params.domainCategory = f.domainCategory;
        if (f.search.trim()) params.search = f.search.trim();

        const res = await questionApi.getMyQuestions(params);
        const data = res.data as QuestionsResponse;
        setQuestions((prev) =>
          pageNum === 1 ? data.items : [...prev, ...data.items],
        );
        setHasMore(data.page < data.pages);
        setPage(pageNum);
      } catch (err) {
        const { getErrorMessage } = await import('../../api/client');
        showToast(getErrorMessage(err, 'Failed to load your submissions.'), 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    fetchQuestions(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Live ticker so edit timers count down in real-time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleRefresh() {
    await fetchQuestions(1, true);
  }

  async function handleLoadMore() {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchQuestions(page + 1);
    } catch (err) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, 'Failed to load more submissions.'), 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleEdit(question: Question) {
    if (!isWithinEditWindow(question)) {
      showToast(t('submissions.editWindowClosed'), 'warning');
      return;
    }
    navigation.navigate('AskQuestion', { questionId: question.id } as never);
  }

  function handleFilterChange(f: FilterState) {
    setFilters(f);
  }

  function handleFilterReset() {
    setFilters({ status: '', season: '', domainCategory: '', search: '' });
  }

  // ─── List Item ──────────────────────────────────────────────────────────────

  function renderItem({ item: q }: { item: Question }) {
    const statusMeta = STATUS_META[q.status] ?? STATUS_META.pending;
    const withinEditWindow = isWithinEditWindow(q);
    const seasonLabel = SEASON_LABELS[q.season] ?? q.season;
    const editTimeRemaining = getEditTimeRemaining(q, now);
    const submittedDate = new Date(q.submittedAt).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    return (
      <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
        {/* Header row: status badge + edit button (outside Pressable so card tap ≠ edit tap) */}
        <View style={styles.cardHeader}>
          <Pressable onPress={() => setSelectedQuestion(q)} style={styles.statusBadgePressable}>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '18' }]}>
              <Ionicons name={statusMeta.icon as keyof typeof Ionicons.glyphMap} size={13} color={statusMeta.color} />
              <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
          </Pressable>
          {q.status === 'pending' && (
            <View style={styles.editRow}>
              {editTimeRemaining && (
                <Text style={[styles.editTimer, { color: c.textTertiary }]}>{editTimeRemaining}</Text>
              )}
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  { backgroundColor: withinEditWindow ? c.primary : c.textTertiary + '40' },
                ]}
                onPress={() => handleEdit(q)}
                disabled={!withinEditWindow}
              >
                <Ionicons name="pencil" size={14} color={withinEditWindow ? '#fff' : c.textTertiary} />
                <Text style={[styles.editBtnText, { color: withinEditWindow ? '#fff' : c.textTertiary }]}>{t('submissions.editQuestion')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tappable body */}
        <Pressable onPress={() => setSelectedQuestion(q)} style={styles.cardBody}>
          {/* Question text */}
          <Text style={[styles.questionText, { color: c.text }]} numberOfLines={3}>
            {q.questionText}
          </Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="leaf" size={12} color={c.textTertiary} />
              <Text style={[styles.metaChipText, { color: c.textSecondary }]}>{q.cropType}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="grid" size={12} color={c.textTertiary} />
              <Text style={[styles.metaChipText, { color: c.textSecondary }]}>
                {CATEGORY_LABELS[q.domainCategory] ?? q.domainCategory}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="calendar" size={12} color={c.textTertiary} />
              <Text style={[styles.metaChipText, { color: c.textSecondary }]}>{seasonLabel}</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.metaChip}>
            <Ionicons name="location" size={12} color={c.textTertiary} />
            <Text style={[styles.metaChipText, { color: c.textSecondary }]}>
              {q.district}{q.state ? `, ${q.state}` : ''}
            </Text>
          </View>

          {/* Rejection reason */}
          {q.status === 'rejected' && q.rejectionReason && (
            <View style={[styles.rejectionBox, { backgroundColor: c.error + '10' }]}>
              <Ionicons name="information-circle" size={14} color={c.error} />
              <Text style={[styles.rejectionText, { color: c.error }]} numberOfLines={2}>
                {q.rejectionReason}
              </Text>
            </View>
          )}

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: c.textTertiary }]}>{submittedDate}</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && questions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.centerText, { color: c.textSecondary }]}>{t('submissions.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleRowLeft}>
                <Text style={[styles.title, { color: c.text }]}>{t('submissions.title')}</Text>
                <TooltipIcon
                  description={t('submissions.filterTooltip')}
                  size={18}
                />
              </View>
              <TouchableOpacity
                style={[styles.filterBtn, { backgroundColor: activeFilterCount > 0 ? c.primary + '20' : c.input }]}
                onPress={() => setShowFilter(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={activeFilterCount > 0 ? c.primary : c.textSecondary}
                />
                {activeFilterCount > 0 && (
                  <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {questions.length > 0
                ? t('submissions.subtitle', { count: questions.length, s: questions.length !== 1 ? 's' : '' })
                : 'No questions submitted yet'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={56} color={c.textTertiary} />
            <Text style={[styles.emptyTitle, { color: c.textSecondary }]}>{t('submissions.noSubmissions')}</Text>
            <Text style={[styles.emptyBody, { color: c.textTertiary }]}>
              {activeFilterCount > 0 ? t('submissions.adjustFilters') : t('submissions.startAsking')}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          (hasMore || loadingMore) ? (
            <View style={styles.footerSpinner}>
              <ActivityIndicator size="small" color={c.primary} />
            </View>
          ) : null
        }
      />

      <FilterModal
        visible={showFilter}
        filters={filters}
        onChange={handleFilterChange}
        onClose={() => setShowFilter(false)}
        onReset={handleFilterReset}
      />

      {/* View Question Modal */}
      <QuestionViewModal
        question={selectedQuestion}
        onClose={() => setSelectedQuestion(null)}
        onEdit={handleEdit}
        now={now}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: tokens.spacing4, paddingBottom: tokens.spacing8, flexGrow: 1 },
  header: { paddingTop: tokens.spacing6, paddingBottom: tokens.spacing4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: tokens.radiusFull,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  centerText: { fontSize: 14, marginTop: tokens.spacing3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing4 },
  emptyBody: { fontSize: 13, marginTop: tokens.spacing2, textAlign: 'center' },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing4, marginBottom: tokens.spacing4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing3 },
  statusBadgePressable: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { gap: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusFull, paddingHorizontal: tokens.spacing2, paddingVertical: 3, gap: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  editTimer: { fontSize: 11, fontWeight: '500' },
  editBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusMd, paddingHorizontal: tokens.spacing3, paddingVertical: 5, gap: 4 },
  editBtnText: { fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 14, lineHeight: 20, fontWeight: '500', marginBottom: tokens.spacing3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing1, marginBottom: tokens.spacing1 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaChipText: { fontSize: 12 },
  rejectionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginTop: tokens.spacing2 },
  rejectionText: { fontSize: 12, flex: 1, lineHeight: 18 },
  timestamp: { fontSize: 11, marginTop: tokens.spacing2, textAlign: 'right' },
  footerSpinner: { paddingVertical: tokens.spacing6, alignItems: 'center' },

  // Question View Modal
  viewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  viewModal: { borderTopLeftRadius: tokens.radiusXl, borderTopRightRadius: tokens.radiusXl, maxHeight: '90%' },
  viewModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing6, paddingVertical: tokens.spacing4, borderBottomWidth: 1,
  },
  viewModalTitle: { fontSize: 18, fontWeight: '700' },
  viewModalClose: { fontSize: 18 },
  viewModalBody: { paddingHorizontal: tokens.spacing6, paddingTop: tokens.spacing5 },
  viewModalBadges: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing4 },
  mediaBadge: { borderRadius: tokens.radiusFull, paddingHorizontal: tokens.spacing3, paddingVertical: 3 },
  mediaBadgeText: { fontSize: 12, fontWeight: '500' },
  viewQuestionText: { fontSize: 16, lineHeight: 24, fontWeight: '500', marginBottom: tokens.spacing5 },
  detailsCard: {
    borderWidth: 1, borderRadius: tokens.radiusLg, padding: tokens.spacing4,
    marginBottom: tokens.spacing5, gap: 0,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, paddingVertical: tokens.spacing2 },
  detailLabel: { fontSize: 13, minWidth: 72 },
  detailValue: { fontSize: 13, flex: 1, fontWeight: '500' },
  detailDivider: { height: 1 },
  viewRejectionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing3,
    borderWidth: 1, borderRadius: tokens.radiusLg, padding: tokens.spacing4,
    marginBottom: tokens.spacing5,
  },
  viewRejectionContent: { flex: 1 },
  viewRejectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  viewRejectionText: { fontSize: 13, lineHeight: 20 },
  viewModalFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing6, paddingVertical: tokens.spacing4,
    borderTopWidth: 1, gap: tokens.spacing3,
  },
  editWindowNote: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editWindowNoteText: { fontSize: 12 },
  editWindowExpired: { fontSize: 12, fontStyle: 'italic' },
  viewEditBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing5, paddingVertical: tokens.spacing3, gap: 6,
  },
  viewEditBtnText: { fontSize: 14, fontWeight: '700' },

  // Filter modal
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  filterModal: { borderTopLeftRadius: tokens.radiusXl, borderTopRightRadius: tokens.radiusXl, maxHeight: '85%' },
  filterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing6, paddingVertical: tokens.spacing4, borderBottomWidth: 1,
  },
  filterTitle: { fontSize: 18, fontWeight: '700' },
  filterHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing4 },
  resetBtn: { fontSize: 14, fontWeight: '600' },
  closeBtn: { fontSize: 18 },
  filterBody: { paddingHorizontal: tokens.spacing6, paddingTop: tokens.spacing4 },
  filterSection: { marginBottom: tokens.spacing6 },
  filterLabel: { fontSize: 14, fontWeight: '700', marginBottom: tokens.spacing3 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  chip: {
    borderWidth: 1,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: tokens.spacing3 + 2,
    paddingVertical: tokens.spacing2,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2,
    borderWidth: 1, borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing3,
  },
  searchPlaceholder: { flex: 1, fontSize: 14 },
  searchHint: { fontSize: 11, marginTop: tokens.spacing1, fontStyle: 'italic' },
  filterFooter: {
    paddingHorizontal: tokens.spacing6, paddingVertical: tokens.spacing4,
    borderTopWidth: 1,
  },
  applyBtn: {
    borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing4,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ─── Consts outside component ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  crop_protection: 'Crop Protection',
  spray: 'Spray',
  irrigation: 'Irrigation',
  fertilizer: 'Fertilizer',
  soil_health: 'Soil Health',
  seed: 'Seed',
  harvest: 'Harvest',
  post_harvest: 'Post Harvest',
  weather: 'Weather',
  market: 'Market',
  livestock: 'Livestock',
  other: 'Other',
};

const SEASON_LABELS: Record<string, string> = {
  kharif: 'Kharif',
  rabi: 'Rabi',
  zaid: 'Zaid',
  year_round: 'Year Round',
};