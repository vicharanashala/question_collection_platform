import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import { adminApi, getErrorMessage } from '../api/client';
import { tokens } from '../utils/theme';
import type { WalletSummary, Transaction } from '../types';

const TX_TYPE_COLORS: Record<string, string> = {
  credit: '#22c55e',
  debit:  '#ef4444',
};

const TX_STATUS_COLORS: Record<string, string> = {
  pending:   '#f59e0b',
  completed: '#22c55e',
  failed:    '#ef4444',
  reversed:  '#9ca3af',
  rejected:  '#ef4444',
};

const TX_SOURCE_LABELS: Record<string, string> = {
  reward:     'Reward',
  withdrawal: 'Withdrawal',
  refund:     'Refund',
  adjustment: 'Adjustment',
};

const WD_STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  processing: '#8b5cf6',
  completed:  '#22c55e',
  failed:     '#ef4444',
  cancelled:  '#9ca3af',
};

const VERIFICATION_COLORS: Record<string, string> = {
  verified:    '#22c55e',
  pending:     '#f59e0b',
  unverified:  '#9ca3af',
  suspended:   '#ef4444',
  banned:      '#ef4444',
};

interface WalletDetailModalProps {
  walletId: string;
  userId: string;
  userName?: string;
  visible: boolean;
  onClose: () => void;
  isSuperAdmin?: boolean;
}

interface TxPage {
  items: Transaction[];
  total: number;
  page: number;
  pages: number;
}

interface WdPage {
  items: WithdrawalItem[];
  total: number;
  page: number;
  pages: number;
}

interface WithdrawalItem {
  id: string;
  amount: number;
  payoutMethod: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  failureReason: string | null;
}

export function WalletDetailModal({ walletId, userId, userName, visible, onClose, isSuperAdmin }: WalletDetailModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Transaction tab
  const [txTab, setTxTab] = useState<'tx' | 'wd'>('tx');
  const [txData, setTxData] = useState<TxPage | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadingMoreTx, setLoadingMoreTx] = useState(false);
  const [txPage, setTxPage] = useState(1);

  // Withdrawal tab
  const [wdData, setWdData] = useState<WdPage | null>(null);
  const [loadingWd, setLoadingWd] = useState(false);
  const [loadingMoreWd, setLoadingMoreWd] = useState(false);
  const [wdPage, setWdPage] = useState(1);

  const limit = 30;

  const fetchWallet = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const res = await adminApi.getUserWallet(userId);
      setWallet(res.data);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load wallet'), 'error');
    } finally {
      setLoadingWallet(false);
    }
  }, [userId]);

  const fetchTransactions = useCallback(async (page = 1, append = false) => {
    if (page === 1) setLoadingTx(true); else setLoadingMoreTx(true);
    try {
      const res = await adminApi.getUserTransactions(userId, { page, limit });
      const data = res.data as TxPage;
      setTxData((prev) => append ? { ...data, items: [...(prev?.items ?? []), ...data.items] } : data);
      setTxPage(page);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load transactions'), 'error');
    } finally {
      setLoadingTx(false);
      setLoadingMoreTx(false);
    }
  }, [userId]);

  const fetchWithdrawals = useCallback(async (page = 1, append = false) => {
    if (page === 1) setLoadingWd(true); else setLoadingMoreWd(true);
    try {
      const res = await adminApi.getUserWithdrawals(userId, { page, limit });
      const data = res.data as WdPage;
      setWdData((prev) => append ? { ...data, items: [...(prev?.items ?? []), ...data.items] } : data);
      setWdPage(page);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load withdrawals'), 'error');
    } finally {
      setLoadingWd(false);
      setLoadingMoreWd(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setTxTab('tx');
      setTxData(null);
      setWdData(null);
      setTxPage(1);
      setWdPage(1);
      fetchWallet();
      fetchTransactions(1);
      fetchWithdrawals(1);
    }
  }, [visible, userId]);

  const balance = wallet?.balance ?? 0;
  const totalEarned = wallet?.totalEarned ?? 0;
  const totalWithdrawn = wallet?.totalWithdrawn ?? 0;
  const user = wallet?.user;

  function renderTxRow(tx: Transaction, idx: number) {
    const isCredit = tx.type === 'credit';
    const color = TX_TYPE_COLORS[tx.type] ?? c.text;
    return (
      <View key={tx.id} style={[styles.txRow, { borderBottomColor: c.border }]}>
        <View style={styles.txLeft}>
          <View style={[styles.txIcon, { backgroundColor: color + '15' }]}>
            <Ionicons
              name={isCredit ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={color}
            />
          </View>
          <View style={styles.txInfo}>
            <Text style={[styles.txSource, { color: c.text }]}>
              {TX_SOURCE_LABELS[tx.source] ?? tx.source}
            </Text>
            <Text style={[styles.txDate, { color: c.textTertiary }]}>
              {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            {tx.description && (
              <Text style={[styles.txDesc, { color: c.textSecondary }]} numberOfLines={1}>
                {tx.description}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color }]}>
            {isCredit ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: (TX_STATUS_COLORS[tx.status] ?? '#9ca3af') + '20' }]}>
            <Text style={[styles.statusPillText, { color: TX_STATUS_COLORS[tx.status] ?? '#9ca3af' }]}>
              {tx.status}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function renderWdRow(wd: WithdrawalItem) {
    const color = WD_STATUS_COLORS[wd.status] ?? c.textTertiary;
    return (
      <View key={wd.id} style={[styles.txRow, { borderBottomColor: c.border }]}>
        <View style={styles.txLeft}>
          <View style={[styles.txIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name="cash-outline" size={14} color={color} />
          </View>
          <View style={styles.txInfo}>
            <Text style={[styles.txSource, { color: c.text }]}>
              {wd.payoutMethod.charAt(0).toUpperCase() + wd.payoutMethod.slice(1)}
            </Text>
            <Text style={[styles.txDate, { color: c.textTertiary }]}>
              {new Date(wd.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            <Text style={[styles.txId, { color: c.textTertiary }]} numberOfLines={1}>
              {wd.id}
            </Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: c.text }]}>
            ₹{Number(wd.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
            <Text style={[styles.statusPillText, { color }]}>
              {wd.status}
            </Text>
          </View>
          {wd.failureReason && (
            <Text style={[styles.wdFailure, { color: '#ef4444' }]} numberOfLines={1}>
              {wd.failureReason}
            </Text>
          )}
        </View>
      </View>
    );
  }

  const txItems = txData?.items ?? [];
  const wdItems = wdData?.items ?? [];
  const hasMoreTx = txData ? txPage < txData.pages : false;
  const hasMoreWd = wdData ? wdPage < wdData.pages : false;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          {/* Handle + Header */}
          <View style={[styles.handleBar, { backgroundColor: c.border }]} />
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Wallet Details</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── User + Balance Hero ───────────────────────────────── */}
            <View style={[styles.heroCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.heroTop}>
                <View style={styles.heroUser}>
                  <View style={[styles.avatar, { backgroundColor: c.primary + '18' }]}>
                    <Text style={[styles.avatarText, { color: c.primary }]}>
                      {(user?.name ?? userName ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: c.text }]}>
                      {user?.name ?? userName ?? '—'}
                    </Text>
                    <Text style={[styles.userMobile, { color: c.textSecondary }]}>
                      {user?.mobileNumber ?? '—'}
                    </Text>
                    <View style={styles.badgeRow}>
                      {user?.category && (
                        <View style={[styles.badge, { backgroundColor: c.surfaceVariant }]}>
                          <Text style={[styles.badgeText, { color: c.textSecondary }]}>{user.category}</Text>
                        </View>
                      )}
                      {user?.verificationStatus && (
                        <View style={[styles.badge, { backgroundColor: (VERIFICATION_COLORS[user.verificationStatus] ?? '#9ca3af') + '20' }]}>
                          <Text style={[styles.badgeText, { color: VERIFICATION_COLORS[user.verificationStatus] ?? '#9ca3af' }]}>
                            {user.verificationStatus}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.balanceBlock}>
                  <Text style={[styles.balanceLabel, { color: c.textTertiary }]}>BALANCE</Text>
                  <Text style={[styles.balanceAmount, { color: c.primary }]}>
                    ₹{Number(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <View style={[styles.statsRow, { borderTopColor: c.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: c.textTertiary }]}>Total Earned</Text>
                  <Text style={[styles.statValue, { color: '#22c55e' }]}>
                    ₹{Number(totalEarned).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: c.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: c.textTertiary }]}>Withdrawn</Text>
                  <Text style={[styles.statValue, { color: '#ef4444' }]}>
                    ₹{Number(totalWithdrawn).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Tab Switcher ─────────────────────────────────────── */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, txTab === 'tx' ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => setTxTab('tx')}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={txTab === 'tx' ? '#fff' : c.textSecondary}
                />
                <Text style={[styles.tabText, { color: txTab === 'tx' ? '#fff' : c.textSecondary }]}>
                  Transactions
                  {txItems.length > 0 && ` (${txData?.total ?? txItems.length})`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, txTab === 'wd' ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => setTxTab('wd')}
              >
                <Ionicons
                  name="cash-outline"
                  size={14}
                  color={txTab === 'wd' ? '#fff' : c.textSecondary}
                />
                <Text style={[styles.tabText, { color: txTab === 'wd' ? '#fff' : c.textSecondary }]}>
                  Withdrawals
                  {wdItems.length > 0 && ` (${wdData?.total ?? wdItems.length})`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Transaction List ─────────────────────────────────── */}
            {txTab === 'tx' && (
              <View style={[styles.listCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                {loadingWallet || (loadingTx && txItems.length === 0) ? (
                  <View style={styles.loadingCenter}>
                    <ActivityIndicator size="small" color={c.primary} />
                  </View>
                ) : txItems.length === 0 ? (
                  <View style={styles.emptyCenter}>
                    <Ionicons name="receipt-outline" size={36} color={c.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: c.text }]}>No transactions yet</Text>
                  </View>
                ) : (
                  <>
                    {txItems.map((tx, i) => renderTxRow(tx, i))}
                    {hasMoreTx && (
                      <TouchableOpacity
                        style={styles.loadMoreBtn}
                        onPress={() => fetchTransactions(txPage + 1, true)}
                        disabled={loadingMoreTx}
                      >
                        {loadingMoreTx
                          ? <ActivityIndicator size="small" color={c.primary} />
                          : <Text style={[styles.loadMoreText, { color: c.primary }]}>Load More</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* ── Withdrawal List ──────────────────────────────────── */}
            {txTab === 'wd' && (
              <View style={[styles.listCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                {loadingWallet || (loadingWd && wdItems.length === 0) ? (
                  <View style={styles.loadingCenter}>
                    <ActivityIndicator size="small" color={c.primary} />
                  </View>
                ) : wdItems.length === 0 ? (
                  <View style={styles.emptyCenter}>
                    <Ionicons name="cash-outline" size={36} color={c.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: c.text }]}>No withdrawals yet</Text>
                  </View>
                ) : (
                  <>
                    {wdItems.map((wd) => renderWdRow(wd))}
                    {hasMoreWd && (
                      <TouchableOpacity
                        style={styles.loadMoreBtn}
                        onPress={() => fetchWithdrawals(wdPage + 1, true)}
                        disabled={loadingMoreWd}
                      >
                        {loadingMoreWd
                          ? <ActivityIndicator size="small" color={c.primary} />
                          : <Text style={[styles.loadMoreText, { color: c.primary }]}>Load More</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flex: 1,
    borderTopLeftRadius: tokens.radiusXl,
    borderTopRightRadius: tokens.radiusXl,
    maxHeight: '92%',
    marginTop: '4%',
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center',
    marginTop: tokens.spacing3, marginBottom: tokens.spacing2,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: tokens.spacing5, paddingBottom: tokens.spacing3,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1, minHeight: 0 },
  bodyContent: { padding: tokens.spacing5, paddingTop: 0, gap: tokens.spacing4 },

  // Hero
  heroCard: {
    borderWidth: 1, borderRadius: tokens.radiusLg, padding: tokens.spacing4,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroUser: { flexDirection: 'row', gap: tokens.spacing3, flex: 1 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start',
  },
  avatarText: { fontSize: 20, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  userMobile: { fontSize: 12, marginBottom: tokens.spacing2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: {
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  balanceBlock: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.08, marginBottom: 2 },
  balanceAmount: { fontSize: 22, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row', marginTop: tokens.spacing4, paddingTop: tokens.spacing3,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '700' },

  // Tabs
  tabRow: { flexDirection: 'row', gap: tokens.spacing2 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: tokens.spacing2, borderRadius: tokens.radiusMd,
    borderWidth: 1, gap: tokens.spacing1,
  },
  tabText: { fontSize: 13, fontWeight: '600' },

  // List
  listCard: { borderWidth: 1, borderRadius: tokens.radiusLg, overflow: 'hidden' },
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: tokens.spacing3,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3, flex: 1 },
  txIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start',
  },
  txInfo: { flex: 1 },
  txSource: { fontSize: 14, fontWeight: '600', marginBottom: 1 },
  txDate: { fontSize: 11 },
  txDesc: { fontSize: 11, marginTop: 1 },
  txId: { fontSize: 10, fontFamily: 'monospace', marginTop: 1 },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  statusPill: { borderRadius: 12, paddingHorizontal: 6, paddingVertical: 1 },
  statusPillText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  wdFailure: { fontSize: 10, marginTop: 1, maxWidth: 120 },
  loadMoreBtn: { padding: tokens.spacing3, alignItems: 'center' },
  loadMoreText: { fontSize: 13, fontWeight: '600' },
  loadingCenter: { padding: tokens.spacing6, alignItems: 'center' },
  emptyCenter: { padding: tokens.spacing6, alignItems: 'center', gap: tokens.spacing2 },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
});