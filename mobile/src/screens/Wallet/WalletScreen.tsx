import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Ionicons } from '@expo/vector-icons';
import { TooltipIcon } from '../../components/TooltipIcon';
import { EmptyState } from '../../components/Loading';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { walletApi, getErrorMessage } from '../../api/client';
import { MIN_WITHDRAWAL } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { Transaction } from '../../types';

const payoutOptions = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function WalletScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [balanceRes, txRes] = await Promise.all([
        walletApi.getBalance(),
        walletApi.getTransactions(),
      ]);
      setBalance(balanceRes.data.balance);
      setTransactions(txRes.data.transactions ?? []);
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

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      showToast(`Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`, 'warning');
      return;
    }
    if (amount > (balance ?? 0)) {
      showToast(t('wallet.exceedBalance'), 'warning');
      return;
    }
    if (payoutMethod === 'upi' && !upiId.trim()) {
      showToast(t('wallet.enterUpiId'), 'warning');
      return;
    }
    if (payoutMethod === 'bank_transfer' && (!accountHolder.trim() || !accountNumber.trim() || !ifscCode.trim())) {
      showToast(t('wallet.fillBankDetails'), 'warning');
      return;
    }

    setWithdrawing(true);
    try {
      const payoutDetails =
        payoutMethod === 'upi'
          ? { upiId: upiId.trim() }
          : { accountHolderName: accountHolder.trim(), accountNumber: accountNumber.trim(), ifscCode: ifscCode.trim() };

      await walletApi.withdraw({ amount, payoutMethod, payoutDetails });
      showToast(t('wallet.success'), 'success');
      setShowWithdraw(false);
      setWithdrawAmount('');
      setUpiId('');
      setAccountHolder('');
      setAccountNumber('');
      setIfscCode('');
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

  const statusColors: Record<string, string> = {
    completed: c.success, pending: c.warning, failed: c.error, reversed: c.textTertiary,
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

        {/* t('wallet.withdraw') */}
        {!showWithdraw ? (
          <View style={styles.withdrawSection}>
            <Button
              title={`${t('wallet.withdraw')}  ·  ${t('wallet.minWithdrawal', { amount: MIN_WITHDRAWAL })}`}
              onPress={() => setShowWithdraw(true)}
              disabled={(balance ?? 0) < MIN_WITHDRAWAL}
              variant="outline"
            />
          </View>
        ) : (
          <View style={[styles.withdrawCard, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Text style={[styles.withdrawTitle, { color: c.text }]}>{t('wallet.requestWithdrawal')}</Text>
            <Input
              label={t('wallet.amount')}
              placeholder={t('wallet.amountPlaceholder', { amount: MIN_WITHDRAWAL })}
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />
            <Select
              label="Payout Method"
              value={payoutMethod}
              options={payoutOptions}
              onChange={setPayoutMethod}
            />
            {payoutMethod === 'upi' ? (
              <Input
                label={t('wallet.upiId')}
                placeholder={t('wallet.upiIdPlaceholder')}
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />
            ) : (
              <>
                <Input label={t('wallet.accountHolderName')} placeholder={t('wallet.accountHolderPlaceholder')} value={accountHolder} onChangeText={setAccountHolder} autoCapitalize="words" />
                <Input label={t('wallet.accountNumber')} placeholder={t('wallet.accountNumberPlaceholder')} keyboardType="numeric" value={accountNumber} onChangeText={setAccountNumber} autoCapitalize="none" />
                <Input label={t('wallet.ifscCode')} placeholder={t('wallet.ifscCodePlaceholder')} value={ifscCode} onChangeText={(t) => setIfscCode(t.toUpperCase())} autoCapitalize="characters" maxLength={11} />
              </>
            )}
            <View style={styles.withdrawActions}>
              <Button title={t('wallet.cancel')} variant="ghost" onPress={() => setShowWithdraw(false)} />
              <Button title={t('wallet.submitRequest')} onPress={handleWithdraw} loading={withdrawing} />
            </View>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>{t('wallet.transactionHistory')}</Text>
            <TooltipIcon description={t('wallet.txTooltip')} />
          </View>
          {transactions.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              iconColor={c.textTertiary}
              title={t('wallet.noTransactions')}
              message={t('wallet.noTransactionsDesc')}
            />
          ) : (
            transactions.map((tx) => (
              <View
                key={tx.id}
                style={[styles.txRow, { backgroundColor: c.surface, ...tokens.shadowXs }]}
              >
                <View style={styles.txLeft}>
                  <Text style={[styles.txSource, { color: c.text }]}>
                    {tx.source.charAt(0).toUpperCase() + tx.source.slice(1).replace(/_/g, ' ')}
                  </Text>
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
                    {tx.type === 'credit' ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN')}
                  </Text>
                  <Text style={[styles.txStatus, { color: statusColors[tx.status] ?? c.textTertiary }]}>
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  withdrawCard: { borderRadius: tokens.radiusXl, padding: tokens.spacing5, marginBottom: tokens.spacing5 },
  withdrawTitle: { fontSize: 17, fontWeight: '700', marginBottom: tokens.spacing4 },
  withdrawActions: { flexDirection: 'row', gap: tokens.spacing3, marginTop: tokens.spacing2 },
  section: { marginTop: tokens.spacing2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing3 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  txRow: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  txLeft: {},
  txSource: { fontSize: 14, fontWeight: '600' },
  txDate: { fontSize: 11, marginTop: 2, letterSpacing: 0.01 * 11 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txStatus: { fontSize: 11, marginTop: 2 },
});