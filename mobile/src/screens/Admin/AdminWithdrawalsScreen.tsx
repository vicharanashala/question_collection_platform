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
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#8b5cf6',
  completed: '#22c55e',
  failed: '#ef4444',
};

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

export function AdminWithdrawalsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation();
  const { showToast } = useToast();

  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetch = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      const res = await adminApi.listWithdrawals({ page: pageNum, limit: 20 });
      const data = res.data;
      const newItems: WithdrawalItem[] = data.items ?? [];
      setItems((prev) => (refresh ? newItems : [...prev, ...newItems]));
      setHasMore(newItems.length === 20);
      setPage(pageNum);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load withdrawals'), 'error');
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

  function handleAction(id: string, action: 'approve' | 'reject') {
    if (action === 'reject') {
      Alert.prompt(
        'Reject Withdrawal',
        'Enter rejection reason (optional):',
        async (reason) => {
          await doAction(id, action, reason ?? undefined);
        },
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

  function renderItem({ item }: { item: WithdrawalItem }) {
    const statusColor = STATUS_COLORS[item.status] ?? c.textTertiary;
    return (
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <View style={styles.cardTop}>
          <View>
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

        {item.status === 'pending' && (
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
      </View>
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
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Withdrawals</Text>
        <Text style={[styles.count, { color: c.textSecondary }]}>{items.length} shown</Text>
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
            <Text style={[styles.emptyTitle, { color: c.text }]}>No withdrawals</Text>
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
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});