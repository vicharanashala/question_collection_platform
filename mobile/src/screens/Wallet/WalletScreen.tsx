import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, ActivityIndicator, Animated, TextInput,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { formatINRFull, formatINRCompact, getBalanceFontSize, getStatFontSize } from '../../utils/currency';

// ─── Filter options ───────────────────────────────────────────────────────────

type TxType = 'all' | 'credit' | 'debit';
type TxSource = 'all' | 'reward' | 'withdrawal' | 'refund';
type TxStatus = 'all' | 'completed' | 'pending' | 'failed' | 'reversed' | 'rejected';


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
  const [wd, setWd] = useState<Record<string, unknown> | null>(null);
  const [loadingWd, setLoadingWd] = useState(false);

  useEffect(() => {
    if (!tx || !visible) { setQuestion(null); setWd(null); return; }
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
    // For withdrawal transactions, fetch full withdrawal details
    if (tx.source === 'withdrawal' && tx.referenceId) {
      setLoadingWd(true);
      walletApi.getWithdrawal(tx.referenceId as string)
        .then((res) => setWd(res.data as Record<string, unknown>))
        .catch(() => setWd(null))
        .finally(() => setLoadingWd(false));
    } else {
      setWd(null);
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
              {tx.rejectionReason ? (
                <View style={txModalStyles.rejectionRow}>
                  <Text style={[txModalStyles.rejectionLabel, { color: c.error }]}>
                    {t('wallet.rejectionReason', 'Rejection Reason')}
                  </Text>
                  <Text style={[txModalStyles.rejectionValue, { color: c.error }]} selectable>
                    {tx.rejectionReason}
                  </Text>
                </View>
              ) : tx.description ? (
                <TxMetaRow label={t('wallet.txDescription')} value={tx.description} c={c} />
              ) : null}
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

            {/* Withdrawal payout details */}
            {tx.source === 'withdrawal' && (
              <View style={[txModalStyles.questionSection, { borderColor: c.border }]}>
                <View style={txModalStyles.questionSectionHeader}>
                  <Ionicons name="cash-outline" size={16} color={c.primary} />
                  <Text style={[txModalStyles.questionSectionTitle, { color: c.text }]}>
                    Payout Details
                  </Text>
                </View>
                {loadingWd ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : wd ? (
                  <View style={{ gap: tokens.spacing2 }}>
                    {/* Payout method badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 }}>
                      <View style={[txModalStyles.methodBadge, { backgroundColor: c.primary + '15' }]}>
                        <Text style={[txModalStyles.methodBadgeText, { color: c.primary }]}>
                          {(wd['payoutMethod'] as string)?.toUpperCase()}
                        </Text>
                      </View>
                      {wd['status'] && (
                        <View style={[{ backgroundColor: (statusColors[wd['status'] as string] ?? c.textTertiary) + '20', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }]}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: statusColors[wd['status'] as string] ?? c.textTertiary }}>
                            {(wd['status'] as string)?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* UPI or Bank details */}
                    {(wd['payoutMethod'] === 'upi' || wd['payoutMethod'] === 'UPI') ? (
                      <View style={txModalStyles.payoutRow}>
                        <Text style={[txModalStyles.payoutLabel, { color: c.textTertiary }]}>UPI ID</Text>
                        <Text style={[txModalStyles.payoutValue, { color: c.text }]} selectable>
                          {String((wd['payoutDetails'] && (wd['payoutDetails'] as Record<string,unknown>)['upiId']) ?? '—')}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={txModalStyles.payoutRow}>
                          <Text style={[txModalStyles.payoutLabel, { color: c.textTertiary }]}>Account Number</Text>
                          <Text style={[txModalStyles.payoutValue, { color: c.text }]} selectable>
                            {String((wd['payoutDetails'] as Record<string,unknown>)?.['accountNumber'] ?? (wd['payoutDetails'] as Record<string,unknown>)?.['account_number'] ?? '—')}
                          </Text>
                        </View>
                        <View style={txModalStyles.payoutRow}>
                          <Text style={[txModalStyles.payoutLabel, { color: c.textTertiary }]}>IFSC</Text>
                          <Text style={[txModalStyles.payoutValue, { color: c.text }]} selectable>
                            {String((wd['payoutDetails'] as Record<string,unknown>)?.['ifsc'] ?? (wd['payoutDetails'] as Record<string,unknown>)?.['ifscCode'] ?? '—')}
                          </Text>
                        </View>
                        {(wd['payoutDetails'] as Record<string,unknown>)?.['bankName'] && (
                          <View style={txModalStyles.payoutRow}>
                            <Text style={[txModalStyles.payoutLabel, { color: c.textTertiary }]}>Bank</Text>
                            <Text style={[txModalStyles.payoutValue, { color: c.text }]}>
                              {String((wd['payoutDetails'] as Record<string,unknown>)['bankName'])}
                            </Text>
                          </View>
                        )}
                      </>
                    )}

                    {/* Rejection reason */}
                    {wd['rejectionReason'] && (
                      <View style={[txModalStyles.payoutRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <Text style={[txModalStyles.payoutLabel, { color: c.error }]}>Rejection Reason</Text>
                        <Text style={[txModalStyles.payoutValue, { color: c.error }]} selectable>
                          {String(wd['rejectionReason'])}
                        </Text>
                      </View>
                    )}

                    {/* Processed at */}
                    {wd['processedAt'] && (
                      <View style={txModalStyles.payoutRow}>
                        <Text style={[txModalStyles.payoutLabel, { color: c.textTertiary }]}>Processed</Text>
                        <Text style={[txModalStyles.payoutValue, { color: c.text }]}>
                          {new Date(wd['processedAt'] as string).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}

                    {/* Withdrawal ID */}
                    <View style={txModalStyles.payoutRow}>
                      <Text style={[txModalStyles.payoutLabel, { color: c.textTertiary }]}>Withdrawal ID</Text>
                      <Text style={[txModalStyles.payoutValue, { color: c.text, fontSize: 11 }]} selectable>
                        {String(wd['id'] ?? tx.referenceId)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                    {tx.referenceId ? `ID: ${tx.referenceId}` : '—'}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Disclaimer for non-pending withdrawals */}
          {tx.source === 'withdrawal' && wd && wd.status !== 'pending' && (
            <View style={{ backgroundColor: c.surfaceHighlight ?? '#FEF3E7', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>
                {String((wd.retryCount as number) ?? 0) > 0
                  ? `Your payment was attempted but could not be completed (Attempt ${(wd.retryCount as number) + 1}). We will retry the transaction and finalize your withdrawal shortly. You will be notified once the process is complete.`
                  : 'Your payment was attempted but could not be completed. We will retry the transaction and finalize your withdrawal shortly. You will be notified once the process is complete.'}
              </Text>
            </View>
          )}

          {/* Cancel withdrawal button — only for pending withdrawal transactions */}
          {tx.source === 'withdrawal' && wd?.status === 'pending' && (
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
          {!(tx.source === 'withdrawal' && wd?.status === 'pending') && (
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
      <Text style={[txModalStyles.metaValue, { color: c.text }]} selectable>{value}</Text>
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
  rejectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginTop: tokens.spacing1,
    marginBottom: tokens.spacing2,
  },
  rejectionLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  rejectionValue: { fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
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
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payoutLabel: { fontSize: 12, fontWeight: '600' },
  payoutValue: { fontSize: 13, fontWeight: '500' },
  methodBadge: { borderRadius: tokens.radiusSm, paddingHorizontal: 8, paddingVertical: 3 },
  methodBadgeText: { fontSize: 10, fontWeight: '700' },
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
  const navigation = useNavigation();
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

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [balanceRes, configRes] = await Promise.allSettled([
        walletApi.getBalance(),
        walletApi.getWalletConfig(),
      ]);

      if (balanceRes.status === 'fulfilled') {
        setBalance(balanceRes.value.data.balance);
      }
      if (configRes.status === 'fulfilled') {
        setMinWithdrawal(configRes.value.data.minWithdrawalAmount ?? 50);
      }

      // Load all pages so stats (totalEarned, withdrawn) are accurate
      const allTx: Transaction[] = [];
      let page = 1;
      const PAGE = 50;
      let hasMore = true;
      while (hasMore) {
        const res = await walletApi.getTransactions({ page, limit: PAGE });
        const items: Transaction[] = res.data.transactions ?? [];
        allTx.push(...items);
        hasMore = items.length === PAGE;
        page++;
      }
      setAllTransactions(allTx);
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

  // ─── Withdraw amount ─────────────────────────────────────────────────────
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Payout form state (inside confirmation modal)
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [payoutError, setPayoutError] = useState('');

  // Payment detail selection
  type PaymentDetailStatus = 'pending' | 'in_progress' | 'verified' | 'failed';
  interface PaymentDetailItem {
    id: string;
    payoutMethod: 'upi' | 'bank_transfer';
    status: PaymentDetailStatus;
    displayValue: string;
    bankName: string | null;
    ifsc: string | null;
    accountHolderName: string | null;
    verifiedAt: string | null;
  }
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailItem[]>([]);
  const [selectedPaymentDetailId, setSelectedPaymentDetailId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const parsedAmount = parseFloat(withdrawAmount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= minWithdrawal && parsedAmount <= (balance ?? 0);

  async function loadPaymentDetails() {
    setLoadingDetails(true);
    try {
      const res = await walletApi.getPaymentDetails();
      const items = res.data as PaymentDetailItem[];
      setPaymentDetails(items);
      // Auto-select the first verified item
      const verified = items.find((i) => i.status === 'verified');
      setSelectedPaymentDetailId(verified?.id ?? (items[0]?.id ?? null));
    } catch {
      showToast('Failed to load payment methods', 'error');
    } finally {
      setLoadingDetails(false);
    }
  }

  function showWithdrawConfirm() {
    if ((balance ?? 0) < minWithdrawal) {
      showToast(t('wallet.minWithdrawalError', { amount: minWithdrawal }), 'warning');
      return;
    }
    resetWithdrawForm();
    loadPaymentDetails().then(() => setConfirmOpen(true));
  }

  function resetWithdrawForm() {
    setWithdrawAmount('');
    setPayoutError('');
    setSelectedPaymentDetailId(null);
    setPaymentDetails([]);
    setUpiId('');
    setAccountNumber('');
    setIfsc('');
    setAccountHolderName('');
  }

  async function handleWithdraw() {
    const selected = paymentDetails.find((d) => d.id === selectedPaymentDetailId);
    if (!selected) {
      setPayoutError('Please select a payment method first');
      return;
    }
    if (selected.status !== 'verified') {
      setPayoutError(`Payment method is not verified yet (status: ${selected.status})`);
      return;
    }
    setWithdrawing(true);
    setConfirmOpen(false);
    try {
      await walletApi.withdraw({
        amount: parsedAmount,
        paymentDetailId: selectedPaymentDetailId!,
      });
      showToast(t('wallet.success') ?? 'Withdrawal request submitted', 'success');
      resetWithdrawForm();
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('wallet.failed');
      showToast(msg, 'error');
    } finally {
      setWithdrawing(false);
    }
  }

  // ─── Filtered transactions ──────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    const seen = new Set<string>();
    return allTransactions.filter((tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
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
    rejected: c.error,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3 }}>
            <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="refresh-outline" size={20} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('PaymentDetails')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Ionicons name="card-outline" size={15} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>Payment Methods</Text>
              </View>
            </TouchableOpacity>
          </View>
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
              <Text style={[styles.balanceAmount, { color: c.heroFg, fontSize: getBalanceFontSize(balance ?? 0) }]}>
                ₹{formatINRFull(balance ?? 0)}
              </Text>
              <Text style={[styles.balanceCurrency, { color: c.heroFg }]}>Indian Rupees</Text>
            </View>
            <View style={styles.balanceRight}>
              {(balance ?? 0) >= minWithdrawal ? (
                <TouchableOpacity
                  style={[styles.withdrawCtaBtn, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
                  onPress={showWithdrawConfirm}
                  disabled={withdrawing}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-up-outline" size={17} color="rgba(255,255,255,0.9)" />
                  <Text style={[styles.withdrawCtaText, { color: 'rgba(255,255,255,0.9)' }]}>{t('wallet.withdraw')}</Text>
                </TouchableOpacity>
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
            <View style={{ flex: 1 }}>
              <Text style={[styles.statValue, { color: c.success }]} numberOfLines={1}>
                ₹{formatINRCompact(totalEarned)}
              </Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]} numberOfLines={1}>Total Earned</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <View style={[styles.statIconWrap, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="arrow-up-outline" size={17} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statValue, { color: c.primary }]} numberOfLines={1}>
                ₹{formatINRCompact(totalWithdrawn)}
              </Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]} numberOfLines={1}>Withdrawn</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <View style={[styles.statIconWrap, { backgroundColor: pendingCount > 0 ? c.warning + '15' : c.textTertiary + '15' }]}>
              <Ionicons name="time-outline" size={17} color={pendingCount > 0 ? c.warning : c.textTertiary} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: c.text }]} numberOfLines={1}>{pendingCount}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]} numberOfLines={1}>Pending</Text>
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
                {(['all', 'completed', 'pending', 'failed', 'reversed', 'rejected'] as TxStatus[]).map((f) => (
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
                        ? 'cash-outline'
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

      {/* Withdraw Confirmation Modal — select verified payment detail */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={confirmModalStyles.overlay}>
          <View style={[confirmModalStyles.sheet, { backgroundColor: c.surface }]}>
            <View style={confirmModalStyles.iconWrap}>
              <Ionicons name="arrow-up-outline" size={28} color={c.primary} />
            </View>
            <Text style={[confirmModalStyles.title, { color: c.text }]}>
              {t('wallet.confirmWithdrawTitle') ?? 'Withdraw Money'}
            </Text>

            {/* Balance display */}
            <Text style={[confirmModalStyles.balanceLabel, { color: c.textTertiary }]}>
              {t('wallet.availableBalance')}
            </Text>
            <Text style={[confirmModalStyles.balanceValue, { color: c.text }]}>
              ₹{(balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>

            {/* Amount input */}
            <View style={[confirmModalStyles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
              <Text style={[confirmModalStyles.inputRupee, { color: c.textSecondary }]}>₹</Text>
              <TextInput
                style={[confirmModalStyles.input, { color: c.text }]}
                placeholder={String(minWithdrawal)}
                placeholderTextColor={c.textTertiary}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={(v) => setWithdrawAmount(v.replace(/[^0-9.]/g, ''))}
                maxLength={8}
                autoFocus
              />
            </View>
            {!isValidAmount && withdrawAmount.length > 0 && (
              <Text style={[confirmModalStyles.errorText, { color: c.error }]}>
                Min ₹{minWithdrawal.toLocaleString('en-IN')} · Max ₹{(balance ?? 0).toLocaleString('en-IN')}
              </Text>
            )}

            {/* Payment method selector */}
            <Text style={[confirmModalStyles.sectionLabel, { color: c.textSecondary }]}>
              Payment Method
            </Text>

            {loadingDetails ? (
              <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: tokens.spacing4 }} />
            ) : paymentDetails.length === 0 ? (
              <View style={[confirmModalStyles.noDetailsBox, { borderColor: c.warning + '44', backgroundColor: c.warning + '0a' }]}>
                <Text style={[confirmModalStyles.noDetailsText, { color: c.warning }]}>
                  No payment methods found.
                </Text>
                <Text style={[confirmModalStyles.noDetailsSub, { color: c.textSecondary }]}>
                  Add one in Payment Methods first.
                </Text>
              </View>
            ) : (
              <View style={confirmModalStyles.pdList}>
                {paymentDetails
                  .filter((d) => d.status === 'verified')
                  .map((detail) => (
                    <TouchableOpacity
                      key={detail.id}
                      style={[
                        confirmModalStyles.pdItem,
                        { borderColor: c.border, backgroundColor: selectedPaymentDetailId === detail.id ? c.primary + '12' : 'transparent' },
                      ]}
                      onPress={() => { setSelectedPaymentDetailId(detail.id); setPayoutError(''); }}
                    >
                      <Ionicons
                        name={detail.payoutMethod === 'upi' ? 'at' : 'card-outline'}
                        size={16}
                        color={selectedPaymentDetailId === detail.id ? c.primary : c.textSecondary}
                      />
                      <View style={{ flex: 1, marginLeft: tokens.spacing2 }}>
                        <Text style={[confirmModalStyles.pdValue, { color: c.text }]}>
                          {detail.payoutMethod === 'upi' ? detail.displayValue : `A/c ${detail.displayValue}`}
                        </Text>
                        {detail.payoutMethod === 'bank_transfer' && detail.bankName && (
                          <Text style={[confirmModalStyles.pdBank, { color: c.textSecondary }]}>{detail.bankName}</Text>
                        )}
                      </View>
                      {selectedPaymentDetailId === detail.id && (
                        <Ionicons name="checkmark-circle" size={18} color={c.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                {paymentDetails.filter((d) => d.status === 'verified').length === 0 && (
                  <Text style={[confirmModalStyles.noVerified, { color: c.textTertiary }]}>
                    No verified payment methods. Add one in Payment Methods.
                  </Text>
                )}
              </View>
            )}

            {payoutError ? (
              <Text style={[confirmModalStyles.errorText, { color: c.error }]}>{payoutError}</Text>
            ) : null}

            <View style={confirmModalStyles.actions}>
              <TouchableOpacity
                style={[confirmModalStyles.btn, confirmModalStyles.btnCancel, { borderColor: c.border }]}
                onPress={() => setConfirmOpen(false)}
              >
                <Text style={[confirmModalStyles.btnCancelText, { color: c.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  confirmModalStyles.btn,
                  confirmModalStyles.btnConfirm,
                  { backgroundColor: isValidAmount && selectedPaymentDetailId ? c.primary : c.textTertiary },
                ]}
                onPress={handleWithdraw}
                disabled={!isValidAmount || !selectedPaymentDetailId || withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[confirmModalStyles.btnConfirmText, { color: '#fff' }]}>
                    {t('wallet.confirm') ?? 'Withdraw'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  balanceAmount: { fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
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
  statValue: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  statLabel: { fontSize: 10, flexShrink: 1, marginTop: 1 },

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

const confirmModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing5 },
  sheet: {
    width: '100%', maxWidth: 340,
    borderRadius: tokens.radiusXl,
    paddingVertical: tokens.spacing6,
    paddingHorizontal: tokens.spacing5,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#e0f2ef',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: tokens.spacing4,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: tokens.spacing4, textAlign: 'center' },
  balanceLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  balanceValue: { fontSize: 22, fontWeight: '800', marginBottom: tokens.spacing4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3, height: 50,
    width: '100%', marginBottom: 6,
  },
  inputRupee: { fontSize: 18, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 0 },
  errorText: { fontSize: 12, fontWeight: '500', marginBottom: tokens.spacing3 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: tokens.spacing2, alignSelf: 'flex-start' },
  payoutMethodRow: { flexDirection: 'row', gap: tokens.spacing2, width: '100%', marginBottom: tokens.spacing3 },
  payoutMethodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: tokens.radiusMd, height: 46,
  },
  payoutMethodLabel: { fontSize: 14, fontWeight: '700' },
  bankFields: { width: '100%', gap: tokens.spacing2 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: tokens.spacing5 },
  actions: { flexDirection: 'row', gap: tokens.spacing3, width: '100%' },
  btn: { flex: 1, height: 46, borderRadius: tokens.radiusLg, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1 },
  btnCancelText: { fontSize: 15, fontWeight: '600' },
  btnConfirm: {},
  btnConfirmText: { fontSize: 15, fontWeight: '700' },

  // Payment detail selector
  noDetailsBox: { borderWidth: 1.5, borderRadius: tokens.radiusMd, padding: tokens.spacing3, alignItems: 'center', width: '100%' , marginBottom: tokens.spacing3 },
  noDetailsText: { fontSize: 14, fontWeight: '700' },
  noDetailsSub: { fontSize: 12, marginTop: 2 },
  pdList: { width: '100%', gap: tokens.spacing2, marginBottom: tokens.spacing3 },
  pdItem: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: tokens.radiusMd,
    padding: tokens.spacing3, gap: tokens.spacing2,
  },
  pdValue: { fontSize: 14, fontWeight: '700' },
  pdBank: { fontSize: 11, marginTop: 1 },
  noVerified: { fontSize: 13, textAlign: 'center', fontStyle: 'italic', marginVertical: tokens.spacing3 },
});