import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import { adminApi, getErrorMessage } from '../api/client';
import { tokens } from '../utils/theme';
import type { WalletSummary } from '../types';

interface Props {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onAdjusted: () => void;
}

export function WalletAdjustModal({ visible, userId, userName, onClose, onAdjusted }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [reasonError, setReasonError] = useState('');

  const currentBalance = wallet?.balance ?? 0;
  const accentColor = type === 'credit' ? c.success : c.error;

  // Reset form whenever modal opens
  useEffect(() => {
    if (visible) {
      setType('credit');
      setAmount('');
      setReason('');
      setAmountError('');
      setReasonError('');
      setLoading(false);
      setWallet(null);
    }
  }, [visible]);

  // Load wallet balance when modal opens
  useEffect(() => {
    if (visible && userId) {
      adminApi.getUserWallet(userId)
        .then((r) => setWallet(r.data as WalletSummary))
        .catch(() => setWallet(null));
    }
  }, [visible, userId]);

  function handleClose() {
    onClose();
  }

  async function handleConfirm() {
    const numAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Enter a valid positive amount');
      return;
    }
    if (!reason.trim()) {
      setReasonError('Reason is required for audit trail');
      return;
    }
    if (type === 'debit' && numAmount > currentBalance) {
      setAmountError('Debit amount cannot exceed current balance');
      return;
    }

    setLoading(true);
    setAmountError('');
    setReasonError('');
    try {
      const payloadAmount = type === 'credit' ? numAmount : -numAmount;
      await adminApi.adjustWallet(userId, { amount: payloadAmount, reason: reason.trim() });
      showToast(
        `${type === 'credit' ? 'Credited' : 'Debited'} ₹${numAmount.toLocaleString('en-IN')} ${type === 'credit' ? 'to' : 'from'} ${userName}`,
        'success',
      );
      onAdjusted();
      onClose();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Failed to adjust wallet balance');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const previewAmount = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0
    ? (type === 'credit' ? currentBalance + parseFloat(amount) : currentBalance - parseFloat(amount))
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={[styles.sheet, { backgroundColor: c.surface, ...tokens.shadowXl }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: c.primary + '18' }]}>
              <Ionicons name="swap-vertical" size={22} color={c.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>Adjust Wallet Balance</Text>
              <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                Manually adjust {userName}'s wallet balance
              </Text>
            </View>
          </View>

          {/* Current balance */}
          <View style={[styles.balanceChip, { backgroundColor: c.surfaceVariant }]}>
            <Ionicons name="wallet-outline" size={14} color={c.textSecondary} />
            <Text style={[styles.balanceChipText, { color: c.textSecondary }]}>
              Current balance:{' '}
              <Text style={{ fontWeight: '700', color: c.primary }}>
                {currentBalance === 0 && !wallet
                  ? '...'
                  : `₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </Text>
            </Text>
          </View>

          {/* Credit / Debit toggle */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: c.text }]}>Transaction Type</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: type === 'credit' ? c.success : c.surfaceVariant,
                    borderColor: type === 'credit' ? c.success : c.borderSubtle,
                  },
                ]}
                onPress={() => setType('credit')}
                disabled={loading}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={16}
                  color={type === 'credit' ? '#fff' : c.textSecondary}
                />
                <Text style={[styles.toggleBtnText, { color: type === 'credit' ? '#fff' : c.textSecondary }]}>
                  Credit (+)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: type === 'debit' ? c.error : c.surfaceVariant,
                    borderColor: type === 'debit' ? c.error : c.borderSubtle,
                  },
                ]}
                onPress={() => setType('debit')}
                disabled={loading}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={16}
                  color={type === 'debit' ? '#fff' : c.textSecondary}
                />
                <Text style={[styles.toggleBtnText, { color: type === 'debit' ? '#fff' : c.textSecondary }]}>
                  Debit (−)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount input */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: c.text }]}>
              Amount (₹) <Text style={{ color: c.error }}>*</Text>
            </Text>
            <View style={[styles.amountInputWrap, { borderColor: amountError ? c.error : c.borderSubtle }]}>
              <Text style={[styles.currencySymbol, { color: c.textSecondary }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: c.text }]}
                placeholder="0.00"
                placeholderTextColor={c.textTertiary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(t) => { setAmount(t); setAmountError(''); }}
                editable={!loading}
              />
            </View>
            {amountError ? <Text style={[styles.fieldError, { color: c.error }]}>{amountError}</Text> : null}
          </View>

          {/* Reason input */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: c.text }]}>
              Reason <Text style={{ color: c.error }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: c.surfaceVariant,
                  color: c.text,
                  borderColor: reasonError ? c.error : c.borderSubtle,
                },
              ]}
              placeholder="e.g. Refund for rejected question, correction for duplicate payment…"
              placeholderTextColor={c.textTertiary}
              value={reason}
              onChangeText={(t) => { setReason(t); setReasonError(''); }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!loading}
            />
            {reasonError ? <Text style={[styles.fieldError, { color: c.error }]}>{reasonError}</Text> : null}
          </View>

          {/* Preview */}
          {previewAmount !== null && (
            <View style={[styles.previewRow, { backgroundColor: (type === 'credit' ? c.success : c.error) + '12' }]}>
              <Text style={[styles.previewLabel, { color: c.textSecondary }]}>New balance:</Text>
              <Text style={[styles.previewValue, { color: type === 'credit' ? c.success : c.error }]}>
                ₹{previewAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel, { borderColor: c.borderSubtle }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.btnCancelText, { color: c.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnConfirm,
                { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 },
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnConfirmText}>Confirm Adjustment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing6,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing5,
    gap: tokens.spacing3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    marginBottom: tokens.spacing5,
  },
  balanceChipText: { fontSize: 13 },
  field: {
    marginBottom: tokens.spacing4,
    gap: tokens.spacing2,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    gap: tokens.spacing3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing2,
    paddingVertical: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: tokens.spacing2,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: tokens.spacing3,
  },
  fieldError: { fontSize: 12 },
  input: {
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    fontSize: 14,
    minHeight: 80,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    marginBottom: tokens.spacing4,
  },
  previewLabel: { fontSize: 13 },
  previewValue: { fontSize: 15, fontWeight: '800' },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing3,
  },
  btn: {
    flex: 1,
    paddingVertical: tokens.spacing4,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
  },
  btnCancel: {
    borderWidth: 1.5,
  },
  btnCancelText: { fontSize: 14, fontWeight: '700' },
  btnConfirm: {},
  btnConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});