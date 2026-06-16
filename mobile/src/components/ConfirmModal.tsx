import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDanger = variant === 'danger';
  const confirmColor = isDanger ? c.error : c.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: c.surface }]}>
          <View style={styles.iconRow}>
            {isDanger
              ? <Ionicons name="warning" size={28} color={c.error} />
              : <Ionicons name="information-circle" size={28} color={c.primary} />}
          </View>

          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: c.textSecondary }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading
                ? <Text style={[styles.btnText, { color: '#fff' }]}>Please wait…</Text>
                : <Text style={[styles.btnText, { color: '#fff' }]}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing5,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing5,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: tokens.spacing3,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: tokens.spacing2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: tokens.spacing5,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing3,
    width: '100%',
  },
  btn: {
    flex: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});