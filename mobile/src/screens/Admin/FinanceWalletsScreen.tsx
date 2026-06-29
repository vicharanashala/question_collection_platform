import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { WalletDetailModal } from '../../components/WalletDetailModal';
import { AdminFilterModal, FilterOption, ActiveFilters } from '../../components/AdminFilterModal';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { WalletSummary } from '../../types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const EMPTY_FILTERS: ActiveFilters = {
  search: '',
  state: '',
  verificationStatus: '',
  sortBy: 'createdAt:DESC',
};

const FILTERS: FilterOption[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Name, mobile, district…',
  },
  {
    key: 'state',
    label: 'State',
    type: 'select',
    options: [
      { value: '', label: 'All States' },
      { value: 'Maharashtra', label: 'Maharashtra' },
      { value: 'Karnataka', label: 'Karnataka' },
      { value: 'Rajasthan', label: 'Rajasthan' },
      { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
      { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
      { value: 'Gujarat', label: 'Gujarat' },
      { value: 'Tamil Nadu', label: 'Tamil Nadu' },
      { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
      { value: 'Telangana', label: 'Telangana' },
      { value: 'Bihar', label: 'Bihar' },
      { value: 'West Bengal', label: 'West Bengal' },
      { value: 'Punjab', label: 'Punjab' },
      { value: 'Haryana', label: 'Haryana' },
      { value: 'Other', label: 'Other' },
    ],
  },
  {
    key: 'sortBy',
    label: 'Sort By',
    type: 'select',
    options: [
      { value: 'createdAt:DESC', label: 'Newest First' },
      { value: 'createdAt:ASC', label: 'Oldest First' },
      { value: 'balance:DESC', label: 'Highest Balance' },
      { value: 'balance:ASC', label: 'Lowest Balance' },
      { value: 'totalEarned:DESC', label: 'Most Earned' },
    ],
  },
];

function buildQueryParams(filters: ActiveFilters, page: number) {
  const { sortBy, ...rest } = filters as typeof filters & { sortBy?: string };
  const params: Record<string, string> = {
    page: String(page),
    limit: '20',
    ...Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v && (v as string).trim().length > 0),
    ),
  };
  if (sortBy) {
    const [field, order] = sortBy.split(':');
    params.sortBy = field;
    if (order) params.sortOrder = order;
  }
  return params;
}

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

interface WalletItem {
  id: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  user: {
    id: string;
    name: string;
    mobileNumber: string;
    category: string;
    verificationStatus: string;
    state: string;
    district?: string;
  } | null;
  createdAt: string;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function FinanceWalletsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation<Nav>();
  const { showToast } = useToast();

  const [items, setItems] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [walletModal, setWalletModal] = useState<{ userId: string; userName: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const fetch = useCallback(async (pageNum = 1, refresh = false, filters: ActiveFilters = activeFilters) => {
    try {
      const params = buildQueryParams(filters, pageNum);
      const res = await adminApi.getWallets(params);
      const data = res.data as { items: WalletItem[]; total: number };
      const newItems: WalletItem[] = data.items ?? [];
      setItems((prev) => (refresh ? newItems : [...prev, ...newItems]));
      setTotal(data.total ?? 0);
      setHasMore(newItems.length === 20);
      setPage(pageNum);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load wallets'), 'error');
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

  function handleSearch(text: string) {
    setSearchInput(text);
    const newFilters = { ...activeFilters, search: text };
    setActiveFilters(newFilters);
    setPage(1);
    setItems([]);
    setLoading(true);
    fetch(1, true, newFilters);
  }

  function activeFilterCount(): number {
    return Object.entries(activeFilters).filter(([k, v]) => {
      if (k === 'sortBy') return v !== 'createdAt:DESC';
      return v && v.trim().length > 0;
    }).length;
  }

  function renderItem({ item }: { item: WalletItem }) {
    const displayName = item.user?.name ?? item.user?.mobileNumber ?? 'Unknown';
    const statusColor =
      item.user?.verificationStatus === 'verified' ? '#22c55e' :
      item.user?.verificationStatus === 'pending' ? '#f59e0b' : '#9ca3af';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
        onPress={() => setWalletModal({
          userId: item.user?.id ?? '',
          userName: displayName,
        })}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: c.text }]}>{displayName}</Text>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <Text style={[styles.userMeta, { color: c.textSecondary }]}>
              {item.user?.mobileNumber ?? ''} · {item.user?.category ?? ''}
            </Text>
            <Text style={[styles.userMeta, { color: c.textTertiary }]}>
              {item.user?.state ?? ''}{item.user?.district ? ` · ${item.user.district}` : ''}
            </Text>
          </View>
          <View style={[styles.balanceBox, { backgroundColor: c.primary + '12' }]}>
            <Text style={[styles.balanceValue, { color: c.primary }]}>
              {formatINR(item.balance)}
            </Text>
            <Text style={[styles.balanceLabel, { color: c.mutedForeground }]}>Balance</Text>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: c.border }]}>
          <View style={styles.footerStat}>
            <Ionicons name="gift-outline" size={11} color={c.mutedForeground} />
            <Text style={[styles.footerText, { color: c.mutedForeground }]}>
              Earned: {formatINR(item.totalEarned)}
            </Text>
          </View>
          <View style={styles.footerStat}>
            <Ionicons name="send-outline" size={11} color={c.mutedForeground} />
            <Text style={[styles.footerText, { color: c.mutedForeground }]}>
              Withdrawn: {formatINR(item.totalWithdrawn)}
            </Text>
          </View>
          <View style={styles.footerStat}>
            <Ionicons name="wallet-outline" size={11} color={c.primary} />
            <Text style={[styles.footerText, { color: c.primary }]}>View</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const appliedCount = activeFilterCount();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        <Text style={[styles.screenTitle, { color: c.text }]}>Wallets</Text>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons name="options-outline" size={20} color={c.primary} />
          {appliedCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.filterBadgeText}>{appliedCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search name, mobile, district…"
          placeholderTextColor={c.mutedForeground}
          value={searchInput}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ── */}
      {loading && items.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="wallet-outline" size={40} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                {loading ? '' : 'No wallets match your filters'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loading && items.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={c.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* ── Filter modal ── */}
      <AdminFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={FILTERS}
        active={activeFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        title="Filter Wallets"
      />

      {/* ── Wallet detail modal ── */}
      {walletModal && (
        <WalletDetailModal
          walletId=""
          userId={walletModal.userId}
          userName={walletModal.userName}
          visible={!!walletModal}
          onClose={() => setWalletModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 18, fontWeight: '700' },
  filterBtn: { padding: tokens.spacing1 },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: tokens.spacing4,
    marginVertical: tokens.spacing2,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    borderRadius: 10,
    borderWidth: 1,
    gap: tokens.spacing2,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: tokens.spacing4, gap: tokens.spacing3 },
  card: {
    padding: tokens.spacing3,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '600' },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  userMeta: { fontSize: 12, marginTop: 2 },
  balanceBox: { alignItems: 'center', paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing2, borderRadius: 8 },
  balanceValue: { fontSize: 16, fontWeight: '700' },
  balanceLabel: { fontSize: 10, marginTop: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing3,
  },
  footerStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footerText: { fontSize: 11 },
  emptyWrap: { padding: tokens.spacing8, alignItems: 'center', gap: tokens.spacing2 },
  emptyText: { fontSize: 14 },
  footerLoader: { padding: tokens.spacing4, alignItems: 'center' },
});