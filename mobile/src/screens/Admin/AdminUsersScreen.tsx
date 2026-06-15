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

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const STATUS_COLORS: Record<string, string> = {
  verified: '#22c55e',
  pending: '#f59e0b',
  manual_review: '#8b5cf6',
  suspended: '#ef4444',
  banned: '#991b1b',
};

const CATEGORY_LABELS: Record<string, string> = {
  farmer: 'Farmer',
  fpo: 'FPO',
  student: 'Student',
  volunteer: 'Volunteer',
  ngo: 'NGO',
};

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

  const fetch = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      const res = await adminApi.listUsers({ page: pageNum, limit: 20 });
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
  }, []);

  useEffect(() => { fetch(1, true); }, [fetch]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch(1, true);
  }

  async function loadMore() {
    if (!hasMore || loading) return;
    await fetch(page + 1, false);
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
          <View>
            <Text style={[styles.userName, { color: c.text }]}>
              {item.name || item.mobileNumber}
            </Text>
            <Text style={[styles.userMeta, { color: c.textSecondary }]}>
              {item.mobileNumber} · {CATEGORY_LABELS[item.category] ?? item.category}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {item.verificationStatus}
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Users</Text>
        <Text style={[styles.count, { color: c.textSecondary }]}>{total} total</Text>
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
            <Text style={[styles.emptyTitle, { color: c.text }]}>No users found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: tokens.spacing5, paddingBottom: tokens.spacing3 },
  screenTitle: { fontSize: 22, fontWeight: '800' },
  count: { fontSize: 13 },
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
});