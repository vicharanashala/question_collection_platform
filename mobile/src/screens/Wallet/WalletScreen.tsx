import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/Loading';
import { walletApi } from '../../api/client';
import { MIN_WITHDRAWAL } from '../../utils/constants';
import { Transaction } from '../../types';

const payoutOptions = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function WalletScreen() {
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
    } catch {
      // Wallet may not exist yet for new users
    } finally {
      setLoading(false);
    }
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
      Alert.alert('Error', `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`);
      return;
    }
    if (amount > (balance ?? 0)) {
      Alert.alert('Error', 'Withdrawal amount exceeds available balance');
      return;
    }
    if (payoutMethod === 'upi' && !upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }
    if (payoutMethod === 'bank_transfer') {
      if (!accountHolder.trim() || !accountNumber.trim() || !ifscCode.trim()) {
        Alert.alert('Error', 'Please fill in all bank details');
        return;
      }
    }

    setWithdrawing(true);
    try {
      const payoutDetails =
        payoutMethod === 'upi'
          ? { upiId: upiId.trim() }
          : { accountHolderName: accountHolder.trim(), accountNumber: accountNumber.trim(), ifscCode: ifscCode.trim() };

      await walletApi.withdraw({ amount, payoutMethod, payoutDetails });
      Alert.alert('Success', 'Withdrawal request submitted. You will be notified once processed.');
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
        'Withdrawal failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setWithdrawing(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const statusColors: Record<string, string> = {
    completed: '#2E7D32',
    pending: '#F57C00',
    failed: '#C62828',
    reversed: '#757575',
  };

  if (loading) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Wallet</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{(balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.balanceCurrency}>INR</Text>
        </View>

        {/* Withdraw Button */}
        {!showWithdraw ? (
          <Button
            title={`Withdraw (Min ₹${MIN_WITHDRAWAL})`}
            onPress={() => setShowWithdraw(true)}
            disabled={(balance ?? 0) < MIN_WITHDRAWAL}
          />
        ) : (
          <View style={styles.withdrawCard}>
            <Text style={styles.withdrawTitle}>Request Withdrawal</Text>
            <Input
              label="Amount (₹)"
              placeholder={`Min ₹${MIN_WITHDRAWAL}`}
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
                label="UPI ID"
                placeholder="e.g., yourname@upi"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />
            ) : (
              <>
                <Input
                  label="Account Holder Name"
                  placeholder="Enter name as per bank records"
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                  autoCapitalize="words"
                />
                <Input
                  label="Account Number"
                  placeholder="Enter account number"
                  keyboardType="numeric"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  autoCapitalize="none"
                />
                <Input
                  label="IFSC Code"
                  placeholder="e.g., SBIN0001234"
                  value={ifscCode}
                  onChangeText={(t) => setIfscCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={11}
                />
              </>
            )}
            <View style={styles.withdrawActions}>
              <Button title="Cancel" variant="outline" onPress={() => setShowWithdraw(false)} />
              <View style={{ width: 12 }} />
              <Button title="Submit" onPress={handleWithdraw} loading={withdrawing} />
            </View>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {transactions.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No transactions yet"
              message="Your reward credits will appear here after question approvals"
            />
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txSource}>{tx.source.charAt(0).toUpperCase() + tx.source.slice(1)}</Text>
                  <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, tx.type === 'credit' ? styles.credit : styles.debit]}>
                    {tx.type === 'credit' ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN')}
                  </Text>
                  <Text style={[styles.txStatus, { color: statusColors[tx.status] ?? '#757575' }]}>
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
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  scroll: { padding: 20 },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1B5E20' },
  balanceCard: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: '#fff' },
  balanceCurrency: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  withdrawCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  withdrawTitle: { fontSize: 16, fontWeight: '700', color: '#212121', marginBottom: 16 },
  withdrawActions: { flexDirection: 'row', marginTop: 8 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#212121', marginBottom: 12 },
  txRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  txLeft: {},
  txSource: { fontSize: 14, fontWeight: '600', color: '#212121' },
  txDate: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  credit: { color: '#2E7D32' },
  debit: { color: '#C62828' },
  txStatus: { fontSize: 11, marginTop: 2 },
});