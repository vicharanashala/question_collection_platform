import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface WarningModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  visible,
  message,
  onClose,
}) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: c.surface }]}>
          <View style={[styles.iconRow, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.icon}>⚠️</Text>
          </View>
          <Text style={[styles.message, { color: c.text }]}>{message}</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.btnText, { color: c.primaryForeground }]}>
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing8,
  },
  dialog: {
    borderRadius: tokens.radiusXl,
    paddingHorizontal: tokens.spacing6,
    paddingBottom: tokens.spacing6,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  iconRow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.spacing5,
    marginBottom: tokens.spacing4,
  },
  icon: { fontSize: 24 },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: tokens.spacing6,
    paddingHorizontal: tokens.spacing2,
  },
  btn: {
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3 + 2,
    paddingHorizontal: tokens.spacing8,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '700' },
});