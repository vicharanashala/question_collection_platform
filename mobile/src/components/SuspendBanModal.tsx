import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';
import { AccountLockedInfo } from '../api/client';

interface Props {
  visible: boolean;
  action: 'suspend' | 'ban';
  currentStatus?: AccountLockedInfo | null;
  onClose: () => void;
  onConfirm: (reason: string, suspendedUntil?: string) => Promise<void>;
}

const SUSPEND_OPTIONS: { label: string; days: number }[] = [
  { label: '1D', days: 1 },
  { label: '3D', days: 3 },
  { label: '7D', days: 7 },
  { label: '15D', days: 15 },
  { label: '30D', days: 30 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return null; }
}

export function SuspendBanModal({ visible, action, currentStatus, onClose, onConfirm }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [reason, setReason] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(30);
  const [customUntil, setCustomUntil] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isBan = action === 'ban';
  const accentColor = isBan ? c.error : c.warning;
  const isCurrentlyLocked = !!currentStatus;
  const currentIsBan = currentStatus?.status === 'banned';
  const currentAccent = currentIsBan ? c.error : c.warning;

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Please provide a reason for the record');
      return;
    }
    if (!isBan && !selectedDays && !customUntil) {
      setError('Please select a suspension duration');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const suspendedUntil = customUntil
        ? customUntil
        : selectedDays
          ? addDays(selectedDays)
          : undefined;
      await onConfirm(reason.trim(), suspendedUntil);
      setReason('');
      setSelectedDays(30);
      setCustomUntil('');
      setError('');
    } catch {
      setError('Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setReason('');
    setSelectedDays(30);
    setCustomUntil('');
    setError('');
    setLoading(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: c.surface, ...tokens.shadowXl }]}>

          {/* Current status warning */}
          {isCurrentlyLocked && (
            <View style={[styles.currentStatusBanner, { backgroundColor: currentAccent + '14', borderColor: currentAccent + '44' }]}>
              <View style={styles.currentStatusHeader}>
                <Ionicons
                  name={currentIsBan ? 'ban' : 'pause-circle'}
                  size={16}
                  color={currentAccent}
                />
                <Text style={[styles.currentStatusLabel, { color: currentAccent }]}>
                  Currently {currentIsBan ? 'banned' : 'suspended'}
                </Text>
              </View>
              {currentStatus?.reason && (
                <Text style={[styles.currentStatusReason, { color: c.text }]}>
                  Reason: {currentStatus.reason}
                </Text>
              )}
              {(currentStatus?.suspendedAt ?? currentStatus?.bannedAt) && (
                <Text style={[styles.currentStatusDate, { color: c.textSecondary }]}>
                  Since: {formatDate(currentStatus?.suspendedAt ?? currentStatus?.bannedAt)}
                </Text>
              )}
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
              <Ionicons
                name={isBan ? 'ban' : 'pause-circle'}
                size={22}
                color={accentColor}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>
                {isBan ? 'Ban User' : 'Suspend User'}
              </Text>
              <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                {isBan
                  ? 'Permanently block the user from logging in.'
                  : 'Temporarily block the user until the set end date.'}
              </Text>
            </View>
          </View>

          {/* Duration picker — suspend only */}
          {!isBan && (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: c.text }]}>
                Suspension Duration <Text style={{ color: c.error }}>*</Text>
              </Text>
              <View style={styles.durationRow}>
                {SUSPEND_OPTIONS.map(({ label, days }) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.durationChip,
                      {
                        backgroundColor: selectedDays === days ? accentColor : c.surfaceVariant,
                        borderColor: selectedDays === days ? accentColor : c.borderSubtle,
                      },
                    ]}
                    onPress={() => { setSelectedDays(days); setCustomUntil(''); }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        { color: selectedDays === days ? '#fff' : c.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Custom date input */}
              <TextInput
                style={[
                  styles.input,
                  styles.customDateInput,
                  {
                    backgroundColor: c.surfaceVariant,
                    color: c.text,
                    borderColor: c.borderSubtle,
                  },
                ]}
                placeholder="Or enter custom end date (YYYY-MM-DD)"
                placeholderTextColor={c.textTertiary}
                value={customUntil}
                onChangeText={(t) => {
                  setCustomUntil(t);
                  setSelectedDays(null);
                }}
                editable={!loading}
              />
              {selectedDays && (
                <Text style={[styles.durationHint, { color: c.textSecondary }]}>
                  Suspension ends: {formatDate(addDays(selectedDays))}
                </Text>
              )}
            </View>
          )}

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
                  borderColor: error ? c.error : c.borderSubtle,
                },
              ]}
              placeholder="e.g. Repeated spam, fraudulent activity…"
              placeholderTextColor={c.textTertiary}
              value={reason}
              onChangeText={(t) => { setReason(t); setError(''); }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!loading}
            />
            {error ? <Text style={[styles.fieldError, { color: c.error }]}>{error}</Text> : null}
          </View>

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
                <Text style={styles.btnConfirmText}>
                  {isBan ? 'Confirm Ban' : 'Confirm Suspension'}
                </Text>
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
  currentStatusBanner: {
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing4,
  },
  currentStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing1,
    gap: tokens.spacing2,
  },
  currentStatusLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  currentStatusReason: { fontSize: 13, marginTop: 2 },
  currentStatusDate: { fontSize: 12, marginTop: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing5,
    gap: tokens.spacing3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  field: { marginBottom: tokens.spacing4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing2 },
  durationRow: {
    flexDirection: 'row',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing2,
    flexWrap: 'wrap',
  },
  durationChip: {
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusFull,
    borderWidth: 1.5,
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  customDateInput: {
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    fontSize: 13,
    marginTop: tokens.spacing1,
  },
  durationHint: {
    fontSize: 12,
    marginTop: tokens.spacing1,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    fontSize: 14,
    minHeight: 80,
  },
  fieldError: { fontSize: 12, marginTop: tokens.spacing1 },
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