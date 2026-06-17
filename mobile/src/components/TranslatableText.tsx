import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { speechApi } from '../api/speech';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import { tokens } from '../utils/theme';
import { LANGUAGES } from '../utils/constants';

interface TranslatableTextProps {
  /**
   * The English text to be translated.
   * This is the source text that will be passed to the translate API.
   */
  value: string;

  /**
   * Called when translation is successful, with the translated text.
   * The parent should update the displayed text state with this value.
   */
  onTranslatedText: (translatedText: string) => void;

  /**
   * Override the target language.
   * Defaults to the current app language from useLanguage().
   */
  targetLanguage?: string;

  /** Placeholder when input is empty */
  placeholder?: string;

  /** Style the inner TextInput */
  inputStyle?: object;

  /** Disabled state — hides translate button */
  disabled?: boolean;
}

/**
 * A wrapper around a TextInput that adds a translate button.
 * Takes English text in the `value` prop, calls the Sarvam translate API on button press,
 * and returns the translated text via `onTranslatedText`.
 *
 * The component does NOT mutate `value` internally — it is a pure presentation component.
 * The parent is responsible for updating `value` when `onTranslatedText` fires.
 */
export function TranslatableText({
  value,
  onTranslatedText,
  targetLanguage: targetLangOverride,
  placeholder,
  inputStyle,
  disabled,
}: TranslatableTextProps) {
  const { language: appLanguage } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [translating, setTranslating] = useState(false);
  const targetLang = targetLangOverride ?? appLanguage;

  const langLabel =
    LANGUAGES.find((l) => l.code === targetLang)?.label ?? targetLang.toUpperCase();

  async function handleTranslate() {
    if (!value.trim() || translating || disabled) return;

    setTranslating(true);
    try {
      const result = await speechApi.translate(value.trim(), targetLang);
      onTranslatedText(result.translatedText);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string }; message?: string } })
          ?.response?.data?.message ??
        (err as Error)?.message ??
        t('audio.translateError') ??
        'Translation failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setTranslating(false);
    }
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: c.surface, borderColor: c.muted },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: c.text },
            inputStyle,
          ]}
          value={value}
          placeholder={placeholder ?? t('audio.textPlaceholder') ?? 'Type your question in English…'}
          placeholderTextColor={c.textSecondary}
          multiline
          editable={!disabled}
          onChangeText={() => {}}
        />

        {/* Translate button */}
        <TouchableOpacity
          style={[
            styles.translateBtn,
            { backgroundColor: c.primary },
            (translating || disabled || !value.trim()) && styles.translateBtnDisabled,
          ]}
          onPress={handleTranslate}
          disabled={translating || disabled || !value.trim()}
          activeOpacity={0.75}
        >
          {translating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="language" size={15} color="#fff" />
              <Text style={styles.translateBtnLabel}>
                {langLabel}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {value.trim() && (
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          {t('audio.translateHint') ?? `Translate to ${langLabel}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: tokens.radiusLg,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: tokens.spacing2,
    marginRight: tokens.spacing2,
    borderRadius: tokens.radiusMd,
  },
  translateBtnDisabled: {
    opacity: 0.5,
  },
  translateBtnLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    marginTop: 4,
    marginLeft: tokens.spacing4,
    fontSize: 11,
    fontWeight: '500',
  },
});