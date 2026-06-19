import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { ConfirmModal } from '../../components/ConfirmModal';
import { walletApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';

type PaymentDetailStatus = 'pending' | 'in_progress' | 'verified' | 'failed';

interface PaymentDetail {
  id: string;
  payoutMethod: 'upi' | 'bank_transfer';
  status: PaymentDetailStatus;
  displayValue: string;
  bankName: string | null;
  ifsc: string | null;
  accountHolderName: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<PaymentDetailStatus, { label: string; color: string; icon: string }> = {
  verified: { label: 'Verified', color: '#22c55e', icon: 'checkmark-circle' },
  in_progress: { label: 'Verifying...', color: '#f59e0b', icon: 'time-outline' },
  pending: { label: 'Pending', color: '#a0a0a0', icon: 'time-outline' },
  failed: { label: 'Failed', color: '#ef4444', icon: 'close-circle' },
};

export function PaymentDetailsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation();


  const [details, setDetails] = useState<PaymentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingDetail, setDeletingDetail] = useState<PaymentDetail | null>(null);

  // Form state
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [formError, setFormError] = useState('');
  const [apiError, setApiError] = useState('');

  const fetchDetails = useCallback(async () => {
    try {
      const res = await walletApi.getPaymentDetails();
      setDetails(res.data as PaymentDetail[]);
      setApiError('');
    } catch (e) {
      setApiError(getErrorMessage(e, 'Failed to load payment details'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  function resetForm() {
    setUpiId('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfsc('');
    setAccountHolderName('');
    setBankName('');
    setFormError('');
    setPayoutMethod('upi');
  }

  function validate(): boolean {
    if (payoutMethod === 'upi') {
      if (!upiId || !/^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9]{2,15}$/.test(upiId)) {
        setFormError('Enter a valid UPI ID (e.g. yourname@upi)');
        return false;
      }
    } else {
      if (!accountNumber || !/^\d{9,18}$/.test(accountNumber)) {
        setFormError('Account number must be 9–18 digits');
        return false;
      }
      if (accountNumber !== confirmAccountNumber) {
        setFormError('Account numbers do not match');
        return false;
      }
      if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        setFormError('IFSC must be 11 characters (e.g. SBIN0001234)');
        return false;
      }
      if (!accountHolderName || accountHolderName.trim().length < 2) {
        setFormError('Enter the account holder name');
        return false;
      }
    }
    setFormError('');
    return true;
  }

  async function handleAdd() {
    if (!validate()) return;
    setAdding(true);
    try {
      const data = payoutMethod === 'upi'
        ? { payoutMethod, upiId: upiId.trim() }
        : {
            payoutMethod,
            accountNumber: accountNumber.trim(),
            confirmAccountNumber: confirmAccountNumber.trim(),
            ifsc: ifsc.trim().toUpperCase(),
            accountHolderName: accountHolderName.trim(),
            bankName: bankName.trim() || undefined,
          };
      const res = await walletApi.addPaymentDetail(data);
      const result = res.data as { message: string };
      setApiError('');
      resetForm();
      setShowForm(false);
      await fetchDetails();
    } catch (e) {
      setApiError(getErrorMessage(e, 'Failed to add payment detail'));
    } finally {
      setAdding(false);
    }
  }

  function handleDeletePrompt(detail: PaymentDetail) {
    setDeletingDetail(detail);
  }

  async function handleDeleteConfirm() {
    if (!deletingDetail) return;
    setDeletingId(deletingDetail.id);
    setDeletingDetail(null);
    try {
      await walletApi.deletePaymentDetail(deletingDetail.id);
      setApiError('');
      await fetchDetails();
    } catch (e) {
      setApiError(getErrorMessage(e, 'Delete failed'));
    } finally {
      setDeletingId(null);
    }
  }

  function renderDetail({ item }: { item: PaymentDetail }) {
    const statusCfg = STATUS_CONFIG[item.status];
    const isDeletable = item.status === 'pending' || item.status === 'failed';

    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Ionicons
              name={item.payoutMethod === 'upi' ? 'at' : 'card-outline'}
              size={20}
              color={c.primary}
            />
            <View style={{ marginLeft: tokens.spacing2 }}>
              <Text style={[styles.cardValue, { color: c.text }]}>
                {item.payoutMethod === 'upi' ? item.displayValue : `A/c ${item.displayValue}`}
              </Text>
              {item.payoutMethod === 'bank_transfer' && item.bankName && (
                <Text style={[styles.cardSub, { color: c.textSecondary }]}>{item.bankName}</Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
            <Ionicons name={statusCfg.icon as any} size={13} color={statusCfg.color} />
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Bank extra info */}
        {item.payoutMethod === 'bank_transfer' && item.ifsc && (
          <View style={styles.bankInfoRow}>
            <Text style={[styles.bankInfoText, { color: c.textSecondary }]}>
              {item.accountHolderName} · IFSC: {item.ifsc}
            </Text>
          </View>
        )}

        {/* Status note */}
        {item.status === 'in_progress' && (
          <View style={[styles.statusNote, { backgroundColor: '#f59e0b10', borderColor: '#f59e0b30' }]}>
            <Ionicons name="information-circle-outline" size={14} color="#f59e0b" />
            <Text style={[styles.statusNoteText, { color: '#f59e0b' }]}>
              ₹1 verification charge applied. You'll be notified once confirmed.
            </Text>
          </View>
        )}

        {item.status === 'failed' && (
          <View style={[styles.statusNote, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}>
            <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
            <Text style={[styles.statusNoteText, { color: '#ef4444' }]}>
              Verification failed. Please check details and try again.
            </Text>
          </View>
        )}

        {/* Delete button */}
        {isDeletable && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: '#ef444430' }]}
            onPress={() => handleDeletePrompt(item)}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Remove</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Payment Methods</Text>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm((v) => !v); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={26} color={c.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error banner */}
        {apiError ? (
          <View style={[styles.errorBanner, { backgroundColor: c.error + '12', borderColor: c.error + '35' }]}>
            <Ionicons name="alert-circle-outline" size={18} color={c.error} />
            <Text style={[styles.errorBannerText, { color: c.error }]}>{apiError}</Text>
            <TouchableOpacity onPress={() => setApiError('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={c.error} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: c.primary + '10', borderColor: c.primary + '30' }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={c.primary} />
          <Text style={[styles.infoBannerText, { color: c.textSecondary }]}>
            Payment methods are verified with a ₹1 micro-transaction before use.
          </Text>
        </View>

        {/* Add form */}
        {showForm && (
          <View style={[styles.formCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.formTitle, { color: c.text }]}>Add Payment Method</Text>

            {/* Method toggle */}
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  { borderColor: c.border, backgroundColor: payoutMethod === 'upi' ? c.primary + '15' : 'transparent' },
                ]}
                onPress={() => { setPayoutMethod('upi'); setFormError(''); }}
              >
                <Ionicons name="at" size={16} color={payoutMethod === 'upi' ? c.primary : c.textTertiary} />
                <Text style={[styles.methodLabel, { color: payoutMethod === 'upi' ? c.primary : c.textSecondary }]}>UPI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  { borderColor: c.border, backgroundColor: payoutMethod === 'bank_transfer' ? c.primary + '15' : 'transparent' },
                ]}
                onPress={() => { setPayoutMethod('bank_transfer'); setFormError(''); }}
              >
                <Ionicons name="card-outline" size={16} color={payoutMethod === 'bank_transfer' ? c.primary : c.textTertiary} />
                <Text style={[styles.methodLabel, { color: payoutMethod === 'bank_transfer' ? c.primary : c.textSecondary }]}>Bank Account</Text>
              </TouchableOpacity>
            </View>

            {payoutMethod === 'upi' ? (
              <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
                <Text style={[styles.inputPrefix, { color: c.textSecondary }]}>@</Text>
                <TextInput
                  style={[styles.input, { color: c.text }]}
                  placeholder="yourname@upi"
                  placeholderTextColor={c.textTertiary}
                  value={upiId}
                  onChangeText={(v) => { setUpiId(v.trim()); setFormError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  maxLength={50}
                />
              </View>
            ) : (
              <View style={styles.bankFields}>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="Account number"
                    placeholderTextColor={c.textTertiary}
                    value={accountNumber}
                    onChangeText={(v) => { setAccountNumber(v.replace(/\s/g, '')); setFormError(''); }}
                    keyboardType="number-pad"
                    maxLength={18}
                  />
                </View>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="Confirm account number"
                    placeholderTextColor={c.textTertiary}
                    value={confirmAccountNumber}
                    onChangeText={(v) => { setConfirmAccountNumber(v.replace(/\s/g, '')); setFormError(''); }}
                    keyboardType="number-pad"
                    maxLength={18}
                  />
                </View>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="IFSC code (e.g. SBIN0001234)"
                    placeholderTextColor={c.textTertiary}
                    value={ifsc}
                    onChangeText={(v) => { setIfsc(v.toUpperCase()); setFormError(''); }}
                    autoCapitalize="characters"
                    maxLength={11}
                  />
                </View>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="Account holder name"
                    placeholderTextColor={c.textTertiary}
                    value={accountHolderName}
                    onChangeText={(v) => { setAccountHolderName(v); setFormError(''); }}
                    autoCapitalize="words"
                    maxLength={50}
                  />
                </View>
                <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.background }]}>
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="Bank name (optional)"
                    placeholderTextColor={c.textTertiary}
                    value={bankName}
                    onChangeText={setBankName}
                    autoCapitalize="words"
                    maxLength={100}
                  />
                </View>
              </View>
            )}

            {formError ? (
              <Text style={[styles.formError, { color: c.error }]}>{formError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: adding ? c.textTertiary : c.primary }]}
              onPress={handleAdd}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Add & Verify</Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.chargeNote, { color: c.textTertiary }]}>
              A ₹1 verification charge will be applied and refunded upon confirmation.
            </Text>
          </View>
        )}

        {/* List */}
        {loading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: tokens.spacing6 }} />
        ) : details.length === 0 && !showForm ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={56} color={c.textTertiary} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>No payment methods</Text>
            <Text style={[styles.emptySub, { color: c.textSecondary }]}>
              Add a UPI ID or bank account to enable withdrawals.
            </Text>
          </View>
        ) : (
          <FlatList
            data={details}
            renderItem={renderDetail}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: tokens.spacing3 }}
          />
        )}
      </ScrollView>

      <ConfirmModal
        visible={deletingDetail !== null}
        title="Remove Payment Method"
        message={
          deletingDetail?.payoutMethod === 'upi'
            ? `Remove ${deletingDetail.displayValue} from your payment methods?`
            : `Remove ${deletingDetail?.displayValue} from your payment methods?`
        }
        confirmLabel="Remove"
        variant="danger"
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingDetail(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing5,
    paddingVertical: tokens.spacing4,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: tokens.spacing5 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    padding: tokens.spacing3,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    marginBottom: tokens.spacing4,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    padding: tokens.spacing3,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    marginBottom: tokens.spacing5,
  },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },

  formCard: {
    borderWidth: 1,
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing5,
    marginBottom: tokens.spacing5,
  },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: tokens.spacing4 },
  methodRow: { flexDirection: 'row', gap: tokens.spacing2, marginBottom: tokens.spacing4 },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    height: 46,
  },
  methodLabel: { fontSize: 14, fontWeight: '700' },
  bankFields: { gap: tokens.spacing2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    height: 50,
    marginBottom: 4,
  },
  inputPrefix: { fontSize: 18, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 0 },
  formError: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing3 },
  submitBtn: {
    height: 50,
    borderRadius: tokens.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing3,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chargeNote: { fontSize: 12, textAlign: 'center', marginTop: tokens.spacing2 },

  card: {
    borderWidth: 1,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardValue: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  bankInfoRow: { marginTop: tokens.spacing2 },
  bankInfoText: { fontSize: 12 },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing2,
    marginTop: tokens.spacing3,
  },
  statusNoteText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    height: 36,
    marginTop: tokens.spacing3,
  },
  deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: tokens.spacing8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing4 },
  emptySub: { fontSize: 14, marginTop: tokens.spacing2, textAlign: 'center', paddingHorizontal: tokens.spacing6 },
});