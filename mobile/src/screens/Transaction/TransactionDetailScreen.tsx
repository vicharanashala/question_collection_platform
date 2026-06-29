import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { walletApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { Transaction } from '../../types';
import { RootStackParamList } from '../../navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'TransactionDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TransactionDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colors;

  const { withdrawalId, initialStatus, initialReason } = route.params;

  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const statusColors: Record<string, string> = {
    completed: c.success,
    pending: c.warning,
    failed: c.error,
    reversed: c.textTertiary,
    rejected: c.error,
  };

  useEffect(() => {
    // Fetch all transactions and find the one whose referenceId matches this withdrawal
    walletApi.getTransactions()
      .then((res) => {
        const txs: Transaction[] = res.data.transactions ?? [];
        const match = txs.find((x) => x.referenceId === withdrawalId);
        if (match) {
          setTx(match);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [withdrawalId]);

  // Derive display values — use fetched tx, or build from notification payload
  const displayTx = tx ?? (notFound ? null : {
    id: withdrawalId,
    referenceId: withdrawalId,
    status: initialStatus as Transaction['status'],
    rejectionReason: initialReason ?? null,
    source: 'withdrawal' as const,
    type: 'debit' as const,
    amount: 0,
    balanceAfter: 0,
    description: null,
    createdAt: new Date().toISOString(),
    walletId: '',
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>
          {t('wallet.txDetail')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : !displayTx ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={56} color={c.textTertiary} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            Transaction not found
          </Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>
            The transaction may have been removed or is no longer available.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Amount + Status */}
          <View
            style={[
              styles.amountCard,
              {
                backgroundColor:
                  displayTx.type === 'credit'
                    ? c.success + '12'
                    : c.error + '12',
              },
            ]}
          >
            <Text
              style={[
                styles.amountLabel,
                { color: displayTx.type === 'credit' ? c.success : c.error },
              ]}
            >
              {displayTx.type === 'credit' ? 'Credit' : 'Debit'}
            </Text>
            <Text
              style={[
                styles.amountValue,
                { color: displayTx.type === 'credit' ? c.success : c.error },
              ]}
            >
              {displayTx.type === 'credit' ? '+' : '−'}₹
              {Number(displayTx.amount).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
              })}
            </Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    (statusColors[displayTx.status] ?? c.textTertiary) + '22',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusColors[displayTx.status] ?? c.textTertiary },
                ]}
              >
                {displayTx.status.charAt(0).toUpperCase() +
                  displayTx.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Meta rows */}
          <View style={styles.metaSection}>
            <MetaRow
              label={t('wallet.txSource')}
              value={
                displayTx.source
                  .charAt(0)
                  .toUpperCase() +
                displayTx.source
                  .slice(1)
                  .replace(/_/g, ' ')
              }
              c={c}
            />
            <MetaRow
              label={t('wallet.txType')}
              value={
                displayTx.type.charAt(0).toUpperCase() +
                displayTx.type.slice(1)
              }
              c={c}
            />
            <MetaRow
              label={t('wallet.txDate')}
              value={new Date(displayTx.createdAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              c={c}
            />
            {Number(displayTx.balanceAfter) > 0 && (
              <MetaRow
                label={t('wallet.txBalanceAfter')}
                value={`₹${Number(displayTx.balanceAfter).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}`}
                c={c}
              />
            )}
            {/* Rejection reason — shown for rejected withdrawals */}
            {(displayTx.rejectionReason ?? initialReason) && (
              <View
                style={[
                  styles.rejectionRow,
                  { backgroundColor: c.error + '10', borderColor: c.error + '30' },
                ]}
              >
                <Text style={[styles.rejectionLabel, { color: c.error }]}>
                  {t('wallet.rejectionReason', 'Rejection Reason')}
                </Text>
                <Text style={[styles.rejectionValue, { color: c.error }]} selectable>
                  {displayTx.rejectionReason ?? initialReason}
                </Text>
              </View>
            )}
            {/* Description (refund descriptions include the reason) */}
            {displayTx.description && (
              <MetaRow
                label={t('wallet.txDescription')}
                value={displayTx.description}
                c={c}
              />
            )}
            {/* Withdrawal reference ID */}
            {displayTx.referenceId && (
              <MetaRow
                label={t('wallet.withdrawalRef', 'Withdrawal ID')}
                value={displayTx.referenceId}
                c={c}
                mono
              />
            )}
            {/* UTR Number — shown once payment is processed (completed) */}
            {displayTx.status === 'completed' && (displayTx.utrNumber ?? displayTx.razorpayPayoutId) && (
              <View style={[styles.utrSection, { borderColor: c.success + '30', backgroundColor: c.success + '08' }]}>
                {displayTx.utrNumber && (
                  <MetaRow
                    label={t('wallet.utrNumber', 'UTR Number')}
                    value={displayTx.utrNumber}
                    c={c}
                    mono
                  />
                )}
                {displayTx.razorpayPayoutId && (
                  <MetaRow
                    label={t('wallet.razorpayPayoutId', 'Razorpay Payout ID')}
                    value={displayTx.razorpayPayoutId}
                    c={c}
                    mono
                  />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MetaRow({
  label,
  value,
  c,
  mono,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useTheme>['theme']['colors'];
  mono?: boolean;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: c.textTertiary }]}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          { color: c.text },
          mono && { fontFamily: 'monospace', fontSize: 12 },
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing2,
    paddingVertical: tokens.spacing2,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing6,
    gap: tokens.spacing3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  content: { padding: tokens.spacing5 },
  amountCard: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing5,
    alignItems: 'center',
    marginBottom: tokens.spacing5,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '800',
    marginVertical: tokens.spacing2,
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  metaSection: { gap: 0 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: tokens.spacing3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: tokens.spacing3,
  },
  metaLabel: { fontSize: 13, flex: 1 },
  metaValue: { fontSize: 13, flex: 2, textAlign: 'right', fontWeight: '500' },
  rejectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginTop: tokens.spacing3,
    gap: tokens.spacing3,
  },
  rejectionLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  rejectionValue: { fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  utrSection: {
    marginTop: tokens.spacing3,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    overflow: 'hidden',
  },
});