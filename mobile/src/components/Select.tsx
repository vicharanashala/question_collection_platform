import React, { useState, useMemo } from 'react';
import { TextInput, StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, Modal, FlatList, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WarningModal } from './WarningModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
  /** Optional thumbnail rendered to the left of the label. */
  image?: ImageSourcePropType;
}

export type SelectLayout = 'list' | 'grid';

interface SelectProps {
  label?: string;
  placeholder?: string;
  value: string | string[];
  options: readonly Option[] | Option[];
  onChange: (value: string | string[]) => void;
  error?: string;
  searchable?: boolean;
  loading?: boolean;
  /** Prevent interaction and show a warning if the user tries to tap */
  disabled?: boolean;
  disabledMessage?: string;
  /** Render as multi-select with checkboxes and chip summary in trigger */
  multi?: boolean;
  /** When true, appends a red asterisk to the label */
  required?: boolean;
  /**
   * Visual layout of the option modal:
   * - `list`: vertical list with row thumbnails (default, used by most screens).
   * - `grid`: 3-column grid with circular thumbnails + label below (used by the
   *   registration crop picker for a visual, image-first browsing experience).
   */
  layout?: SelectLayout;
}

export const Select = React.memo(function Select({
  label,
  placeholder = 'Select an option',
  value,
  options,
  onChange,
  error,
  searchable = false,
  loading = false,
  disabled = false,
  disabledMessage,
  multi = false,
  required = false,
  layout = 'list',
}: SelectProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const selectedValues = multi ? (Array.isArray(value) ? value : []) : [];
  const singleSelected = multi ? '' : (typeof value === 'string' ? value : '');
  const selected = options.find((o) => o.value === singleSelected);
  const isGrid = layout === 'grid';
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

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
    if (multi) {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(item.value)
        ? current.filter((v) => v !== item.value)
        : [...current, item.value];
      onChange(next);
    } else {
      onChange(item.value);
      setOpen(false);
    }
  }

  function closeModal() {
    if (multi) setQuery('');
    setOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: c.text }]}>{label}{required && <Text style={{ color: c.error }}> *</Text>}</Text>}
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            borderColor: disabled ? c.borderSubtle : (error ? c.error : c.borderSubtle),
            backgroundColor: disabled ? c.input : c.input,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
        onPress={() => {
          if (disabled && disabledMessage) { setShowWarning(true); return; }
          openModal();
        }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            { color: (multi ? selectedValues.length > 0 : !!selected) ? c.text : c.textTertiary },
          ]}
          numberOfLines={1}
        >
          {multi
            ? selectedValues.length === 0
              ? placeholder
              : selectedValues.length === 1
              ? options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]
              : `${selectedValues.length} selected`
            : (selected?.label ?? placeholder)}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <Text style={[styles.arrow, { color: c.textSecondary }]}>▼</Text>
        )}
      </TouchableOpacity>
      {error && (
        <Text style={[styles.error, { color: c.error }]}>{error}</Text>
      )}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={[styles.modal, isGrid && styles.modalGrid, { backgroundColor: c.surface }]}>
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
                onPress={closeModal}
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
            ) : isGrid ? (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.value}
                numColumns={3}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.gridRow}
                renderItem={({ item }) => {
                  const isSelected = multi ? selectedSet.has(item.value) : item.value === singleSelected;
                  return (
                    <TouchableOpacity
                      style={styles.gridCell}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={item.label}
                    >
                      <View
                        style={[
                          styles.gridThumbWrap,
                          {
                            borderColor: isSelected ? c.primary : c.borderSubtle,
                            borderWidth: isSelected ? 2.5 : 1,
                            backgroundColor: c.surface,
                          },
                        ]}
                      >
                        {item.image ? (
                          <Image
                            source={item.image}
                            style={styles.gridThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.gridThumb,
                              styles.gridThumbPlaceholder,
                              { backgroundColor: c.surfaceVariant },
                            ]}
                          >
                            <Ionicons name="leaf-outline" size={28} color={c.textTertiary} />
                          </View>
                        )}
                        {isSelected && multi && (
                          <View
                            style={[
                              styles.gridCheckBadge,
                              { backgroundColor: c.primary, borderColor: c.surface },
                            ]}
                          >
                            <Ionicons name="checkmark" size={12} color={c.primaryForeground} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.gridCellLabel,
                          {
                            color: isSelected ? c.primary : c.text,
                            fontWeight: isSelected ? '600' : '400',
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.option,
                      styles.optionRow,
                      (multi
                        ? (Array.isArray(value) ? value : []).includes(item.value)
                        : item.value === value) && { backgroundColor: c.accent },
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    {item.image ? (
                      <Image
                        source={item.image}
                        style={[
                          styles.optionImage,
                          { backgroundColor: c.surfaceVariant },
                        ]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.optionImagePlaceholder,
                          { backgroundColor: c.surfaceVariant },
                        ]}
                      />
                    )}
                    <View style={styles.optionTextWrap}>
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: (multi
                              ? (Array.isArray(value) ? value : []).includes(item.value)
                              : item.value === value)
                              ? c.primary
                              : c.text,
                          },
                          (multi
                            ? (Array.isArray(value) ? value : []).includes(item.value)
                            : item.value === value) && styles.optionTextSelected,
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
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => (
                  <View
                    style={[styles.separator, { backgroundColor: c.borderSubtle }]}
                  />
                )}
              />
            )}
            {multi && (
              <View style={[styles.multiFooter, { borderTopColor: c.borderSubtle }]}>
                <Text style={[styles.multiFooterCount, { color: c.textSecondary }]}>
                  {selectedValues.length > 0
                    ? `${selectedValues.length} selected`
                    : 'Select one or more'}
                </Text>
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: c.primary }]}
                  onPress={closeModal}
                >
                  <Text style={[styles.doneBtnText, { color: c.primaryForeground }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
      <WarningModal
        visible={showWarning}
        message={disabledMessage ?? ''}
        onClose={() => setShowWarning(false)}
      />
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
  modalGrid: {
    borderTopLeftRadius: tokens.radiusXl,
    borderTopRightRadius: tokens.radiusXl,
    maxHeight: '92%',
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: tokens.spacing3,
  },
  optionImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: tokens.spacing3,
    opacity: 0, // invisible — keeps alignment consistent when no image is available
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: { fontSize: 15 },
  optionTextSelected: { fontWeight: '700' },
  optionSublabel: { fontSize: 12, marginTop: 2 },
  separator: { height: 1 },
  multiFooter: {
    borderTopWidth: 1,
    paddingHorizontal: tokens.spacing6,
    paddingVertical: tokens.spacing4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiFooterCount: {
    fontSize: 13,
    flex: 1,
  },
  doneBtn: {
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3 + 2,
    paddingHorizontal: tokens.spacing8,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700' },
  // Grid layout
  gridContent: {
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing4,
  },
  gridRow: {
    justifyContent: 'flex-start',
    marginBottom: tokens.spacing4,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: tokens.spacing1,
  },
  gridThumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: tokens.spacing2,
    position: 'relative',
  },
  gridThumb: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  gridThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCheckBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  gridCellLabel: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: tokens.spacing1,
  },
});