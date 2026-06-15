import React, { useState, useMemo } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
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
  searchable?: boolean;
}

export const Select = React.memo(function Select({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onChange,
  error,
  searchable = false,
}: SelectProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options as Option[];
    const q = query.toLowerCase();
    return (options as Option[]).filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [query, options]);

  function openModal() {
    setQuery('');
    setOpen(true);
  }

  function handleSelect(item: Option) {
    onChange(item.value);
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: c.text }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: error ? c.error : c.borderSubtle,
            backgroundColor: c.input,
          },
        ]}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selected ? c.text : c.textTertiary },
          ]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Text style={[styles.arrow, { color: c.textSecondary }]}>▼</Text>
      </TouchableOpacity>
      {error && (
        <Text style={[styles.error, { color: c.error }]}>{error}</Text>
      )}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={[styles.modal, { backgroundColor: c.surface }]}>
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: c.borderSubtle },
              ]}
            >
              <Text style={[styles.modalTitle, { color: c.text }]}>
                {label ?? 'Select'}
              </Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.closeBtn, { color: c.textSecondary }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {searchable && (
              <View
                style={[
                  styles.searchWrapper,
                  { borderBottomColor: c.borderSubtle },
                ]}
              >
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: c.text, backgroundColor: c.input },
                  ]}
                  placeholder="Search…"
                  placeholderTextColor={c.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                  No results found
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      item.value === value && { backgroundColor: c.accent },
                    ]}
                    onPress={() => handleSelect(item)}
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
                      <Text
                        style={[
                          styles.optionSublabel,
                          { color: c.textSecondary },
                        ]}
                      >
                        {item.sublabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => (
                  <View
                    style={[styles.separator, { backgroundColor: c.borderSubtle }]}
                  />
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: tokens.spacing4 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: tokens.spacing1,
    letterSpacing: 0.01 * 13,
  },
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
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
  searchWrapper: {
    paddingHorizontal: tokens.spacing6,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3 + 2,
    paddingVertical: tokens.spacing2 + 2,
    fontSize: 15,
  },
  emptyState: { padding: tokens.spacing8, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  option: {
    paddingHorizontal: tokens.spacing6,
    paddingVertical: tokens.spacing4,
  },
  optionText: { fontSize: 15 },
  optionTextSelected: { fontWeight: '700' },
  optionSublabel: { fontSize: 12, marginTop: 2 },
  separator: { height: 1 },
});