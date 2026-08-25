import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { getDeviceLanguage, RTL_LANGUAGES, SupportedLanguageCode } from '../i18n';
import { useAuth } from './useAuth';
import { UserRole } from '../types';

const LANGUAGE_STORAGE_KEY = 'appLanguage';

interface LanguageContextValue {
  language: SupportedLanguageCode;
  setLanguage: (code: SupportedLanguageCode) => Promise<void>;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Returns true only for the end-user role. Every other role (admin,
 * super_admin, curator, finance) is locked to English — they see no language
 * switcher UI and any attempt to switch languages is a silent no-op.
 */
function isEndUser(role: string | undefined | null): boolean {
  return role === UserRole.USER;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguageCode>('en');

  const userMayChangeLanguage = isEndUser(user?.role);

  // On mount: load saved preference, but force 'en' for staff roles so a
  // stale AsyncStorage value from a previous role can't leak through.
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((saved) => {
      const requested = (saved as SupportedLanguageCode) || getDeviceLanguage();
      const lang = userMayChangeLanguage ? requested : 'en';
      i18n.changeLanguage(lang);
      setLanguageState(lang);

      const rtl = RTL_LANGUAGES.includes(lang);
      if (I18nManager.isRTL !== rtl) {
        I18nManager.forceRTL(rtl);
      }
    });
    // Re-run when the auth role changes so a fresh staff login flips to 'en'.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n, user?.role]);

  // When the active role becomes staff, immediately snap the UI back to
  // English (covers the case where the user was previously an end-user and
  // their cached language is non-English).
  useEffect(() => {
    if (userMayChangeLanguage) return;
    if (i18n.language === 'en') return;
    i18n.changeLanguage('en');
    setLanguageState('en');
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'en').catch(() => {});
    if (I18nManager.isRTL !== false) {
      I18nManager.forceRTL(false);
    }
  }, [userMayChangeLanguage, i18n]);

  const setLanguage = useCallback(
    async (code: SupportedLanguageCode) => {
      // Staff roles are locked to English — silently ignore any switch
      // attempt so direct API calls, profile updates, or future code
      // paths can't override the lock from the UI layer alone.
      if (!userMayChangeLanguage) return;

      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      await i18n.changeLanguage(code);
      setLanguageState(code);

      // Update RTL layout for Arabic-script languages
      const rtl = RTL_LANGUAGES.includes(code);
      if (I18nManager.isRTL !== rtl) {
        I18nManager.forceRTL(rtl);
      }
    },
    [i18n, userMayChangeLanguage],
  );

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