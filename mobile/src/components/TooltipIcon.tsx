import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface TooltipIconProps {
  description: string;
  color?: string;
  size?: number;
}

export function TooltipIcon({ description, color, size = 15 }: TooltipIconProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={6}>
        <Ionicons name="information-circle-outline" size={size} color={color ?? c.textTertiary} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.tooltip, { backgroundColor: c.surface, ...tokens.shadowLg }]}>
                <View style={[styles.tooltipHeader, { borderBottomColor: c.borderSubtle }]}>
                  <Ionicons name="information-circle" size={18} color={c.primary} />
                  <Text style={[styles.tooltipTitle, { color: c.text }]}>Info</Text>
                  <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn} hitSlop={8}>
                    <Ionicons name="close" size={16} color={c.textTertiary} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.tooltipBody, { color: c.textSecondary }]}>{description}</Text>
                <TouchableOpacity
                  style={[styles.gotItBtn, { backgroundColor: c.primary }]}
                  onPress={() => setVisible(false)}
                >
                  <Text style={[styles.gotItBtnText, { color: c.primaryForeground }]}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing6,
  },
  tooltip: {
    width: '100%',
    maxWidth: 320,
    borderRadius: tokens.radiusLg,
    overflow: 'hidden',
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    padding: tokens.spacing4,
    borderBottomWidth: 1,
  },
  tooltipTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: tokens.spacing1,
  },
  tooltipBody: {
    fontSize: 14,
    lineHeight: 20,
    padding: tokens.spacing4,
  },
  gotItBtn: {
    marginHorizontal: tokens.spacing4,
    marginBottom: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
  },
  gotItBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});