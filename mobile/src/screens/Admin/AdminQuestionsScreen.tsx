import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
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
  pending: '#f59e0b',
  ai_review: '#8b5cf6',
  human_review: '#ec4899',
  approved: '#22c55e',
  rejected: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  ai_review: 'AI Review',
  human_review: 'Human Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending',      label: 'Pending' },
  { value: 'ai_review',    label: 'AI Review' },
  { value: 'human_review', label: 'Manual' },
  { value: 'approved',     label: 'Approved' },
  { value: 'rejected',     label: 'Rejected' },
];

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'submittedAt:DESC',  label: 'Newest First' },
  { value: 'submittedAt:ASC',   label: 'Oldest First' },
  { value: 'aiConfidenceScore:DESC', label: 'AI Confidence ↓' },
  { value: 'aiConfidenceScore:ASC',  label: 'AI Confidence ↑' },
  { value: 'state:ASC',              label: 'State A→Z' },
];

interface QueueItem {
  id: string;
  questionText: string;
  language: string;
  domainCategory: string;
  cropType: string;
  state: string;
  mediaType: string;
  status: string;
  aiConfidenceScore: number | null;
  submittedAt: string;
  user: { id: string; name: string; mobileNumber: string } | null;
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
  sortBy: 'submittedAt:DESC',
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
  if (sortBy && sortBy !== 'submittedAt') params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return params;
}

export function AdminQuestionsScreen() {
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
  const [processing, setProcessing] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });

  const fetch = useCallback(async (pageNum = 1, refresh = false, filters: ActiveFilters = activeFilters) => {
    try {
      const params = buildQueryParams(filters, pageNum);
      const res = await adminApi.getReviewQueue(params);
      const data = res.data;
      const newItems: QueueItem[] = data.items ?? [];
      setItems((prev) => (refresh ? newItems : [...prev, ...newItems]));
      setTotal(data.total ?? 0);
      setHasMore(newItems.length === 20);
      setPage(pageNum);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load review queue'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilters]);

  useEffect(() => { fetch(1, true, activeFilters); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await fetch(1, true, activeFilters);
  }

  async function loadMore() {
    if (!hasMore || loading) return;
    await fetch(page + 1, false, activeFilters);
  }

  function handleApplyFilters(filters: ActiveFilters) {
    setActiveFilters(filters);
    setPage(1);
    setItems([]);
    setLoading(true);
    fetch(1, true, filters);
  }

  function handleResetFilters() {
    setActiveFilters({ ...EMPTY_FILTERS });
    setPage(1);
    setItems([]);
    setLoading(true);
    fetch(1, true, EMPTY_FILTERS);
  }

  async function handleAction(id: string, action: 'approve' | 'reject') {
    if (action === 'reject') {
      Alert.prompt(
        'Reject Question',
        'Enter optional rejection reason:',
        async (reason) => { await doAction(id, action, reason ?? undefined); },
        'plain-text',
      );
      return;
    }
    await doAction(id, action, undefined);
  }

  async function doAction(id: string, action: 'approve' | 'reject', reason?: string) {
    setProcessing(id);
    try {
      await adminApi.reviewQuestion(id, { action, reason });
      setItems((prev) => prev.filter((q) => q.id !== id));
      showToast(`Question ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
    } catch (e) {
      showToast(getErrorMessage(e, `Failed to ${action}`), 'error');
    } finally {
      setProcessing(null);
    }
  }

  function activeFilterCount(): number {
    return Object.entries(activeFilters).filter(([k, v]) => {
      if (k === 'sortBy') return v !== 'submittedAt:DESC';
      return v && v.trim().length > 0;
    }).length;
  }

  function renderItem({ item }: { item: QueueItem }) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <Text style={[styles.cropType, { color: c.primary }]}>{item.cropType}</Text>
            <Text style={[styles.separator, { color: c.textTertiary }]}>·</Text>
            <Text style={[styles.state, { color: c.textSecondary }]}>{item.state}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
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
              {new Date(item.submittedAt).toLocaleDateString('en-IN')}
            </Text>
          </View>
          {item.aiConfidenceScore != null && (
            <Text style={[styles.aiScore, { color: c.textTertiary }]}>
              AI: {item.aiConfidenceScore}%
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#22c55e22' }]}
            onPress={() => handleAction(item.id, 'approve')}
            disabled={processing === item.id}
          >
            {processing === item.id ? (
              <ActivityIndicator size="small" color="#22c55e" />
            ) : (
              <Text style={styles.btnApprove}>✓ Approve</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#ef444422' }]}
            onPress={() => handleAction(item.id, 'reject')}
            disabled={processing === item.id}
          >
            <Text style={styles.btnReject}>✗ Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#8b5cf622' }]}
            onPress={() => nav.navigate('AdminQuestionDetail', { questionId: item.id })}
          >
            <Text style={styles.btnView}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const countBadge = activeFilterCount();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Question Review</Text>
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
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              {loading ? '' : 'No questions match your filters'}
            </Text>
            {!loading && (
              <Text style={[styles.emptyMsg, { color: c.textSecondary }]}>Try adjusting the filter criteria</Text>
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
        title="Filter Questions"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: tokens.spacing5, paddingBottom: tokens.spacing3, gap: tokens.spacing2 },
  screenTitle: { fontSize: 22, fontWeight: '800' },
  count: { fontSize: 13 },
  filterBtn: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginLeft: tokens.spacing1,
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  list: { padding: tokens.spacing5, paddingTop: 0, gap: tokens.spacing3 },
  card: { borderRadius: tokens.radiusLg, padding: tokens.spacing4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing1 },
  cropType: { fontSize: 12, fontWeight: '700' },
  separator: { fontSize: 12 },
  state: { fontSize: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  questionText: { fontSize: 14, lineHeight: 20, marginBottom: tokens.spacing3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: tokens.spacing3 },
  submitter: { fontSize: 12 },
  date: { fontSize: 11, marginTop: 2 },
  aiScore: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: tokens.spacing2 },
  btn: { flex: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing2, alignItems: 'center' },
  btnApprove: { color: '#22c55e', fontWeight: '700', fontSize: 13 },
  btnReject: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  btnView: { color: '#8b5cf6', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, marginTop: 4 },
});