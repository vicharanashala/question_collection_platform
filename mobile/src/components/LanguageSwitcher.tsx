import React, { useCallback } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES, SupportedLanguageCode } from '../i18n';

interface LanguageSwitcherProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSwitcher({ visible, onClose }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const { setLanguage } = useLanguage();

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
          style={[styles.item, isSelected && styles.itemSelected]}
          onPress={() => handleSelect(item.code)}
          activeOpacity={0.7}
        >
          <View style={styles.itemContent}>
            <Text
              style={[
                styles.nativeName,
                isRTL && styles.rtlText,
                isSelected && styles.textSelected,
              ]}
            >
              {item.nativeName}
            </Text>
            <Text style={[styles.englishName, isSelected && styles.textSelected]}>
              {item.name}
            </Text>
          </View>
          {isSelected && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      );
    },
    [i18n.language, handleSelect]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.selectLanguage')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={SUPPORTED_LANGUAGES}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    color: '#666',
  },
  list: {
    paddingBottom: 32,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemSelected: {
    backgroundColor: '#f0f7ff',
  },
  itemContent: {
    flex: 1,
  },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  rtlText: {
    textAlign: 'right',
  },
  englishName: {
    fontSize: 13,
    color: '#666',
  },
  textSelected: {
    color: '#2563eb',
  },
  checkmark: {
    fontSize: 18,
    color: '#2563eb',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },
});