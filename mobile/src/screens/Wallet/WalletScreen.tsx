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
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/Button';
import { Ionicons } from '@expo/vector-icons';
import { TooltipIcon } from '../../components/TooltipIcon';
import { EmptyState } from '../../components/Loading';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { walletApi, questionApi, getErrorMessage } from '../../api/client';
import { TranslatableTextReadOnly } from '../../components/TranslatableTextReadOnly';
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
  const [selectedLang, setSelectedLang] = useState('');

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
                    {/* questionText — translatable */}
                    {question.questionText ? (
                      <View style={txModalStyles.questionRow}>
                        <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>
                          {t('wallet.questionText')}
                        </Text>
                        <TranslatableTextReadOnly
                          text={question.questionText as string}
                          selectedLang={selectedLang}
                          onLangChange={setSelectedLang}
                        />
                      </View>
                    ) : null}

                    {/* Static fields */}
                    {question.language ? (
                      <View style={txModalStyles.questionRow}>
                        <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>
                          {t('wallet.questionLanguage')}
                        </Text>
                        <Text style={[txModalStyles.questionValue, { color: c.text }]} numberOfLines={1}>
                          {question.language as string}
                        </Text>
                      </View>
                    ) : null}
                    {question.cropType ? (
                      <View style={txModalStyles.questionRow}>
                        <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>
                          {t('wallet.questionCrop')}
                        </Text>
                        <Text style={[txModalStyles.questionValue, { color: c.text }]} numberOfLines={1}>
                          {question.cropType as string}
                        </Text>
                      </View>
                    ) : null}
                    {question.season ? (
                      <View style={txModalStyles.questionRow}>
                        <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>
                          {t('wallet.questionSeason')}
                        </Text>
                        <Text style={[txModalStyles.questionValue, { color: c.text }]} numberOfLines={1}>
                          {question.season as string}
                        </Text>
                      </View>
                    ) : null}
                    {question.state ? (
                      <View style={txModalStyles.questionRow}>
                        <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>
                          {t('wallet.questionState')}
                        </Text>
                        <Text style={[txModalStyles.questionValue, { color: c.text }]} numberOfLines={1}>
                          {question.state as string}
                        </Text>
                      </View>
                    ) : null}

                    {/* approvalReason — translatable */}
                    {(question as Record<string, unknown>).approvalReason ? (
                      <View style={txModalStyles.questionRow}>
                        <Text style={[txModalStyles.questionLabel, { color: c.textTertiary }]}>
                          {t('wallet.approvalReason')}
                        </Text>
                        <TranslatableTextReadOnly
                          text={(question as Record<string, unknown>).approvalReason as string}
                          selectedLang={selectedLang}
                          onLangChange={setSelectedLang}
                        />
                      </View>
                    ) : null}
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

// ─── Main WalletScreen ────────────────────────────────────────────────────────

export function WalletScreen() {
  const { theme, isDark } = useTheme();
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

  // Quick stats
  const totalEarned = allTransactions
    .filter((tx) => tx.type === 'credit' && tx.status === 'completed')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalWithdrawn = allTransactions
    .filter((tx) => tx.source === 'withdrawal' && tx.status === 'completed')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const pendingCount = allTransactions.filter((tx) => tx.status === 'pending').length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>{t('wallet.title')}</Text>
          <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="refresh-outline" size={20} color={c.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Balance hero card ─────────────────────────────── */}
        <LinearGradient
          colors={isDark ? [c.heroBg, '#0A3733'] : [c.primary, '#0A7A74']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceGradientCard}
        >
          <View style={styles.balanceCardInner}>
            <View style={styles.balanceLeft}>
              <View style={styles.balanceLabelRow}>
                <Ionicons name="wallet" size={13} color={c.heroFg} style={{ opacity: 0.8 }} />
                <Text style={[styles.balanceLabel, { color: c.heroFg }]}>{t('wallet.availableBalance')}</Text>
              </View>
              <Text style={[styles.balanceAmount, { color: c.heroFg }]}>
                ₹{(balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.balanceCurrency, { color: c.heroFg }]}>Indian Rupees</Text>
            </View>
            <View style={styles.balanceRight}>
              {(balance ?? 0) >= minWithdrawal ? (
                <View
                  style={[styles.withdrawCtaBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
                >
                  <Ionicons name="arrow-up-outline" size={17} color="rgba(255,255,255,0.4)" />
                  <Text style={[styles.withdrawCtaText, { color: 'rgba(255,255,255,0.4)' }]}>{t('wallet.withdraw')}</Text>
                </View>
              ) : (
                <View style={[styles.balanceMinAlert, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <Ionicons name="information-circle" size={15} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.balanceMinAlertText}>
                    Min ₹{minWithdrawal.toLocaleString('en-IN')} to withdraw
                  </Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ── Quick stats row ────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <View style={[styles.statIconWrap, { backgroundColor: c.success + '15' }]}>
              <Ionicons name="trending-up-outline" size={17} color={c.success} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: c.success }]}>
                ₹{totalEarned.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Total Earned</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <View style={[styles.statIconWrap, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="arrow-up-outline" size={17} color={c.primary} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: c.primary }]}>
                ₹{totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Withdrawn</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <View style={[styles.statIconWrap, { backgroundColor: pendingCount > 0 ? c.warning + '15' : c.textTertiary + '15' }]}>
              <Ionicons name="time-outline" size={17} color={pendingCount > 0 ? c.warning : c.textTertiary} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: c.text }]}>{pendingCount}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>Pending</Text>
            </View>
          </View>
        </View>

        {/* ── Withdraw info note (when balance < min) ────────── */}
        {(balance ?? 0) < minWithdrawal && (
          <View style={[styles.infoNote, { backgroundColor: c.warning + '10', borderColor: c.warning + '30' }]}>
            <Ionicons name="lock-closed-outline" size={15} color={c.warning} />
            <Text style={[styles.infoNoteText, { color: c.textSecondary }]}>
              Earn{' '}
              <Text style={{ color: c.warning, fontWeight: '700' }}>
                ₹{(minWithdrawal - (balance ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>{' '}
              more to unlock withdrawals
            </Text>
          </View>
        )}

        {/* ── Transaction History ────────────────────────────── */}
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
                  <Ionicons name="filter" size={17} color={showFilters || hasActiveFilters ? c.primary : c.textTertiary} />
                  {hasActiveFilters && <View style={[styles.filterBadge, { backgroundColor: c.primary }]} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter panel */}
          {showFilters && (
            <View style={[styles.filterPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
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
                <View style={[styles.txIconWrap, { backgroundColor: (tx.type === 'credit' ? c.success : c.error) + '14' }]}>
                  <Ionicons
                    name={
                      tx.source === 'reward'
                        ? 'chatbubble-ellipses-outline'
                        : tx.source === 'withdrawal'
                        ? 'arrow-up-outline'
                        : tx.source === 'refund'
                        ? 'return-down-back-outline'
                        : 'swap-horizontal-outline'
                    }
                    size={17}
                    color={tx.type === 'credit' ? c.success : c.error}
                  />
                </View>
                <View style={styles.txLeft}>
                  <Text style={[styles.txSource, { color: c.text }]}>
                    {tx.source.charAt(0).toUpperCase() + tx.source.slice(1).replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.txDate, { color: c.textTertiary }]}>
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {tx.status === 'pending' && ' · Pending'}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: tx.type === 'credit' ? c.success : c.error }]}>
                    {tx.type === 'credit' ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.txStatus, { color: statusColors[tx.status] ?? c.textTertiary }]}>
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={c.textTertiary} style={{ marginLeft: tokens.spacing2 }} />
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
  scroll: { padding: tokens.spacing5, paddingBottom: tokens.spacing8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing4 },
  title: { fontSize: 26, fontWeight: '800' },

  // Balance hero card
  balanceGradientCard: {
    borderRadius: tokens.radiusLg,
    marginBottom: tokens.spacing4,
    overflow: 'hidden',
  },
  balanceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing5,
  },
  balanceLeft: { flex: 1 },
  balanceRight: { alignItems: 'flex-end' },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: tokens.spacing2 },
  balanceLabel: { fontSize: 12, fontWeight: '600', opacity: 0.85 },
  balanceAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  balanceCurrency: { fontSize: 11, opacity: 0.65 },
  withdrawCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: 10,
    borderRadius: 22,
  },
  withdrawCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  balanceMinAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: 8,
    borderRadius: 14,
  },
  balanceMinAlertText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },

  // Quick stats
  statsRow: { flexDirection: 'row', gap: tokens.spacing2, marginBottom: tokens.spacing4 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    gap: tokens.spacing2,
  },
  statIconWrap: {
    width: 32, height: 32,
    borderRadius: tokens.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: { fontSize: 13, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 1 },

  // Info note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing4,
  },
  infoNoteText: { fontSize: 12, flex: 1 },

  // Transactions
  section: { marginTop: tokens.spacing1 },
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
  filterGroupLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.05 * 11,
    textTransform: 'uppercase', marginBottom: tokens.spacing2,
  },
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  txRow: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
    gap: tokens.spacing3,
  },
  txIconWrap: {
    width: 36, height: 36,
    borderRadius: tokens.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txLeft: { flex: 1 },
  txSource: { fontSize: 14, fontWeight: '600' },
  txDate: { fontSize: 11, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txStatus: { fontSize: 11, marginTop: 2 },
});