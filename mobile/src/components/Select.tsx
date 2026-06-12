import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: readonly Option[] | Option[];
  onChange: (value: string) => void;
  error?: string;
}

export function Select({ label, placeholder = 'Select an option', value, options, onChange, error }: SelectProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      )}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: error ? c.error : c.borderSubtle,
            backgroundColor: c.input,
          },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, { color: selected ? c.text : c.textTertiary }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={[styles.arrow, { color: c.textSecondary }]}>▼</Text>
      </TouchableOpacity>
      {error && <Text style={[styles.error, { color: c.error }]}>{error}</Text>}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={[styles.modal, { backgroundColor: c.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: c.borderSubtle }]}>
              <Text style={[styles.modalTitle, { color: c.text }]}>{label ?? 'Select'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.closeBtn, { color: c.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options as Option[]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && { backgroundColor: c.accent },
                  ]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: item.value === value ? c.primary : c.text },
                      item.value === value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.sublabel && (
                    <Text style={[styles.optionSublabel, { color: c.textSecondary }]}>{item.sublabel}</Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: c.borderSubtle }]} />}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: tokens.spacing4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing1, letterSpacing: 0.01 * 13 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing3 + 2,
  },
  triggerText: { fontSize: 15, flex: 1 },
  arrow: { fontSize: 10, marginLeft: tokens.spacing2 },
  error: { fontSize: 12, marginTop: tokens.spacing1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: {
    borderTopLeftRadius: tokens.radiusXl,
    borderTopRightRadius: tokens.radiusXl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing6,
    paddingVertical: tokens.spacing4,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { fontSize: 18 },
  option: { paddingHorizontal: tokens.spacing6, paddingVertical: tokens.spacing4 },
  optionText: { fontSize: 15 },
  optionTextSelected: { fontWeight: '700' },
  optionSublabel: { fontSize: 12, marginTop: 2 },
  separator: { height: 1 },
});