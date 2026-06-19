import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';

interface ResultModalProps {
  visible: boolean;
  variant: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  detail?: string;
  confirmLabel?: string;
  onClose: () => void;
}

export function ResultModal({
  visible,
  variant,
  title,
  message,
  detail,
  confirmLabel = 'OK',
  onClose,
}: ResultModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const iconColor = variant === 'success' ? '#22c55e' : variant === 'error' ? '#ef4444' : c.primary;
  const iconName = variant === 'success' ? 'checkmark-circle' : variant === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <View style={[styles.dialog, { backgroundColor: c.background }]}>
          <View style={[styles.iconWrap, { backgroundColor: iconColor + '15' }]}>
            <Ionicons name={iconName as any} size={32} color={iconColor} />
          </View>

          <Text style={[styles.title, { color: c.text }]}>{title}</Text>

          {message && (
            <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text>
          )}

          {detail && (
            <View style={[styles.detailBox, { backgroundColor: c.surfaceVariant, borderColor: c.border }]}>
              <Text style={[styles.detailText, { color: c.text }]}>{detail}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: iconColor }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  detailBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    paddingVertical: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    marginTop: tokens.spacing2,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});