import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption<T extends string = string> {
  key: T;
  label: string;
  type: 'text' | 'select' | 'date';
  placeholder?: string;
  options?: Array<{ value: T; label: string }>;
}

export interface ActiveFilters {
  [key: string]: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: FilterOption[];
  active: ActiveFilters;
  onApply: (filters: ActiveFilters) => void;
  onReset: () => void;
  title?: string;
}

// ─── Single-select pill group ─────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | '';
  onChange: (v: T | '') => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={pillStyles.row}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              pillStyles.pill,
              {
                backgroundColor: selected ? c.primary : c.surfaceVariant,
                borderColor: selected ? c.primary : c.borderSubtle,
              },
            ]}
            onPress={() => onChange(selected ? '' : opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                pillStyles.pillText,
                { color: selected ? '#fff' : c.textSecondary },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Date input ───────────────────────────────────────────────────────────────

function DateInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: c.surfaceVariant,
            color: c.text,
            borderColor: focused ? c.primary : c.borderSubtle,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? 'YYYY-MM-DD'}
        placeholderTextColor={c.textTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
      />
    </View>
  );
}

// ─── Main modal component ─────────────────────────────────────────────────────

export function AdminFilterModal({
  visible,
  onClose,
  filters,
  active,
  onApply,
  onReset,
  title = 'Advance Filters',
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState<ActiveFilters>({});

  // Sync draft when modal opens
  useEffect(() => {
    if (visible) setDraft({ ...active });
  }, [visible, active]);

  function setVal(key: string, val: string) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function hasActiveFilters() {
    return Object.values(draft).some((v) => v && v.trim().length > 0);
  }

  const appliedCount = Object.values(draft).filter((v) => v && v.trim().length > 0).length;

  function handleApply() {
    onApply(draft);
    onClose();
  }

  function handleReset() {
    const cleared: ActiveFilters = {};
    filters.forEach((f) => { cleared[f.key] = ''; });
    setDraft(cleared);
    onReset();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: c.surface }]}>
              {/* Handle */}
              <View style={styles.handleRow}>
                <View style={[styles.handle, { backgroundColor: c.borderSubtle }]} />
              </View>

              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.headerLeft}>
                  <Ionicons name="options" size={18} color={c.primary} />
                  <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
                  {appliedCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: c.primary + '22' }]}>
                      <Text style={[styles.badgeText, { color: c.primary }]}>{appliedCount}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={26} color={c.textTertiary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.sheetBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filters.map((filter) => {
                  if (filter.type === 'text') {
                    return (
                      <View key={filter.key} style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                          {filter.label}
                        </Text>
                        <TextInput
                          style={[
                            styles.textInput,
                            {
                              backgroundColor: c.surfaceVariant,
                              color: c.text,
                              borderColor: c.borderSubtle,
                            },
                          ]}
                          value={draft[filter.key] ?? ''}
                          onChangeText={(v) => setVal(filter.key, v)}
                          placeholder={filter.placeholder ?? `Search ${filter.label.toLowerCase()}…`}
                          placeholderTextColor={c.textTertiary}
                        />
                      </View>
                    );
                  }

                  if (filter.type === 'select' && filter.options) {
                    return (
                      <View key={filter.key} style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
                          {filter.label}
                        </Text>
                        <PillGroup
                          options={filter.options}
                          value={(draft[filter.key] ?? '') as string}
                          onChange={(v) => setVal(filter.key, v)}
                        />
                      </View>
                    );
                  }

                  if (filter.type === 'date') {
                    return (
                      <View key={filter.key} style={styles.field}>
                        <DateInput
                          label={filter.label}
                          value={draft[filter.key] ?? ''}
                          onChange={(v) => setVal(filter.key, v)}
                          placeholder={filter.placeholder}
                        />
                      </View>
                    );
                  }

                  return null;
                })}

                <View style={{ height: 20 }} />
              </ScrollView>

              {/* Footer actions */}
              <View style={[styles.footer, { borderTopColor: c.borderSubtle }]}>
                <TouchableOpacity
                  style={[styles.footerBtn, { backgroundColor: c.surfaceVariant }]}
                  onPress={handleReset}
                  disabled={appliedCount === 0}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.footerBtnText, { color: appliedCount > 0 ? c.text : c.textTertiary }]}>
                    Reset
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.footerBtn, styles.footerBtnPrimary, { backgroundColor: c.primary }]}
                  onPress={handleApply}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.footerBtnText, { color: '#fff', fontWeight: '700' }]}>
                    Apply Filters
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: tokens.spacing8,
    maxHeight: '85%',
  },
  handleRow: { alignItems: 'center', paddingVertical: tokens.spacing2 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing5,
    paddingBottom: tokens.spacing3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  sheetBody: { paddingHorizontal: tokens.spacing5 },
  field: { marginBottom: tokens.spacing4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing2 },
  textInput: {
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2 + 2,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: tokens.spacing3,
    paddingHorizontal: tokens.spacing5,
    paddingTop: tokens.spacing4,
    borderTopWidth: 1,
    marginHorizontal: 0,
  },
  footerBtn: {
    flex: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
    alignItems: 'center',
  },
  footerBtnPrimary: { flex: 2 },
  footerBtnText: { fontSize: 15, fontWeight: '600' },
});

const pillStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  pill: {
    borderWidth: 1,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: 5,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
});