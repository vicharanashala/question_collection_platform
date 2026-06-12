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

export function Select({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onChange,
  error,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label ?? 'Select'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options as Option[]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.optionSelected]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.sublabel && (
                    <Text style={styles.optionSublabel}>{item.sublabel}</Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  triggerError: { borderColor: '#E53935' },
  triggerText: { fontSize: 16, color: '#212121' },
  placeholder: { color: '#9E9E9E' },
  arrow: { fontSize: 10, color: '#757575' },
  error: { fontSize: 12, color: '#E53935', marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#212121' },
  closeBtn: { fontSize: 20, color: '#757575' },
  option: { paddingHorizontal: 20, paddingVertical: 16 },
  optionSelected: { backgroundColor: '#F1F8E9' },
  optionText: { fontSize: 16, color: '#212121' },
  optionTextSelected: { color: '#2E7D32', fontWeight: '700' },
  optionSublabel: { fontSize: 12, color: '#757575', marginTop: 2 },
  separator: { height: 1, backgroundColor: '#F0F0F0' },
});