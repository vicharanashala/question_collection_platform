import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { speechApi } from '../api/speech';
import { LANGUAGES } from '../utils/constants';
import { useLanguage } from '../hooks/useLanguage';

interface TrnscberProps {
  /** The source text to display — always rendered when language matches source */
  text: string;
  /** Language to render the text in. Defaults to the user's current app language. */
  language?: string;
  /** Override the source language hint (defaults to 'en') */
  sourceLanguage?: string;
  /** Extra text style props merged on top of the default */
  style?: object;
  /** Show a small inline indicator when showing translated text */
  showIndicator?: boolean;
}

/**
 * Shows `text` translated into the user's preferred language.
 *
 * - Shows `text` as-is when the user's language is the same as `sourceLanguage` (default: 'en').
 * - Fetches translation from the backend and shows a loading spinner until resolved.
 * - Falls back to `text` if translation fails or the backend returns an error.
 */
export function Trnscber({
  text,
  language,
  sourceLanguage = 'en',
  style,
  showIndicator = false,
}: TrnscberProps) {
  const { language: userLang } = useLanguage();
  const targetLang = language ?? userLang;

  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Same language — no translation needed
    if (targetLang === sourceLanguage) {
      setTranslated(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTranslated(null);

    speechApi
      .translate(text, targetLang, sourceLanguage)
      .then((result) => {
        // Backend may return the original text unchanged when no translation was needed
        setTranslated(result.translatedText);
      })
      .catch((err) => {
        console.warn('[Trnscber] translation failed, falling back to original:', err);
        setTranslated(null);
      })
      .finally(() => setLoading(false));
  }, [text, targetLang, sourceLanguage]);

  const displayText = translated ?? text;
  const isTranslated = translated !== null;

  const langLabel = LANGUAGES.find((l) => l.code === targetLang)?.labelEnglish ?? targetLang;

  return (
    <>
      <Text style={style ?? undefined}>{displayText}</Text>
      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#888" />
          <Text style={styles.loadingText}>Translating to {langLabel}…</Text>
        </View>
      )}
      {showIndicator && isTranslated && !loading && (
        <Text style={styles.indicator}>Translated from English</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  indicator: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 2,
    fontStyle: 'italic',
  },
});