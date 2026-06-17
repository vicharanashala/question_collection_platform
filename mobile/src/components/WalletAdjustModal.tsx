import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [reasonError, setReasonError] = useState('');

  const currentBalance = wallet?.balance ?? 0;
  const accentColor = type === 'credit' ? c.success : c.error;

  useEffect(() => {
    if (visible && userId) {
      adminApi.getUserWallet(userId)
        .then((r) => setWallet(r.data as WalletSummary))
        .catch(() => setWallet(null));
    }
  }, [visible, userId]);

  function reset() {
    setType('credit');
    setAmount('');
    setReason('');
    setAmountError('');
    setReasonError('');
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    // Validate
    const numAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Enter a valid positive amount');
      return;
    }
    if (!reason.trim()) {
      setReasonError('Reason is required for audit');
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
      // Backend expects positive amount; debit flag is determined by amount sign or separate field
      // Using sign: positive = credit, negative = debit
      const payloadAmount = type === 'credit' ? numAmount : -numAmount;
      await adminApi.adjustWallet(userId, { amount: payloadAmount, reason: reason.trim() });
      showToast(
        `${type === 'credit' ? 'Credited' : 'Debited'} ₹${numAmount.toLocaleString('en-IN')} ${type === 'credit' ? 'to' : 'from'} ${userName}`,
        'success',
      );
      onAdjusted();
      handleClose();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Failed to adjust wallet balance');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
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

          {/* Current balance indicator */}
          <View style={[styles.balanceChip, { backgroundColor: c.surfaceVariant }]}>
            <Ionicons name="wallet-outline" size={14} color={c.textSecondary} />
            <Text style={[styles.balanceChipText, { color: c.textSecondary }]}>
              Current balance:{' '}
              <Text style={{ fontWeight: '700', color: c.primary }}>
                ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
            <View style={[styles.previewRow, { backgroundColor: (type === 'credit' ? c.success : c.error) + '12' }]}>
              <Text style={[styles.previewLabel, { color: c.textSecondary }]}>New balance:</Text>
              <Text style={[styles.previewValue, { color: type === 'credit' ? c.success : c.error }]}>
                ₹
                {(type === 'credit'
                  ? currentBalance + parseFloat(amount)
                  : currentBalance - parseFloat(amount)
                ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing4,
    gap: tokens.spacing3,
  },
  iconWrap: {
    width: 44, height: 44,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    marginBottom: tokens.spacing4,
    alignSelf: 'flex-start',
  },
  balanceChipText: { fontSize: 12 },
  field: { marginBottom: tokens.spacing4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing2 },
  toggleRow: { flexDirection: 'row', gap: tokens.spacing2 },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing1,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    borderWidth: 1.5,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '700' },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    backgroundColor: 'transparent',
  },
  currencySymbol: { fontSize: 18, fontWeight: '600' },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: tokens.spacing3,
    paddingLeft: tokens.spacing2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    fontSize: 14,
    minHeight: 80,
  },
  fieldError: { fontSize: 12, marginTop: tokens.spacing1 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    marginBottom: tokens.spacing4,
  },
  previewLabel: { fontSize: 13 },
  previewValue: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: tokens.spacing3, marginTop: tokens.spacing2 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { borderWidth: 1.5 },
  btnCancelText: { fontSize: 14, fontWeight: '700' },
  btnConfirm: { flexDirection: 'row' },
  btnConfirmText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});