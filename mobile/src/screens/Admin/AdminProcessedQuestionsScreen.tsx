import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { AdminFilterModal, FilterOption, ActiveFilters } from '../../components/AdminFilterModal';
import { INDIAN_STATES } from '../../utils/constants';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const STATUS_COLORS: Record<string, string> = {
  held: '#d97706',
  approved: '#22c55e',
  rejected: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  held: 'Held',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'held',     label: 'Held' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'reviewedAt:DESC',           label: 'Recently Reviewed' },
  { value: 'reviewedAt:ASC',            label: 'Oldest Reviewed' },
  { value: 'submittedAt:DESC',          label: 'Recently Submitted' },
  { value: 'aiConfidenceScore:DESC',   label: 'AI Confidence ↓' },
  { value: 'state:ASC',                 label: 'State A→Z' },
];

interface QueueItem {
  id: string;
  questionText: string;
  language: string;
  domains: string[];
  cropType: string;
  state: string;
  district: string;
  mediaType: string;
  status: string;
  aiConfidenceScore: number | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; mobileNumber: string } | null;
  heldReason: string | null;
  approvalReason: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
}

const FILTERS: FilterOption[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Question text or mobile number…',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: STATUS_OPTIONS,
  },
  {
    key: 'state',
    label: 'State',
    type: 'select',
    options: STATE_OPTIONS,
  },
  {
    key: 'sortBy',
    label: 'Sort By',
    type: 'select',
    options: SORT_OPTIONS,
  },
  {
    key: 'fromDate',
    label: 'From Date',
    type: 'date',
    placeholder: 'YYYY-MM-DD',
  },
  {
    key: 'toDate',
    label: 'To Date',
    type: 'date',
    placeholder: 'YYYY-MM-DD',
  },
];

const EMPTY_FILTERS: ActiveFilters = {
  search: '',
  status: '',
  state: '',
  sortBy: 'reviewedAt:DESC',
  fromDate: '',
  toDate: '',
};

function buildQueryParams(active: ActiveFilters, page: number): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit: 20 };
  if (active.search) params.search = active.search;
  if (active.state) params.state = active.state;
  if (active.status) params.status = active.status;
  if (active.fromDate) params.fromDate = active.fromDate;
  if (active.toDate) params.toDate = active.toDate;
  const sortBy = active.sortBy?.split(':')[0];
  const sortOrder = active.sortBy?.split(':')[1];
  if (sortBy && sortBy !== 'reviewedAt') params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return params;
}

export function AdminProcessedQuestionsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation<Nav>();
  const { showToast } = useToast();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const didExplicitlyDeselect = useRef(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(activeFilters.search), 400);
    return () => clearTimeout(timer);
  }, [activeFilters.search]);

  const effectiveFilters: ActiveFilters = { ...activeFilters, search: debouncedSearch };

  useEffect(() => {
    didExplicitlyDeselect.current = false;
    setPage(1);
    setSelectedId(null);
    setLoading(true);
    loadData(1, true, effectiveFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilters.status, activeFilters.state, activeFilters.fromDate, activeFilters.toDate, activeFilters.sortBy]);

  async function loadData(pageNum: number, refresh: boolean, filters: ActiveFilters) {
    try {
      const params = buildQueryParams(filters, pageNum);
      // Pass as repeated params — Express parses to array, validator checks each value
      const processedStatuses = ['held', 'approved', 'rejected'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params as any).status = processedStatuses;
      const res = await adminApi.getReviewQueue(params);
      const data = res.data;
      const newItems: QueueItem[] = data.items ?? [];
      setItems(refresh ? newItems : [...items, ...newItems]);
      setTotal(data.total ?? 0);
      setHasMore(newItems.length === 20);
      setPage(pageNum);
      if (!didExplicitlyDeselect.current && newItems.length > 0 && selectedId === null) {
        setSelectedId(newItems[0].id);
      }
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load questions'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData(1, true, effectiveFilters);
  }

  async function loadMore() {
    if (!hasMore || loading) return;
    await loadData(page + 1, false, effectiveFilters);
  }

  function handleApplyFilters(filters: ActiveFilters) {
    setActiveFilters(filters);
  }

  function handleResetFilters() {
    setActiveFilters({ ...EMPTY_FILTERS });
  }

  function handleSelectQuestion(id: string) {
    if (id === selectedId) {
      didExplicitlyDeselect.current = true;
      setSelectedId(null);
    } else {
      setSelectedId(id);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderItem({ item }: { item: QueueItem }) {
    const isSelected = item.id === selectedId;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleSelectQuestion(item.id)}
        style={[
          styles.card,
          { backgroundColor: c.surface },
          isSelected && { borderColor: c.primary, borderWidth: 1.5 },
        ]}
      >
        {/* Held reason banner */}
        {item.status === 'held' && item.heldReason && (
          <View style={[styles.heldBanner, { backgroundColor: '#f59e0b15' }]}>
            <Ionicons name="pause-circle" size={11} color="#f59e0b" style={{ marginRight: 4 }} />
            <Text style={styles.heldBannerText} numberOfLines={1}>"{item.heldReason}"</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <Text style={[styles.cropType, { color: c.primary }]}>{item.cropType}</Text>
            <Text style={[styles.separator, { color: c.textTertiary }]}>·</Text>
            <Text style={[styles.state, { color: c.textSecondary }]}>{item.state}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] ?? '#999') + '22' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] ?? '#999' }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        <Text style={[styles.questionText, { color: c.text }]} numberOfLines={3}>
          {item.questionText}
        </Text>

        <View style={styles.cardFooter}>
          <View>
            <Text style={[styles.submitter, { color: c.textSecondary }]}>
              {item.user?.name ?? item.user?.mobileNumber ?? 'Unknown'}
            </Text>
            <Text style={[styles.date, { color: c.textTertiary }]}>
              {formatDate(item.submittedAt)}
              {item.reviewedAt && ` → reviewed ${formatDate(item.reviewedAt)}`}
            </Text>
          </View>
          {item.reviewedByName && (
            <Text style={[styles.reviewer, { color: c.textTertiary }]}>by {item.reviewedByName}</Text>
          )}
        </View>

        {/* Approval / rejection reason visible on selection */}
        {isSelected && (
          <View style={[styles.reasonBox, { borderTopColor: c.surfaceVariant }]}>
            {item.status === 'approved' && item.approvalReason && (
              <View style={[styles.reasonSection, { backgroundColor: '#22c55e11' }]}>
                <Text style={[styles.reasonLabel, { color: '#15803d' }]}>Approval Reason</Text>
                <Text style={[styles.reasonText, { color: '#166534' }]}>{item.approvalReason}</Text>
              </View>
            )}
            {item.status === 'rejected' && item.rejectionReason && (
              <View style={[styles.reasonSection, { backgroundColor: '#ef444411' }]}>
                <Text style={[styles.reasonLabel, { color: '#b91c1c' }]}>Rejection Reason</Text>
                <Text style={[styles.reasonText, { color: '#991b1b' }]}>{item.rejectionReason}</Text>
              </View>
            )}
            {item.status === 'held' && item.heldReason && (
              <View style={[styles.reasonSection, { backgroundColor: '#f59e0b11' }]}>
                <Text style={[styles.reasonLabel, { color: '#b45309' }]}>Hold Reason</Text>
                <Text style={[styles.reasonText, { color: '#92400e' }]}>{item.heldReason}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.viewBtn]}
              onPress={() => nav.navigate('AdminQuestionDetail', { questionId: item.id })}
            >
              <Text style={styles.viewBtnText}>View Full Details</Text>
              <Ionicons name="chevron-forward" size={14} color="#8b5cf6" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const countBadge = Object.entries(activeFilters).filter(([k, v]) => {
    if (k === 'sortBy') return v !== 'reviewedAt:DESC';
    return v && v.trim().length > 0;
  }).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Processed</Text>
        <Text style={[styles.count, { color: c.textSecondary }]}>{total} total</Text>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: countBadge > 0 ? c.primary + '18' : c.surfaceVariant }]}
          onPress={() => setFilterVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options" size={18} color={countBadge > 0 ? c.primary : c.textSecondary} />
          {countBadge > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.filterBadgeText}>{countBadge}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? null : (
              <>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No processed questions</Text>
                <Text style={[styles.emptyMsg, { color: c.textSecondary }]}>
                  Approved, rejected, and held questions will appear here
                </Text>
              </>
            )}
          </View>
        }
      />

      <AdminFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={FILTERS}
        active={activeFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        title="Filter Processed"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing5,
    paddingBottom: tokens.spacing3,
    gap: tokens.spacing2,
  },
  screenTitle: { fontSize: 22, fontWeight: '800' },
  count: { fontSize: 13 },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: tokens.spacing1,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  list: { padding: tokens.spacing5, paddingTop: 0, gap: tokens.spacing3 },
  card: { borderRadius: tokens.radiusLg, padding: tokens.spacing4 },
  heldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing2,
    paddingVertical: 4,
    marginBottom: tokens.spacing2,
  },
  heldBannerText: {
    fontSize: 11,
    color: '#b45309',
    fontStyle: 'italic',
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing1 },
  cropType: { fontSize: 12, fontWeight: '700' },
  separator: { fontSize: 12 },
  state: { fontSize: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  questionText: { fontSize: 14, lineHeight: 20, marginBottom: tokens.spacing3 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  submitter: { fontSize: 12 },
  date: { fontSize: 11, marginTop: 2 },
  reviewer: { fontSize: 11 },
  reasonBox: {
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing3,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing2,
  },
  reasonSection: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: tokens.spacing2,
  },
  viewBtnText: {
    color: '#8b5cf6',
    fontWeight: '700',
    fontSize: 13,
  },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
});