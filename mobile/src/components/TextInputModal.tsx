import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export function TextInputModal({
  visible,
  title,
  message,
  placeholder,
  initialValue = '',
  confirmLabel = 'Submit',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onSubmit,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [value, setValue] = useState(initialValue);
  const isDanger = variant === 'danger';
  const submitColor = isDanger ? c.error : c.primary;

  // Reset input when modal becomes visible
  React.useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.dialog, { backgroundColor: c.surface }]}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>

          {message && (
            <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text>
          )}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.background,
                borderColor: c.border,
                color: c.text,
              },
            ]}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={c.textTertiary}
            multiline
            autoFocus
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { borderColor: c.border, borderWidth: 1 }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: c.textSecondary }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: submitColor }]}
              onPress={() => onSubmit(value)}
              disabled={loading}
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
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    fontSize: 15,
    marginBottom: tokens.spacing5,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing3,
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