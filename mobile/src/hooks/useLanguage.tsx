import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { getDeviceLanguage, RTL_LANGUAGES, SupportedLanguageCode } from '../i18n';

const LANGUAGE_STORAGE_KEY = 'appLanguage';

interface LanguageContextValue {
  language: SupportedLanguageCode;
  setLanguage: (code: SupportedLanguageCode) => Promise<void>;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<SupportedLanguageCode>('hi');

  useEffect(() => {
    // Load saved language preference on mount
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((saved) => {
      const lang = (saved as SupportedLanguageCode) || getDeviceLanguage();
      i18n.changeLanguage(lang);
      setLanguageState(lang);

      // Apply RTL if needed
      const rtl = RTL_LANGUAGES.includes(lang);
      if (I18nManager.isRTL !== rtl) {
        I18nManager.forceRTL(rtl);
      }
    });
  }, [i18n]);

  const setLanguage = async (code: SupportedLanguageCode) => {
    console.log('[LanguageProvider] setLanguage called with:', code);
    console.log('[LanguageProvider] i18n.language BEFORE:', i18n.language);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    await i18n.changeLanguage(code);
    console.log('[LanguageProvider] i18n.language AFTER:', i18n.language);
    setLanguageState(code);

    // Update RTL layout for Arabic-script languages
    const rtl = RTL_LANGUAGES.includes(code);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
    }
  };

  const isRTL = RTL_LANGUAGES.includes(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}