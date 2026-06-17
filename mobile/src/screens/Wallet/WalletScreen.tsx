import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Button } from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import { TooltipIcon } from '../../components/TooltipIcon';
import { EmptyState } from '../../components/Loading';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { walletApi, questionApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { Transaction } from '../../types';

// ─── Filter options ───────────────────────────────────────────────────────────

type TxType = 'all' | 'credit' | 'debit';
type TxSource = 'all' | 'reward' | 'withdrawal' | 'refund';
type TxStatus = 'all' | 'completed' | 'pending' | 'failed' | 'reversed';


// ─── Transaction Detail Modal ─────────────────────────────────────────────────

interface TxDetailProps {
  tx: Transaction | null;
  visible: boolean;
  onClose: () => void;
  statusColors: Record<string, string>;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}

function TxDetailModal({ tx, visible, onClose, statusColors, c, onRevoke }: TxDetailProps & { onRevoke?: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [question, setQuestion] = useState<Record<string, unknown> | null>(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (!tx || !visible) { setQuestion(null); return; }
    // For reward transactions, fetch the referenced question
    if (tx.source === 'reward' && tx.referenceId) {
      setLoadingQ(true);
      questionApi.get(tx.referenceId as string)
        .then((res) => setQuestion(res.data as Record<string, unknown>))
        .catch(() => setQuestion(null))
        .finally(() => setLoadingQ(false));
    } else {
      setQuestion(null);
    }
  }, [tx, visible]);

  async function handleRevokeWithdrawal() {
    if (!tx?.referenceId) return;
    setRevoking(true);
    try {
      await walletApi.cancelWithdrawal(tx.referenceId as string);
      showToast(t('wallet.withdrawalRevoked'), 'success');
      onRevoke?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('wallet.failed');
      showToast(msg, 'error');
    } finally {
      setRevoking(false);
    }
  }

  if (!tx) return null;

  const isCredit = tx.type === 'credit';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={txModalStyles.overlay}>
        <View style={[txModalStyles.sheet, { backgroundColor: c.surface }]}>
          {/* Header */}
          <View style={txModalStyles.handleBar} />
          <View style={txModalStyles.header}>
            <Text style={[txModalStyles.headerTitle, { color: c.text }]}>
              {t('wallet.txDetail')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={txModalStyles.body} showsVerticalScrollIndicator={false}>
            {/* Amount + Status */}
            <View style={[txModalStyles.amountCard, { backgroundColor: isCredit ? c.success + '12' : c.error + '12' }]}>
              <Text style={[txModalStyles.amountLabel, { color: isCredit ? c.success : c.error }]}>
                {isCredit ? 'Credit' : 'Debit'}
              </Text>
              <Text style={[txModalStyles.amountValue, { color: isCredit ? c.success : c.error }]}>
                {isCredit ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              <View style={[txModalStyles.statusPill, { backgroundColor: (statusColors[tx.status] ?? c.textTertiary) + '22' }]}>
                <Text style={[txModalStyles.statusText, { color: statusColors[tx.status] ?? c.textTertiary }]}>
                  {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                </Text>
              </View>
            </View>

            {/* Meta rows */}
            <View style={txModalStyles.metaSection}>
              <TxMetaRow label={t('wallet.txSource')} value={
                tx.source.charAt(0).toUpperCase() + tx.source.slice(1).replace(/_/g, ' ')
              } c={c} />
              <TxMetaRow label={t('wallet.txType')} value={
                tx.type.charAt(0).toUpperCase() + tx.type.slice(1)
              } c={c} />
              <TxMetaRow label={t('wallet.txDate')} value={
                new Date(tx.createdAt).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              } c={c} />
              <TxMetaRow label={t('wallet.txBalanceAfter')} value={
                `₹${Number(tx.balanceAfter).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              } c={c} />
              {tx.description && (
                <TxMetaRow label={t('wallet.txDescription')} value={tx.description} c={c} />
              )}
            </View>

            {/* Reward source — question details */}
            {tx.source === 'reward' && (
              <View style={[txModalStyles.questionSection, { borderColor: c.border }]}>
                <View style={txModalStyles.questionSectionHeader}>
                  <Ionicons name="chatbubble-outline" size={16} color={c.primary} />
                  <Text style={[txModalStyles.questionSectionTitle, { color: c.text }]}>
                    {t('wallet.relatedQuestion')}
                  </Text>
                </View>
                {loadingQ ? (
                  <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: tokens.spacing3 }} />
                ) : question ? (
                  <View style={txModalStyles.questionGrid}>
                    {[
                      [t('wallet.questionText'), String(question.questionText ?? '—')],
                      [t('wallet.questionLanguage'), String(question.language ?? '—')],
                      [t('wallet.questionCrop'), String(question.cropType ?? '—')],
                      [t('wallet.questionSeason'), String(question.season ?? '—')],
                      [t('wallet.questionState'), String(question.state ?? '—')],
                      [t('wallet.approvalReason'), String((question as Record<string, unknown>).approvalReason ?? '—')],
                    ].map(([label, value]) =>
                      value && value !== '—' ? (
                        <View key={label as string} style={txModalStyles.questionRow}>
                          <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>{label as string}</Text>
                          <Text style={[txModalStyles.questionValue, { color: c.text }]} numberOfLines={3}>{value as string}</Text>
                        </View>
                      ) : null
                    )}
                  </View>
                ) : (
                  <Text style={[txModalStyles.questionNA, { color: c.textTertiary }]}>
                    {t('wallet.questionNotAvailable')}
                  </Text>
                )}
              </View>
            )}

            {/* Withdrawal reference */}
            {tx.source === 'withdrawal' && tx.referenceId && (
              <View style={[txModalStyles.questionSection, { borderColor: c.border }]}>
                <View style={txModalStyles.questionSectionHeader}>
                  <Ionicons name="cash-outline" size={16} color={c.primary} />
                  <Text style={[txModalStyles.questionSectionTitle, { color: c.text }]}>
                    {t('wallet.withdrawalRef')}
                  </Text>
                </View>
                <Text style={[txModalStyles.withdrawalId, { color: c.textSecondary }]}>
                  ID: {tx.referenceId}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Cancel withdrawal button — only for pending withdrawal transactions */}
          {tx.source === 'withdrawal' && tx.status === 'pending' && (
            <View style={[txModalStyles.footer, txModalStyles.footerFullWidth, { flexDirection: 'column' }]}>
              <Button
                title={t('wallet.cancelWithdrawal')}
                variant="destructive"
                loading={revoking}
                onPress={handleRevokeWithdrawal}
              />
            </View>
          )}

          {/* Close button — all other transactions */}
          {!(tx.source === 'withdrawal' && tx.status === 'pending') && (
            <View style={[txModalStyles.footer, txModalStyles.footerFullWidth, { flexDirection: 'column' }]}>
              <Button title={t('common.cancel')} variant="outline" onPress={onClose} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function TxMetaRow({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useTheme>['theme']['colors'] }) {
  return (
    <View style={txModalStyles.metaRow}>
      <Text style={[txModalStyles.metaLabel, { color: c.textTertiary }]}>{label}</Text>
      <Text style={[txModalStyles.metaValue, { color: c.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const txModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: tokens.radiusXl,
    borderTopRightRadius: tokens.radiusXl,
    maxHeight: '88%',
    paddingBottom: tokens.spacing6,
  },
  handleBar: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: tokens.spacing3,
    backgroundColor: '#aaa', marginBottom: tokens.spacing2,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: tokens.spacing5, marginBottom: tokens.spacing4,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  body: { paddingHorizontal: tokens.spacing5 },
  amountCard: {
    borderRadius: tokens.radiusLg, padding: tokens.spacing5,
    alignItems: 'center', marginBottom: tokens.spacing5,
  },
  amountLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.05 * 12, textTransform: 'uppercase' },
  amountValue: { fontSize: 36, fontWeight: '800', marginVertical: tokens.spacing2 },
  statusPill: { borderRadius: 20, paddingHorizontal: tokens.spacing3, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  metaSection: { marginBottom: tokens.spacing4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: tokens.spacing3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  metaLabel: { fontSize: 13, flex: 1, paddingRight: tokens.spacing3 },
  metaValue: { fontSize: 13, flex: 2, textAlign: 'right', fontWeight: '500' },
  questionSection: { borderWidth: 1, borderRadius: tokens.radiusLg, padding: tokens.spacing4, marginBottom: tokens.spacing4 },
  questionSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing3 },
  questionSectionTitle: { fontSize: 14, fontWeight: '700' },
  questionGrid: { gap: tokens.spacing3 },
  questionRow: { gap: 2 },
  questionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.05 * 11 },
  questionValue: { fontSize: 14 },
  questionNA: { fontSize: 13, fontStyle: 'italic' },
  withdrawalId: { fontSize: 12, fontFamily: 'monospace' },
  footer: { paddingHorizontal: tokens.spacing5, paddingTop: tokens.spacing4, flexDirection: 'row', gap: tokens.spacing3, paddingBottom: tokens.spacing2 },
  footerFullWidth: { flexDirection: 'column' },
});

// ─── Filter Pill ──────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}

function FilterPill({ label, active, onPress, c }: FilterPillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        filterStyles.pill,
        { backgroundColor: active ? c.primary : c.surface, borderColor: active ? c.primary : c.border },
      ]}
    >
      <Text style={[filterStyles.pillText, { color: active ? '#fff' : c.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const filterStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
});

// ─── Shimmer Withdraw Card ────────────────────────────────────────────────────

function ShimmerWithdrawCard({
  c,
  minWithdrawal,
  onWithdraw,
  withdrawingMin,
  t,
}: {
  c: ReturnType<typeof useTheme>['theme']['colors'];
  minWithdrawal: number;
  onWithdraw: () => void;
  withdrawingMin: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const shimmerStyle = {
    opacity: shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }) as Animated.AnimatedInterpolation<string>,
  };

  return (
    <View style={[styles.withdrawCard, { backgroundColor: c.primary + '12', borderColor: c.primary + '30' }]}>
      {/* Shine overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.shimmerOverlay,
          {
            backgroundColor: c.primary + '08',
            transform: [
              {
                translateX: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-200, 400],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.withdrawCardTop}>
        <View style={[styles.withdrawIconWrap, { backgroundColor: c.primary + '20' }]}>
          <Ionicons name="arrow-up-circle" size={24} color={c.primary} />
        </View>
        <View style={styles.withdrawCardInfo}>
          <Text style={[styles.withdrawCardTitle, { color: c.text }]}>{t('wallet.withdraw')}</Text>
          <Text style={[styles.withdrawCardSub, { color: c.textSecondary }]}>
            Min. ₹{minWithdrawal.toLocaleString('en-IN')} per request
          </Text>
        </View>
        <Animated.View style={{ alignSelf: 'center' }}>
          <Button
            title={t('wallet.withdraw')}
            onPress={onWithdraw}
            variant="primary"
            loading={withdrawingMin}
            icon="arrow-up-outline"
            iconPosition="right"
            style={styles.withdrawBtn}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Main WalletScreen ────────────────────────────────────────────────────────

export function WalletScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [balance, setBalance] = useState<number | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(50);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterType, setFilterType] = useState<TxType>('all');
  const [filterSource, setFilterSource] = useState<TxSource>('all');
  const [filterStatus, setFilterStatus] = useState<TxStatus>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [balanceRes, txRes, configRes] = await Promise.allSettled([
        walletApi.getBalance(),
        walletApi.getTransactions(),
        walletApi.getWalletConfig(),
      ]);

      if (balanceRes.status === 'fulfilled') {
        setBalance(balanceRes.value.data.balance);
      }
      if (txRes.status === 'fulfilled') {
        setAllTransactions(txRes.value.data.transactions ?? []);
      }
      if (configRes.status === 'fulfilled') {
        setMinWithdrawal(configRes.value.data.minWithdrawalAmount ?? 50);
      }
    } catch (err) {
      console.warn('[Wallet] Failed to load:', getErrorMessage(err, 'Failed to load wallet data. Please try again.'));
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  // ─── Withdraw minimum ─────────────────────────────────────────────────────
  const [withdrawingMin, setWithdrawingMin] = useState(false);

  async function handleWithdrawMin() {
    if ((balance ?? 0) < minWithdrawal) {
      showToast(t('wallet.minWithdrawalError', { amount: minWithdrawal }), 'warning');
      return;
    }
    setWithdrawingMin(true);
    try {
      await walletApi.withdraw({ amount: minWithdrawal, payoutMethod: 'upi', payoutDetails: { upiId: '' } });
      showToast(t('wallet.success'), 'success');
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('wallet.failed');
      showToast(msg, 'error');
    } finally {
      setWithdrawingMin(false);
    }
  }

  // ─── Filtered transactions ──────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterSource !== 'all' && tx.source !== filterSource) return false;
      if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
      return true;
    });
  }, [allTransactions, filterType, filterSource, filterStatus]);

  const hasActiveFilters = filterType !== 'all' || filterSource !== 'all' || filterStatus !== 'all';

  function clearFilters() {
    setFilterType('all');
    setFilterSource('all');
    setFilterStatus('all');
  }

  const statusColors: Record<string, string> = {
    completed: c.success,
    pending: c.warning,
    failed: c.error,
    reversed: c.textTertiary,
  };

  if (loading) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>{t('wallet.title')}</Text>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: c.heroBg }]}>
          <Text style={[styles.balanceLabel, { color: c.heroFg }]}>{t('wallet.availableBalance')}</Text>
          <Text style={[styles.balanceAmount, { color: c.heroFg }]}>
            ₹{(balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.balanceCurrency, { color: c.heroFg }]}>INR</Text>
        </View>

        {/* Withdraw */}
        <View style={styles.withdrawSection}>
          {(balance ?? 0) >= minWithdrawal ? (
            <ShimmerWithdrawCard
              c={c}
              minWithdrawal={minWithdrawal}
              onWithdraw={handleWithdrawMin}
              withdrawingMin={withdrawingMin}
              t={t}
            />
          ) : (
            <View style={[styles.withdrawCard, { backgroundColor: c.warning + '10', borderColor: c.warning + '30' }]}>
              <View style={styles.withdrawCardTop}>
                <View style={[styles.withdrawIconWrap, { backgroundColor: c.warning + '20' }]}>
                  <Ionicons name="information-circle" size={22} color={c.warning} />
                </View>
                <View style={styles.withdrawCardInfo}>
                  <Text style={[styles.withdrawCardTitle, { color: c.text }]}>Withdraw</Text>
                  <Text style={[styles.withdrawCardSub, { color: c.textSecondary }]}>
                    Min. ₹{minWithdrawal.toLocaleString('en-IN')} required
                  </Text>
                </View>
              </View>
              <Text style={[styles.withdrawCardBalance, { color: c.textTertiary, borderTopColor: c.border }]}>
                You need{' '}
                <Text style={{ color: c.warning, fontWeight: '700' }}>
                  ₹{(minWithdrawal - (balance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>{' '}
                more to withdraw
              </Text>
            </View>
          )}
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {t('wallet.transactionHistory')}
              {hasActiveFilters && (
                <Text style={{ color: c.primary }}> ({filteredTransactions.length})</Text>
              )}
            </Text>
            <View style={{ flexDirection: 'row', gap: tokens.spacing2, alignItems: 'center' }}>
              {hasActiveFilters && (
                <TouchableOpacity onPress={clearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>{t('wallet.clearFilters')}</Text>
                </TouchableOpacity>
              )}
              <TooltipIcon description={t('wallet.txTooltip')} />
              <TouchableOpacity
                onPress={() => setShowFilters((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.filterToggleBtn, { backgroundColor: showFilters || hasActiveFilters ? c.primary + '18' : 'transparent' }]}>
                  <Ionicons name="filter" size={18} color={showFilters || hasActiveFilters ? c.primary : c.textTertiary} />
                  {hasActiveFilters && <View style={[styles.filterBadge, { backgroundColor: c.primary }]} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter panel */}
          {showFilters && (
            <View style={[styles.filterPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
              {/* Type filter */}
              <Text style={[styles.filterGroupLabel, { color: c.textSecondary }]}>{t('wallet.filterByType')}</Text>
              <View style={styles.filterPills}>
                {(['all', 'credit', 'debit'] as TxType[]).map((f) => (
                  <FilterPill
                    key={f}
                    label={f === 'all' ? t('wallet.filterAll') : f.charAt(0).toUpperCase() + f.slice(1)}
                    active={filterType === f}
                    onPress={() => setFilterType(f)}
                    c={c}
                  />
                ))}
              </View>

              {/* Source filter */}
              <Text style={[styles.filterGroupLabel, { color: c.textSecondary, marginTop: tokens.spacing3 }]}>{t('wallet.filterBySource')}</Text>
              <View style={styles.filterPills}>
                {(['all', 'reward', 'withdrawal', 'refund'] as TxSource[]).map((f) => (
                  <FilterPill
                    key={f}
                    label={f === 'all' ? t('wallet.filterAll') : f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' ')}
                    active={filterSource === f}
                    onPress={() => setFilterSource(f)}
                    c={c}
                  />
                ))}
              </View>

              {/* Status filter */}
              <Text style={[styles.filterGroupLabel, { color: c.textSecondary, marginTop: tokens.spacing3 }]}>{t('wallet.filterByStatus')}</Text>
              <View style={styles.filterPills}>
                {(['all', 'completed', 'pending', 'failed', 'reversed'] as TxStatus[]).map((f) => (
                  <FilterPill
                    key={f}
                    label={f === 'all' ? t('wallet.filterAll') : f.charAt(0).toUpperCase() + f.slice(1)}
                    active={filterStatus === f}
                    onPress={() => setFilterStatus(f)}
                    c={c}
                  />
                ))}
              </View>
            </View>
          )}

          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              iconColor={c.textTertiary}
              title={hasActiveFilters ? t('wallet.noMatchingTransactions') : t('wallet.noTransactions')}
              message={hasActiveFilters ? t('wallet.noMatchingTransactionsDesc') : t('wallet.noTransactionsDesc')}
            />
          ) : (
            filteredTransactions.map((tx) => (
              <TouchableOpacity
                key={tx.id}
                activeOpacity={0.7}
                onPress={() => setSelectedTx(tx)}
                style={[styles.txRow, { backgroundColor: c.surface, ...tokens.shadowXs }]}
              >
                <View style={styles.txLeft}>
                  <View style={styles.txSourceRow}>
                    <Text style={[styles.txSource, { color: c.text }]}>
                      {tx.source.charAt(0).toUpperCase() + tx.source.slice(1).replace(/_/g, ' ')}
                    </Text>
                    {tx.status === 'pending' && (
                      <View style={[styles.pendingDot, { backgroundColor: c.warning }]} />
                    )}
                  </View>
                  <Text style={[styles.txDate, { color: c.textTertiary }]}>
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'credit' ? c.success : c.error },
                    ]}
                  >
                    {tx.type === 'credit' ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.txStatus, { color: statusColors[tx.status] ?? c.textTertiary }]}>
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} style={{ marginLeft: tokens.spacing2 }} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Transaction Detail Modal */}
      <TxDetailModal
        tx={selectedTx}
        visible={selectedTx !== null}
        onClose={() => setSelectedTx(null)}
        statusColors={statusColors}
        c={c}
        onRevoke={fetchData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing4 },
  title: { fontSize: 26, fontWeight: '800' },
  balanceCard: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing6,
    alignItems: 'center',
    marginBottom: tokens.spacing4,
  },
  balanceLabel: { fontSize: 13, opacity: 0.8, letterSpacing: 0.01 * 13 },
  balanceAmount: { fontSize: 40, fontWeight: '800', marginVertical: tokens.spacing2 },
  balanceCurrency: { fontSize: 13, opacity: 0.7 },
  withdrawSection: { marginBottom: tokens.spacing5 },
  withdrawCard: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    padding: tokens.spacing4,
    overflow: 'hidden',
  },
  withdrawCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  withdrawIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  withdrawCardInfo: { flex: 1 },
  withdrawCardTitle: { fontSize: 15, fontWeight: '700' },
  withdrawCardSub: { fontSize: 12, marginTop: 2 },
  withdrawCardBalance: { fontSize: 12, marginTop: tokens.spacing3, paddingTop: tokens.spacing3, borderTopWidth: StyleSheet.hairlineWidth },
  shimmerOverlay: {
    width: 120,
    height: '200%',
    transform: [{ skewX: '-20deg' }],
  },
  withdrawBtn: { alignSelf: 'center' },
  section: { marginTop: tokens.spacing2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing3, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  filterToggleBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
  },
  filterPanel: {
    borderWidth: 1, borderRadius: tokens.radiusLg,
    padding: tokens.spacing4, marginBottom: tokens.spacing3,
  },
  filterGroupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.05 * 11, textTransform: 'uppercase', marginBottom: tokens.spacing2 },
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  txRow: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  txLeft: { flex: 1 },
  txSourceRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  txSource: { fontSize: 14, fontWeight: '600' },
  txDate: { fontSize: 11, marginTop: 2, letterSpacing: 0.01 * 11 },
  pendingDot: { width: 7, height: 7, borderRadius: 3.5 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txStatus: { fontSize: 11, marginTop: 2 },
});