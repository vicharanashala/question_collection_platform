import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function ReasonModal({
  visible,
  title,
  message,
  placeholder = 'Enter reason…',
  confirmLabel = 'Submit',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [value, setValue] = useState('');

  function handleConfirm() {
    onConfirm(value.trim());
  }

  function handleClose() {
    setValue('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.dialog, { backgroundColor: c.surface }]}>
          <View style={styles.iconRow}>
            <Ionicons name="create-outline" size={26} color={c.primary} />
          </View>

          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {message && (
            <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text>
          )}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: c.borderSubtle,
                color: c.text,
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor={c.textTertiary}
            value={value}
            onChangeText={setValue}
            multiline
            numberOfLines={3}
            autoFocus
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: c.textSecondary }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor: value.trim().length === 0
                    ? c.textTertiary + '40'
                    : c.primary,
                },
              ]}
              onPress={handleConfirm}
              disabled={loading || value.trim().length === 0}
            >
              {loading
                ? <Text style={[styles.btnText, { color: '#fff' }]}>Please wait…</Text>
                : <Text style={[styles.btnText, { color: '#fff' }]}>{confirmLabel}</Text>}
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
    marginBottom: tokens.spacing4,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: tokens.spacing4,
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