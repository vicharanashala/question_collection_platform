import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { speechApi } from '../api/speech';
import { LANGUAGES } from '../utils/constants';

const LANG_LABELS: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.label]),
);

interface TranslatableTextReadOnlyProps {
  /** The text to translate (source text, e.g. English). */
  text: string;
  /** Currently selected target language code. */
  selectedLang: string;
  /** Callback fired when the user picks a language. */
  onLangChange: (lang: string) => void;
  /** 2-letter source language of `text`. Defaults to 'en'. */
  sourceLanguage?: string;
  /** Style the container. */
  style?: object;
}

export function TranslatableTextReadOnly({
  text,
  selectedLang,
  onLangChange,
  sourceLanguage = 'en',
  style,
}: TranslatableTextReadOnlyProps) {
  const { language: appLanguage } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;

  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [displayedLang, setDisplayedLang] = useState(sourceLanguage);

  const selectedLangRef = useRef(selectedLang);
  useEffect(() => { selectedLangRef.current = selectedLang }, [selectedLang]);

  const targetLang = selectedLang || appLanguage;
  const langLabel = LANG_LABELS[targetLang] ?? targetLang.toUpperCase();
  const isSameLang = displayedLang === targetLang;

  // Reset when language changes
  useEffect(() => {
    if (targetLang) {
      setTranslated(null);
      setDisplayedLang(sourceLanguage);
    }
  }, [targetLang, sourceLanguage]);

  async function doTranslate() {
    if (!targetLang || loading) return;
    const currentText = translated ?? text;
    if (!currentText.trim()) return;

    setLoading(true);
    try {
      const result = await speechApi.translate(
        currentText.trim(),
        targetLang,
        displayedLang,
      );
      setTranslated(result.translatedText);
      setDisplayedLang(targetLang);
    } finally {
      setLoading(false);
    }
  }

  function handleLangSelect(code: string) {
    setShowLangPicker(false);
    onLangChange(code);
    if (code !== sourceLanguage) {
      setTimeout(() => {
        if (selectedLangRef.current === code) doTranslate();
      }, 0);
    }
  }

  const displayedText = translated ?? text;

  return (
    <View style={style}>
      <View style={styles.row}>
        {/* Language picker trigger */}
        <TouchableOpacity
          style={[styles.langBtn, { borderColor: c.muted }]}
          onPress={() => setShowLangPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="language" size={13} color={c.textSecondary} />
          <Text style={[styles.langBtnText, { color: c.textSecondary }]}>
            {targetLang && targetLang !== sourceLanguage ? langLabel : 'Language'}
          </Text>
        </TouchableOpacity>

        {/* Translate / show / reset buttons */}
        {!isSameLang && !translated && !loading && targetLang && (
          <TouchableOpacity onPress={doTranslate} activeOpacity={0.7}>
            <Text style={[styles.actionBtn, { color: c.primary }]}>
              Translate to {langLabel}
            </Text>
          </TouchableOpacity>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={c.primary} />
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>
              Translating…
            </Text>
          </View>
        )}

        {translated && !loading && (
          <TouchableOpacity
            onPress={() => { setTranslated(null) }}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionBtn, { color: c.textSecondary }]}>
              Original
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Displayed text */}
      <Text style={[styles.displayText, { color: c.text }]} numberOfLines={3}>
        {displayedText}
      </Text>

      {/* Translated block */}
      {(translated || (targetLang && targetLang !== sourceLanguage && !loading)) && (
        <View style={[styles.translatedBlock, { backgroundColor: c.primaryBg + '18', borderColor: c.primary + '30' }]}>
          <View style={styles.translatedHeader}>
            <Ionicons name="language" size={12} color={c.primary} />
            <Text style={[styles.translatedLabel, { color: c.primary }]}>
              {langLabel}
            </Text>
          </View>
          <Text style={[styles.translatedText, { color: c.text }]}>
            {translated ?? ''}
          </Text>
        </View>
      )}

      {/* Language picker modal */}
      <Modal
        visible={showLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLangPicker(false)}
        >
          <View style={[styles.langModal, { backgroundColor: c.surface }]}>
            <Text style={[styles.langModalTitle, { color: c.text }]}>
              Select Language
            </Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.langOption,
                    item.code === targetLang && { backgroundColor: c.primaryBg + '18' },
                  ]}
                  onPress={() => handleLangSelect(item.code)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      { color: item.code === targetLang ? c.primary : c.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={[styles.langOptionSub, { color: c.textSecondary }]}>
                    {item.labelEnglish}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionBtn: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
  },
  displayText: {
    fontSize: 14,
    lineHeight: 20,
  },
  translatedBlock: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  translatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  translatedLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  translatedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  langModal: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
  },
  langModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  langOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  langOptionSub: {
    fontSize: 12,
  },
});