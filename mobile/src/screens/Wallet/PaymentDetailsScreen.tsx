import React, { useState, useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { ConfirmModal } from '../../components/ConfirmModal';
import { walletApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import RazorpayCheckout from 'react-native-razorpay';

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
  paymentLinkUrl?: string;
}

const STATUS_CONFIG: Record<PaymentDetailStatus, { label: string; color: string; icon: string }> = {
  verified: { label: 'Verified', color: '#22c55e', icon: 'checkmark-circle' },
  in_progress: { label: 'Verification Pending', color: '#f59e0b', icon: 'time-outline' },
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
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>('');
  const [razorpayLoading, setRazorpayLoading] = useState<string | null>(null); // paymentDetailId being processed

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
  // Temporary inline warning shown inside a payment detail card, auto-dismisses after 5s
  const [upiWarning, setUpiWarning] = useState<{ id: string; message: string } | null>(null);

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
    // Fetch razorpay key_id needed for native SDK
    walletApi.getWalletConfig().then((res) => {
      const config = res.data as { razorpayKeyId?: string };
      if (config?.razorpayKeyId) setRazorpayKeyId(config.razorpayKeyId);
    }).catch(() => { /* non-fatal */ });
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

  /**
   * Shows an inline warning inside the payment detail card, auto-dismisses after 5s.
   */
  function showInlineWarning(id: string, message: string) {
    setUpiWarning({ id, message });
    setTimeout(() => {
      setUpiWarning((prev) => (prev?.id === id ? null : prev));
    }, 5000);
  }

  /**
   * Bank transfer → open Razorpay SDK with netbanking only.
   */
  async function handleBankVerify(item: PaymentDetail) {
    if (!razorpayKeyId) {
      setApiError('Razorpay key not available. Please refresh and try again.');
      return;
    }

    setRazorpayLoading(item.id);
    setApiError('');

    try {
      const options = {
        description: `Verify bank account — ₹1 refundable`,
        currency: 'INR',
        amount: '100',
        name: 'AnnaDatha',
        key: razorpayKeyId,
        prefill: {},
        theme: { color: '#53A86F' },
        // Netbanking only — no UPI, no cards, no wallet clutter
        config: {
          display: {
            blocks: {
              verification_methods: {
                name: 'Select Bank',
                instruments: [{ method: 'netbanking' }],
              },
            },
            sequence: ['block.verification_methods'],
            preferences: { show_default_blocks: false },
          },
        },
        notes: {
          payment_detail_id: item.id,
          purpose: 'verification',
        },
      };

      const paymentResult = await RazorpayCheckout.open(options);

      if (paymentResult?.razorpay_payment_id) {
        await walletApi.verifyPayment(item.id, paymentResult.razorpay_payment_id);
        await fetchDetails();
      }
    } catch (err: any) {
      if (err?.error?.code === 'USER_CANCELLED') return;
      const desc = err?.error?.description || '';
      if (desc) setApiError(desc);
    } finally {
      setRazorpayLoading(null);
    }
  }

  /**
   * UPI → construct UPI intent URL and open the app directly.
   * No Razorpay SDK involved — just a raw UPI deep link.
   * Backend receives the ₹1 via Razorpay webhook after user pays.
   */
  async function handleUpiVerify(item: PaymentDetail) {
    const upiUrl = `upi://pay?pa=${encodeURIComponent(item.displayValue)}&pn=AnnaDatha&am=1&cu=INR&tn=Verify+UPI+ID`;

    setRazorpayLoading(item.id);
    setApiError('');

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (!canOpen) {
        showInlineWarning(
          item.id,
          'No UPI app found. Please install Google Pay, PhonePe, or Paytm to continue.',
        );
        return;
      }

      await Linking.openURL(upiUrl);

      // Let the user complete payment in the UPI app.
      // Backend receives the ₹1 via Razorpay webhook → marks detail as verified.
      showInlineWarning(
        item.id,
        'Complete the payment in your UPI app, then come back to check verification status.',
      );
    } catch (err) {
      // Linking.openURL threw — no app handled the UPI URL
      showInlineWarning(
        item.id,
        'Could not open UPI app. Please install Google Pay, PhonePe, or Paytm.',
      );
    } finally {
      setRazorpayLoading(null);
    }
  }

  /**
   * Routes to the appropriate verify flow based on payout method.
   */
  async function handleVerify(item: PaymentDetail) {
    if (item.payoutMethod === 'upi') {
      await handleUpiVerify(item);
    } else {
      await handleBankVerify(item);
    }
  }

  function renderDetail({ item }: { item: PaymentDetail }) {
    const statusCfg = STATUS_CONFIG[item.status];
    const isUpi = item.payoutMethod === 'upi';
    const accentColor = statusCfg.color;

    const isLoading = razorpayLoading === item.id;
    const canVerify = item.status === 'in_progress' && (item.paymentLinkUrl || isUpi);
    const canRemove = item.status !== 'in_progress';

    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

        {/* Main content */}
        <View style={styles.cardBody}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={styles.cardLeft}>
              <View style={[styles.methodIconWrap, { backgroundColor: accentColor + '15' }]}>
                <Ionicons
                  name={isUpi ? 'at' : 'card-outline'}
                  size={16}
                  color={accentColor}
                />
              </View>
              <View style={{ marginLeft: tokens.spacing3 }}>
                <Text style={[styles.cardValue, { color: c.text }]}>
                  {isUpi ? item.displayValue : `A/c ***${item.displayValue.slice(-4)}`}
                </Text>
                <View style={styles.cardMetaRow}>
                  <Text style={[styles.cardMeta, { color: c.textSecondary }]}>
                    {isUpi ? 'UPI ID' : (item.bankName || 'Bank Account')}
                  </Text>
                  {isUpi && (
                    <View style={[styles.statusBadge, { backgroundColor: accentColor + '18' }]}>
                      <Ionicons name={statusCfg.icon as any} size={11} color={accentColor} />
                      <Text style={[styles.statusLabel, { color: accentColor }]}>{statusCfg.label}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Status badge — only for bank_transfer, UPI shows it inline above */}
            {!isUpi && (
              <View style={[styles.statusBadge, { backgroundColor: accentColor + '18' }]}>
                <Ionicons name={statusCfg.icon as any} size={11} color={accentColor} />
                <Text style={[styles.statusLabel, { color: accentColor }]}>{statusCfg.label}</Text>
              </View>
            )}
          </View>

          {/* Bank extra details */}
          {!isUpi && item.ifsc && (
            <View style={[styles.bankDetailRow, { borderTopColor: c.border }]}>
              <Text style={[styles.bankDetailText, { color: c.textSecondary }]}>
                {item.accountHolderName} · IFSC: {item.ifsc}
              </Text>
            </View>
          )}

          {/* ── Verified state: only remove button ── */}
          {item.status === 'verified' && canRemove && (
            <TouchableOpacity
              style={[styles.removeBtn, { borderColor: '#ef444430' }]}
              onPress={() => handleDeletePrompt(item)}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={13} color="#ef4444" />
                  <Text style={styles.removeBtnText}>Remove</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* ── Failed state: error + retry ── */}
          {item.status === 'failed' && (
            <View style={styles.actionArea}>
              <View style={[styles.alertRow, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}>
                <Ionicons name="alert-circle" size={14} color="#ef4444" />
                <Text style={[styles.alertText, { color: '#ef4444' }]}>
                  Verification failed. Check details and try again.
                </Text>
              </View>
              {canVerify && (
                <TouchableOpacity
                  style={[styles.verifyBtn, { backgroundColor: '#22c55e' }, isLoading && styles.verifyBtnDisabled]}
                  onPress={() => handleVerify(item)}
                  disabled={isLoading || (!isUpi && !razorpayKeyId)}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={13} color="#fff" />
                      <Text style={styles.verifyBtnText}>Retry Verification</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {canRemove && (
                <TouchableOpacity
                  style={[styles.removeBtn, { borderColor: '#ef444430' }]}
                  onPress={() => handleDeletePrompt(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={13} color="#ef4444" />
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── In progress / pending state: instruction + verify ── */}
          {(item.status === 'in_progress' || item.status === 'pending') && (
            <View style={styles.actionArea}>
              <View style={[styles.instructionRow, { borderColor: '#f59e0b30' }]}>
                <Ionicons name="information-circle" size={14} color="#f59e0b" />
                <Text style={[styles.instructionText, { color: '#f59e0b' }]}>
                  Pay ₹1 to verify your {isUpi ? 'UPI ID' : 'bank account'}.
                </Text>
              </View>

              {/* Inline warning that auto-dismisses after 5s */}
              {upiWarning?.id === item.id && (
                <View style={[styles.inlineWarning, { backgroundColor: '#f59e0b12', borderColor: '#f59e0b40' }]}>
                  <Ionicons name="warning" size={14} color="#f59e0b" />
                  <Text style={[styles.inlineWarningText, { color: '#f59e0b' }]}>{upiWarning.message}</Text>
                </View>
              )}

              {canVerify ? (
                <TouchableOpacity
                  style={[styles.verifyBtn, { backgroundColor: '#22c55e' }, isLoading && styles.verifyBtnDisabled]}
                  onPress={() => handleVerify(item)}
                  disabled={isLoading || (!isUpi && !razorpayKeyId)}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name={isUpi ? 'open-outline' : 'shield-checkmark-outline'} size={13} color="#fff" />
                      <Text style={styles.verifyBtnText}>Verify with {isUpi ? 'UPI' : 'Net Banking'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={[styles.smsNote, { color: c.textTertiary }]}>
                  Payment link will be sent via SMS shortly.
                </Text>
              )}

              {canRemove && (
                <TouchableOpacity
                  style={[styles.removeBtn, { borderColor: '#ef444430' }]}
                  onPress={() => handleDeletePrompt(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={13} color="#ef4444" />
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
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

  // ── Card ──────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: tokens.spacing4,
    gap: tokens.spacing3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardValue: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
  },
  cardMeta: { fontSize: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  bankDetailRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: tokens.spacing2,
  },
  bankDetailText: { fontSize: 12 },

  // ── Action area ─────────────────────────────────────────────────────────
  actionArea: {
    gap: tokens.spacing2,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderLeftWidth: 3,
    paddingLeft: tokens.spacing2,
    borderLeftColor: '#f59e0b',
  },
  instructionText: { flex: 1, fontSize: 12, fontWeight: '600' },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing2,
  },
  alertText: { flex: 1, fontSize: 12, fontWeight: '600' },

  // ── Inline warning ──────────────────────────────────────────────────────
  inlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing2,
    paddingHorizontal: tokens.spacing3,
  },
  inlineWarningText: { flex: 1, fontSize: 12, fontWeight: '600' },

  // ── Buttons ─────────────────────────────────────────────────────────────
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusMd,
    height: 38,
    gap: 6,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  smsNote: { fontSize: 12, fontStyle: 'italic' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    height: 34,
    gap: 5,
  },
  removeBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: tokens.spacing8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing4 },
  emptySub: { fontSize: 14, marginTop: tokens.spacing2, textAlign: 'center', paddingHorizontal: tokens.spacing6 },
});