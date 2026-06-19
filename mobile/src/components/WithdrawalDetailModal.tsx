import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import { adminApi, getErrorMessage } from '../api/client';
import { tokens } from '../utils/theme';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:    { label: 'Pending',    color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' },
  processing: { label: 'Processing', color: '#7C3AED', bg: '#EDE9FE', icon: 'hourglass-outline' },
  completed:  { label: 'Completed',  color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  failed:     { label: 'Failed',     color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
  rejected:   { label: 'Rejected',   color: '#DC2626', bg: '#FEE2E2', icon: 'ban-outline' },
  cancelled:  { label: 'Cancelled',  color: '#6B7280', bg: '#F3F4F6', icon: 'slash-outline' },
};

const METHOD_CONFIG: Record<string, { label: string; icon: string }> = {
  upi:              { label: 'UPI',            icon: 'phone-portrait-outline' },
  UPI:              { label: 'UPI',            icon: 'phone-portrait-outline' },
  bank_transfer:    { label: 'Bank Transfer',  icon: 'business-outline' },
  BANK_TRANSFER:    { label: 'Bank Transfer',  icon: 'business-outline' },
  bank:             { label: 'Bank Transfer',  icon: 'business-outline' },
};

const STATUS_BAR_COLOR: Record<string, string> = {
  pending: '#D97706',
  processing: '#7C3AED',
  completed: '#059669',
  failed: '#DC2626',
  rejected: '#DC2626',
  cancelled: '#6B7280',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PayoutDetails {
  upiId?: string;
  upi_id?: string;
  accountNumber?: string;
  account_number?: string;
  ifsc?: string;
  ifscCode?: string;
  bankName?: string;
  bank_name?: string;
  accountHolderName?: string;
  account_holder_name?: string;
}

export interface WithdrawalDetailData {
  id: string;
  amount: number;
  payoutMethod: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  failureReason?: string | null;
  pinelabsTransactionId?: string | null;
  orderId?: string | null;
  payoutDetails?: PayoutDetails | null;
  user?: {
    id: string;
    name: string;
    mobileNumber: string;
    state: string;
  } | null;
}

interface WithdrawalDetailModalProps {
  item: WithdrawalDetailData | null;
  visible: boolean;
  onClose: () => void;
  isSuperAdmin?: boolean;
  onStatusChange?: (id: string, newStatus: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WithdrawalDetailModal({
  item,
  visible,
  onClose,
  isSuperAdmin = false,
  onStatusChange,
}: WithdrawalDetailModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (visible) setProcessing(false);
  }, [visible]);

  if (!item) return null;

  const status    = item.status ?? '';
  const statusCfg = STATUS_CONFIG[status] ?? { label: status, color: c.textSecondary, bg: c.surfaceVariant, icon: 'help-circle-outline' };
  const methodCfg = METHOD_CONFIG[item.payoutMethod] ?? { label: item.payoutMethod ?? 'Unknown', icon: 'help-circle-outline' };
  const pd        = item.payoutDetails ?? {};

  const isUPI        = item.payoutMethod === 'upi' || item.payoutMethod === 'UPI';
  const hasPayoutData = isUPI
    ? !!(pd.upiId || pd.upi_id)
    : !!(pd.accountNumber || pd.account_number || pd.ifsc || pd.ifscCode);

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return iso; }
  };

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function doAction(action: 'approve' | 'reject', reason?: string) {
    if (!item) return;
    setProcessing(true);
    try {
      const res = await adminApi.processWithdrawal(item.id, { action, failureReason: reason });
      const data = res.data as { status: string; pinelabsTransactionId?: string };
      if (data.status === 'completed') {
        showToast(data.pinelabsTransactionId
          ? `Approved — Txn: ${data.pinelabsTransactionId}` : 'Approved', 'success');
      } else {
        showToast('Processed', 'success');
      }
      onStatusChange?.(item.id, data.status);
      onClose();
    } catch (e) {
      showToast(getErrorMessage(e, 'Action failed'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRetry() {
    if (!item) return;
    setProcessing(true);
    try {
      const res = await adminApi.retryWithdrawal(item.id);
      const data = res.data as { success: boolean; paymentFailed?: boolean; errorCode?: string; errorMessage?: string };
      if (data.paymentFailed) {
        Alert.alert('Payment Failed', data.errorMessage ?? data.errorCode ?? 'Unknown error');
      } else {
        showToast('Payment retried successfully', 'success');
        onStatusChange?.(item.id, 'completed');
        onClose();
      }
    } catch (e) {
      showToast(getErrorMessage(e, 'Retry failed'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function handleMarkFailed(reason?: string) {
    if (!item) return;
    setProcessing(true);
    try {
      await adminApi.markWithdrawalFailed(item.id, { reason });
      showToast('Marked as failed', 'success');
      onStatusChange?.(item.id, 'failed');
      onClose();
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  // ─── Render: ID chip ────────────────────────────────────────────────────────
  const idLabel = item.id.length > 20 ? `${item.id.slice(0, 8)}…${item.id.slice(-4)}` : item.id;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          {/* Top accent bar */}
          <View style={[styles.topBar, { backgroundColor: STATUS_BAR_COLOR[status] ?? c.primary }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: c.text }]}>Withdrawal Request</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://pinelabs.com/orders/${item.orderId}`)}
                disabled={!item.orderId}
                style={styles.idRow}
              >
                <Text style={[styles.idLabel, { color: c.textTertiary }]}>{idLabel}</Text>
                {item.orderId && (
                  <Ionicons name="open-outline" size={11} color={c.primary} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: c.surfaceVariant }]}
            >
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Amount Hero ─────────────────────────────────────────────── */}
            <View style={[styles.amountHero, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
              <View style={styles.amountLeft}>
                <Text style={[styles.amountLabel, { color: c.textTertiary }]}>Amount Requested</Text>
                <Text style={[styles.amountValue, { color: c.text }]}>
                  ₹
                  <Text style={styles.amountMain}>
                    {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
                <Ionicons name={statusCfg.icon as any} size={13} color={statusCfg.color} />
                <Text style={[styles.statusPillText, { color: statusCfg.color }]}>
                  {statusCfg.label}
                </Text>
              </View>
            </View>

            {/* ── User Info ────────────────────────────────────────────────── */}
            {item.user && (
              <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="person-outline" size={14} color={c.primary} />
                  <Text style={[styles.cardHeaderTitle, { color: c.text }]}>User Details</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.userRow}>
                  <View style={[styles.avatar, { backgroundColor: c.primaryBg + '18' }]}>
                    <Text style={[styles.avatarText, { color: c.primary }]}>
                      {(item.user.name ?? item.user.mobileNumber ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: c.text }]}>{item.user.name ?? '—'}</Text>
                    <Text style={[styles.userMobile, { color: c.textSecondary }]}>
                      {item.user.mobileNumber}
                    </Text>
                    {item.user.state && (
                      <View style={styles.stateRow}>
                        <Ionicons name="location-outline" size={11} color={c.textTertiary} />
                        <Text style={[styles.stateText, { color: c.textTertiary }]}>{item.user.state}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.iconAction, { backgroundColor: c.primary + '12' }]}
                    onPress={() => { onClose(); }}
                  >
                    <Ionicons name="wallet-outline" size={16} color={c.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Payout Details ───────────────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="send-outline" size={14} color={c.primary} />
                <Text style={[styles.cardHeaderTitle, { color: c.text }]}>Payout Destination</Text>
              </View>
              <View style={styles.divider} />

              {/* Method badge */}
              <View style={styles.methodRow}>
                <View style={[styles.methodBadge, { backgroundColor: c.primary + '12' }]}>
                  <Ionicons name={methodCfg.icon as keyof typeof Ionicons.glyphMap} size={13} color={c.primary} />
                  <Text style={[styles.methodBadgeText, { color: c.primary }]}>{methodCfg.label}</Text>
                </View>
              </View>

              {/* Payout data */}
              {hasPayoutData ? (
                isUPI ? (
                  <View style={styles.payoutDataGrid}>
                    <PayoutRow label="UPI ID" value={pd.upiId ?? pd.upi_id ?? '—'} c={c} />
                  </View>
                ) : (
                  <View style={styles.payoutDataGrid}>
                    <PayoutRow label="Account Number" value={pd.accountNumber ?? pd.account_number ?? '—'} c={c} selectable />
                    <PayoutRow label="IFSC Code" value={pd.ifsc ?? pd.ifscCode ?? '—'} c={c} selectable />
                    {(pd.bankName ?? pd.bank_name) && (
                      <PayoutRow label="Bank Name" value={pd.bankName ?? pd.bank_name ?? '—'} c={c} />
                    )}
                    {(pd.accountHolderName ?? pd.account_holder_name) && (
                      <PayoutRow label="A/C Holder" value={pd.accountHolderName ?? pd.account_holder_name ?? '—'} c={c} />
                    )}
                  </View>
                )
              ) : (
                <View style={[styles.emptyPayout, { backgroundColor: c.muted }]}>
                  <Ionicons name="alert-circle-outline" size={15} color={c.textTertiary} />
                  <Text style={[styles.emptyPayoutText, { color: c.textTertiary }]}>
                    No payout details recorded
                  </Text>
                </View>
              )}
            </View>

            {/* ── Timeline ─────────────────────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={14} color={c.primary} />
                <Text style={[styles.cardHeaderTitle, { color: c.text }]}>Timeline</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.timeline}>
                <TimelineRow
                  label="Requested"
                  value={fmt(item.createdAt)}
                  icon="arrow-up-circle-outline"
                  color={c.textSecondary}
                  c={c}
                />
                {item.processedAt && (
                  <TimelineRow
                    label={status === 'completed' ? 'Completed' : status === 'failed' || status === 'rejected' ? 'Processed' : 'Processed'}
                    value={fmt(item.processedAt)}
                    icon={
                      status === 'completed' ? 'checkmark-circle'
                      : status === 'failed' || status === 'rejected' ? 'close-circle'
                      : 'hourglass'
                    }
                    color={status === 'completed' ? c.success : status === 'failed' || status === 'rejected' ? c.error : c.warning}
                    c={c}
                  />
                )}
                {item.orderId && (
                  <TimelineRow
                    label="Order ID"
                    value={item.orderId}
                    icon="key-outline"
                    color={c.primary}
                    c={c}
                    mono
                  />
                )}
                {item.pinelabsTransactionId && (
                  <TimelineRow
                    label="PineLabs Txn"
                    value={item.pinelabsTransactionId}
                    icon="link-outline"
                    color={c.success}
                    c={c}
                    mono
                  />
                )}
              </View>
            </View>

            {/* ── Failure / Rejection reason ──────────────────────────────── */}
            {(item.rejectionReason || item.failureReason) && (
              <View style={[styles.card, styles.errorCard, { backgroundColor: '#FEE2E2', ...tokens.shadowSm }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="alert-circle" size={14} color={c.error} />
                  <Text style={[styles.cardHeaderTitle, { color: c.error }]}>
                    {status === 'rejected' ? 'Rejection Reason' : 'Failure Reason'}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: '#FECACA' }]} />
                <Text style={[styles.errorText, { color: c.error }]}>
                  {item.rejectionReason ?? item.failureReason}
                </Text>
              </View>
            )}

            {/* ── Processing notice ───────────────────────────────────────── */}
            {status === 'processing' && (
              <View style={[styles.processingBanner, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="hourglass-outline" size={15} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.processingTitle, { color: '#7C3AED' }]}>Awaiting PineLabs confirmation</Text>
                  <Text style={[styles.processingSub, { color: '#7C3AED', opacity: 0.8 }]}>
                    The payout has been sent to PineLabs. It usually completes within a few minutes.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Action Buttons ──────────────────────────────────────────── */}
            {isSuperAdmin && (
              <View style={styles.actionArea}>
                {status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnApprove, { ...tokens.shadowSm }]}
                      onPress={() => doAction('approve')}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      {processing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={17} color="#fff" />
                          <Text style={styles.actionBtnText}>Approve & Pay</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnReject, { ...tokens.shadowSm }]}
                      onPress={() => {
                        Alert.prompt(
                          'Reject Withdrawal',
                          'Enter a reason for the user (optional)',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Reject',
                              style: 'destructive',
                              onPress: (reason?: string) => doAction('reject', reason),
                            },
                          ],
                          'plain-text',
                        );
                      }}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={17} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}

                {status === 'processing' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnRetry, { ...tokens.shadowSm }]}
                      onPress={handleRetry}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      {processing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={17} color="#fff" />
                          <Text style={styles.actionBtnText}>Retry Payment</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnReject, { ...tokens.shadowSm }]}
                      onPress={() => {
                        Alert.prompt(
                          'Mark as Failed',
                          'Enter failure reason (optional)',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Confirm',
                              style: 'destructive',
                              onPress: (reason?: string) => handleMarkFailed(reason),
                            },
                          ],
                          'plain-text',
                        );
                      }}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={17} color="#fff" />
                      <Text style={styles.actionBtnText}>Mark Failed</Text>
                    </TouchableOpacity>
                  </>
                )}

                {status === 'failed' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnRetry, { flex: 2, ...tokens.shadowSm }]}
                      onPress={handleRetry}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      {processing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={17} color="#fff" />
                          <Text style={styles.actionBtnText}>Retry Payment</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface PayoutRowProps { label: string; value: string; c: { text: string; textSecondary: string; textTertiary: string; primary: string; textDisabled?: string; [key: string]: unknown }; selectable?: boolean; mono?: boolean; }
function PayoutRow({ label, value, c, selectable, mono }: PayoutRowProps) {
  return (
    <View style={payoutStyles.row}>
      <Text style={[payoutStyles.label, { color: c.textTertiary }]}>{label}</Text>
      <Text
        style={[
          payoutStyles.value,
          { color: c.text },
          mono && { fontFamily: 'monospace', fontSize: 11 },
        ]}
        selectable={selectable}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

interface TimelineRowProps {
  label: string; value: string; icon: string;
  color: string; c: { text: string; textSecondary: string; textTertiary: string; primary: string; textDisabled?: string; [key: string]: unknown }; mono?: boolean;
}
function TimelineRow({ label, value, icon, color, c, mono }: TimelineRowProps) {
  return (
    <View style={timelineStyles.row}>
      <View style={[timelineStyles.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={13} color={color} />
      </View>
      <View style={timelineStyles.content}>
        <Text style={[timelineStyles.label, { color: c.textTertiary }]}>{label}</Text>
        <Text
          style={[
            timelineStyles.value,
            { color: mono ? color : c.text },
            mono && { fontFamily: 'monospace', fontSize: 11 },
          ]}
          selectable={mono}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const payoutStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  label: { fontSize: 12, fontWeight: '500', flex: 1 },
  value: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1.5, marginLeft: 8 },
});

const timelineStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  content: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.04 },
  value: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
});

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: '3%',
    maxHeight: '94%',
  },
  topBar: { height: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: tokens.spacing5,
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing3,
    gap: tokens.spacing3,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  idRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  idLabel: { fontSize: 11, fontFamily: 'monospace' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },

  body: { flex: 1, minHeight: 0 },
  bodyContent: {
    paddingHorizontal: tokens.spacing5,
    paddingTop: tokens.spacing2,
    gap: tokens.spacing3,
  },

  // ── Amount hero ─────────────────────────────────────────────────────────────
  amountHero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: tokens.radiusLg, padding: tokens.spacing5,
    marginTop: tokens.spacing1,
  },
  amountLeft: { flex: 1 },
  amountLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.06 },
  amountValue: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  amountMain: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  // ── Cards ───────────────────────────────────────────────────────────────────
  card: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    overflow: 'hidden',
  },
  errorCard: { borderRadius: tokens.radiusLg, padding: tokens.spacing4 },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: tokens.spacing2,
  },
  cardHeaderTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.02 },
  divider: { height: 1, marginBottom: tokens.spacing3 },

  // ── User ────────────────────────────────────────────────────────────────────
  userRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  userName: { fontSize: 15, fontWeight: '700' },
  userMobile: { fontSize: 12, marginTop: 2 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  stateText: { fontSize: 11 },
  iconAction: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Payout ──────────────────────────────────────────────────────────────────
  methodRow: { flexDirection: 'row', marginBottom: tokens.spacing2 },
  methodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: tokens.radius, paddingHorizontal: 10, paddingVertical: 4,
  },
  methodBadgeText: { fontSize: 12, fontWeight: '700' },
  payoutDataGrid: { gap: 0 },

  // ── Empty payout state ──────────────────────────────────────────────────────
  emptyPayout: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: tokens.radiusMd, padding: tokens.spacing3,
  },
  emptyPayoutText: { fontSize: 12, fontWeight: '500' },

  // ── Error card ─────────────────────────────────────────────────────────────
  errorText: { fontSize: 13, fontWeight: '500', lineHeight: 19 },

  // ── Timeline ────────────────────────────────────────────────────────────────
  timeline: { gap: 0 },

  // ── Processing banner ───────────────────────────────────────────────────────
  processingBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: tokens.radiusLg, padding: tokens.spacing4,
  },
  processingTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  processingSub: { fontSize: 12, fontWeight: '400', lineHeight: 17 },

  // ── Actions ─────────────────────────────────────────────────────────────────
  actionArea: {
    flexDirection: 'row',
    gap: tokens.spacing3,
    paddingTop: tokens.spacing2,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: tokens.spacing3 + 2,
    borderRadius: tokens.radiusMd,
    gap: tokens.spacing2,
  },
  actionBtnApprove: { backgroundColor: '#059669' },
  actionBtnReject:  { backgroundColor: '#DC2626' },
  actionBtnRetry:   { backgroundColor: '#7C3AED' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  bottomSpacer: { height: tokens.spacing5 },
});