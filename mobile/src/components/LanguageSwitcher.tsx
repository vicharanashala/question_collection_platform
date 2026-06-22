import React, { useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES, SupportedLanguageCode } from '../i18n';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';

interface LanguageSwitcherProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSwitcher({ visible, onClose }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const { setLanguage } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;

  const handleSelect = useCallback(
    async (code: SupportedLanguageCode) => {
      await setLanguage(code);
      onClose();
    },
    [setLanguage, onClose]
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof SUPPORTED_LANGUAGES)[number] }) => {
      const isSelected = i18n.language === item.code;
      const isRTL = RTL_LANGUAGES.includes(item.code as SupportedLanguageCode);

      return (
        <TouchableOpacity
          style={[
            styles.item,
            isSelected && { backgroundColor: c.primary + '18' },
          ]}
          onPress={() => handleSelect(item.code)}
          activeOpacity={0.7}
        >
          <View style={styles.itemContent}>
            <Text
              style={[
                styles.nativeName,
                { color: isSelected ? c.primary : c.text },
                isRTL && styles.rtlText,
              ]}
            >
              {item.nativeName}
            </Text>
            <Text
              style={[
                styles.englishName,
                { color: isSelected ? c.primary : c.textSecondary },
              ]}
            >
              {item.name}
            </Text>
          </View>
          {isSelected && (
            <Text style={[styles.checkmark, { color: c.primary }]}>✓</Text>
          )}
        </TouchableOpacity>
      );
    },
    [i18n.language, handleSelect, c]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>{t('auth.selectLanguage')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: c.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={SUPPORTED_LANGUAGES}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: c.borderSubtle }]} />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '600' },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20 },
  list: { paddingBottom: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemContent: { flex: 1 },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  rtlText: { textAlign: 'right' },
  englishName: { fontSize: 13 },
  checkmark: { fontSize: 18, marginLeft: 8 },
  separator: {
    height: 1,
    marginLeft: 16,
  },
});