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
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminFilterModal, FilterOption, ActiveFilters } from '../../components/AdminFilterModal';
import { WalletDetailModal } from '../../components/WalletDetailModal';
import { WalletAdjustModal } from '../../components/WalletAdjustModal';
import { INDIAN_STATES } from '../../utils/constants';

const STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  processing: '#8b5cf6',
  completed:  '#22c55e',
  failed:     '#ef4444',
};

const WITHDRAWAL_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed',  label: 'Completed' },
  { value: 'failed',     label: 'Failed' },
];

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'createdAt:DESC', label: 'Newest First' },
  { value: 'createdAt:ASC',  label: 'Oldest First' },
  { value: 'amount:DESC',    label: 'Highest Amount' },
  { value: 'amount:ASC',     label: 'Lowest Amount' },
  { value: 'processedAt:DESC', label: 'Recently Processed' },
];

interface WithdrawalItem {
  id: string;
  amount: number;
  payoutMethod: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  failureReason: string | null;
  user: { id: string; name: string; mobileNumber: string; state: string } | null;
}

const FILTERS: FilterOption[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Name or mobile number…',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: WITHDRAWAL_STATUS_OPTIONS,
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
  sortBy: 'createdAt:DESC',
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
  if (sortBy && sortBy !== 'createdAt') params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return params;
}

export function AdminWithdrawalsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [walletModal, setWalletModal] = useState<{ userId: string; userName: string } | null>(null);
  const [walletAdjustVisible, setWalletAdjustVisible] = useState(false);

  const fetch = useCallback(async (pageNum = 1, refresh = false, filters: ActiveFilters = activeFilters) => {
    try {
      const params = buildQueryParams(filters, pageNum);
      const res = await adminApi.listWithdrawals(params);
      const data = res.data;
      const newItems: WithdrawalItem[] = data.items ?? [];
      setItems((prev) => (refresh ? newItems : [...prev, ...newItems]));
      setTotal(data.total ?? 0);
      setHasMore(newItems.length === 20);
      setPage(pageNum);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load withdrawals'), 'error');
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

  function handleAction(id: string, action: 'approve' | 'reject') {
    if (action === 'reject') {
      Alert.prompt(
        'Reject Withdrawal',
        'Enter rejection reason (optional):',
        async (reason) => { await doAction(id, action, reason ?? undefined); },
        'plain-text',
      );
      return;
    }
    doAction(id, action, undefined);
  }

  async function doAction(id: string, action: 'approve' | 'reject', reason?: string) {
    setProcessingId(id);
    try {
      await adminApi.processWithdrawal(id, { action, failureReason: reason });
      setItems((prev) => prev.filter((w) => w.id !== id));
      showToast(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
    } catch (e) {
      showToast(getErrorMessage(e, `Failed to ${action}`), 'error');
    } finally {
      setProcessingId(null);
    }
  }

  function activeFilterCount(): number {
    return Object.entries(activeFilters).filter(([k, v]) => {
      if (k === 'sortBy') return v !== 'createdAt:DESC';
      return v && v.trim().length > 0;
    }).length;
  }

  function renderItem({ item }: { item: WithdrawalItem }) {
    const statusColor = STATUS_COLORS[item.status] ?? c.textTertiary;
    return (
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: c.text }]}>
              {item.user?.name ?? item.user?.mobileNumber ?? 'Unknown user'}
            </Text>
            <Text style={[styles.userMeta, { color: c.textSecondary }]}>
              {item.user?.mobileNumber ?? ''} · {item.payoutMethod}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={[styles.amountLabel, { color: c.textSecondary }]}>Amount</Text>
          <Text style={[styles.amountValue, { color: c.text }]}>
            ₹{Number(item.amount).toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.date, { color: c.textTertiary }]}>
            Requested {new Date(item.createdAt).toLocaleDateString('en-IN')}
          </Text>
          {item.processedAt && (
            <Text style={[styles.date, { color: c.textTertiary }]}>
              Processed {new Date(item.processedAt).toLocaleDateString('en-IN')}
            </Text>
          )}
        </View>

        {item.status === 'pending' && isSuperAdmin && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#22c55e22' }]}
              onPress={() => handleAction(item.id, 'approve')}
              disabled={processingId === item.id}
            >
              {processingId === item.id ? (
                <ActivityIndicator size="small" color="#22c55e" />
              ) : (
                <Text style={styles.btnApprove}>✓ Approve</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#ef444422' }]}
              onPress={() => handleAction(item.id, 'reject')}
              disabled={processingId === item.id}
            >
              <Text style={styles.btnReject}>✗ Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.failureReason && (
          <Text style={[styles.failureReason, { color: c.error }]}>
            Reason: {item.failureReason}
          </Text>
        )}

        {item.user?.id && (
          <TouchableOpacity
            style={[styles.walletBtn, { borderColor: c.border }]}
            onPress={() => setWalletModal({ userId: item.user!.id, userName: item.user!.name ?? item.user!.mobileNumber ?? '' })}
          >
            <Ionicons name="wallet-outline" size={14} color={c.primary} />
            <Text style={[styles.walletBtnText, { color: c.primary }]}>View Wallet</Text>
          </TouchableOpacity>
        )}
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
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Withdrawals</Text>
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
              {loading ? '' : 'No withdrawals match your filters'}
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
        title="Filter Withdrawals"
      />

      {walletModal && (
        <WalletDetailModal
          walletId=""
          userId={walletModal.userId}
          userName={walletModal.userName}
          visible={!!walletModal}
          onClose={() => setWalletModal(null)}
          isSuperAdmin={isSuperAdmin}
          onAdjustPress={() => setWalletAdjustVisible(true)}
        />
      )}

      <WalletAdjustModal
        visible={walletAdjustVisible && !!walletModal}
        userId={walletModal?.userId ?? ''}
        userName={walletModal?.userName ?? ''}
        onClose={() => setWalletAdjustVisible(false)}
        onAdjusted={() => setWalletAdjustVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: tokens.spacing3 },
  userName: { fontSize: 15, fontWeight: '700' },
  userMeta: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing2 },
  amountLabel: { fontSize: 13 },
  amountValue: { fontSize: 18, fontWeight: '800' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: tokens.spacing3 },
  date: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: tokens.spacing2 },
  btn: { flex: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing2, alignItems: 'center' },
  btnApprove: { color: '#22c55e', fontWeight: '700', fontSize: 13 },
  btnReject: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  failureReason: { fontSize: 12, marginTop: tokens.spacing2 },
  walletBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing2,
    marginTop: tokens.spacing2, gap: 4,
  },
  walletBtnText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, marginTop: 4 },
});