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
  verified:      '#22c55e',
  pending:       '#f59e0b',
  manual_review: '#8b5cf6',
  suspended:     '#ef4444',
  banned:        '#991b1b',
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending',       label: 'Pending' },
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'verified',      label: 'Verified' },
  { value: 'suspended',     label: 'Suspended' },
  { value: 'banned',        label: 'Banned' },
];

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'farmer',    label: 'Farmer' },
  { value: 'fpo',       label: 'FPO' },
  { value: 'student',   label: 'Student' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'ngo',       label: 'NGO' },
];

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'createdAt:DESC',          label: 'Newest First' },
  { value: 'createdAt:ASC',           label: 'Oldest First' },
  { value: 'name:ASC',                label: 'Name A→Z' },
  { value: 'name:DESC',               label: 'Name Z→A' },
  { value: 'state:ASC',               label: 'State A→Z' },
  { value: 'verificationStatus:ASC',  label: 'Status A→Z' },
];

interface UserItem {
  id: string;
  mobileNumber: string;
  name: string;
  category: string;
  state: string;
  district: string;
  verificationStatus: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
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
    label: 'Verification Status',
    type: 'select',
    options: STATUS_OPTIONS,
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: CATEGORY_OPTIONS,
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
];

const EMPTY_FILTERS: ActiveFilters = {
  search: '',
  status: '',
  category: '',
  state: '',
  sortBy: 'createdAt:DESC',
};

function buildQueryParams(active: ActiveFilters, page: number): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit: 20 };
  if (active.search) params.search = active.search;
  if (active.state) params.state = active.state;
  if (active.category) params.category = active.category;
  if (active.status) params.status = active.status;
  const sortBy = active.sortBy?.split(':')[0];
  const sortOrder = active.sortBy?.split(':')[1];
  if (sortBy && sortBy !== 'createdAt') params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return params;
}

export function AdminUsersScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation<Nav>();
  const { showToast } = useToast();

  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });

  const fetch = useCallback(async (pageNum = 1, refresh = false, filters: ActiveFilters = activeFilters) => {
    try {
      const params = buildQueryParams(filters, pageNum);
      const res = await adminApi.listUsers(params);
      const data = res.data;
      const newItems: UserItem[] = data.items ?? [];
      setItems((prev) => (refresh ? newItems : [...prev, ...newItems]));
      setTotal(data.total ?? 0);
      setHasMore(newItems.length === 20);
      setPage(pageNum);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load users'), 'error');
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

  function activeFilterCount(): number {
    return Object.entries(activeFilters).filter(([k, v]) => {
      if (k === 'sortBy') return v !== 'createdAt:DESC';
      return v && v.trim().length > 0;
    }).length;
  }

  function renderItem({ item }: { item: UserItem }) {
    const statusColor = STATUS_COLORS[item.verificationStatus] ?? c.textTertiary;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.surface }]}
        onPress={() => nav.navigate('AdminUserDetail', { userId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: c.text }]}>
              {item.name || item.mobileNumber}
            </Text>
            <Text style={[styles.userMeta, { color: c.textSecondary }]}>
              {item.mobileNumber} · {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {item.verificationStatus.replace('_', ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={[styles.location, { color: c.textTertiary }]}>
            {item.district}, {item.state}
          </Text>
          <Text style={[styles.role, { color: item.role === 'admin' || item.role === 'super_admin' ? c.primary : c.textTertiary }]}>
            {item.role}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const countBadge = activeFilterCount();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Users</Text>
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
              {loading ? '' : 'No users match your filters'}
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
        title="Filter Users"
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
  list: { padding: tokens.spacing5, paddingTop: 0, gap: tokens.spacing2 },
  card: { borderRadius: tokens.radiusMd, padding: tokens.spacing4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 15, fontWeight: '700' },
  userMeta: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: tokens.spacing3 },
  location: { fontSize: 12 },
  role: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, marginTop: 4 },
});