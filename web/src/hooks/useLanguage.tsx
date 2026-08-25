/**
 * Language context — mirrors `mobile/src/hooks/useLanguage.tsx`.
 *
 * Exposes `{ language, setLanguage, isRTL }` to any component inside
 * <LanguageProvider>. Persistence (`localStorage` key `appLanguage`) and
 * `<html dir/lang>` sync are delegated to the existing i18n config
 * (`web/src/i18n/index.ts`) so there is exactly one source of truth for the
 * active language.
 *
 * Role-based locale lock: only the `user` role may change language. Every
 * other role (admin, super_admin, curator, finance, distributor) is forced
 * to English. The switcher UI is hidden separately in each component; this
 * hook is the defence-in-depth that guarantees any code path that calls
 * `setLanguage(...)` for a staff user is a no-op.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { i18n as I18nInstance } from 'i18next'
import { useAuth } from '@/context/AuthContext'
import { isEndUser } from '@/lib/roles'
import {
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from '@/i18n'

export interface LanguageContextValue {
  language: SupportedLanguageCode
  /** Native-script name of the active language (e.g. "हिन्दी", "اردو"). */
  nativeName: string
  setLanguage: (code: SupportedLanguageCode) => Promise<void>
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

/**
 * Resolve the active language, falling back to `'en'` if i18next ever reports
 * a value that isn't in our supported list (shouldn't happen because the
 * i18n config sets `supportedLngs`, but the guard keeps consumers type-safe).
 */
function resolveActiveLanguage(
  i18nInstance: I18nInstance,
): { code: SupportedLanguageCode; nativeName: string } {
  const code = i18nInstance.language || 'en'
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code)
  return match
    ? { code: match.code, nativeName: match.nativeName }
    : { code: 'en', nativeName: 'English' }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // useTranslation subscribes to i18next's language events; consumers
  // re-render automatically when `i18n.language` changes.
  const { i18n: i18nInstance } = useTranslation()
  const { user } = useAuth()

  const userMayChangeLanguage = isEndUser(user)

  // Force English whenever a staff user is signed in (or when a previously-
  // end-user session transitions to a staff role). Runs on mount AND on
  // every user change so stale `appLanguage` cache from a prior session
  // (or a different role) cannot leak through.
  useEffect(() => {
    if (userMayChangeLanguage) return
    if (i18nInstance.language === 'en') return
    void i18nInstance.changeLanguage('en').then(() => {
      try { localStorage.setItem('appLanguage', 'en') } catch { /* noop */ }
    })
  }, [i18nInstance, userMayChangeLanguage, user])

  const setLanguage = useCallback(
    async (code: SupportedLanguageCode) => {
      // Staff roles are locked to English — silently ignore any switch
      // attempt so direct API calls, profile updates, or future code
      // paths can't override the lock from the UI layer alone.
      if (!userMayChangeLanguage) return
      await i18nInstance.changeLanguage(code)
      // Persistence (localStorage `appLanguage`) and <html dir/lang> sync are
      // already handled by:
      //   - i18next-browser-languagedetector (cache: ['localStorage'],
      //     lookupLocalStorage: 'appLanguage') in @/i18n.
      //   - i18n.on('languageChanged', …) in @/i18n.
    },
    [i18nInstance, userMayChangeLanguage],
  )

  const value = useMemo<LanguageContextValue>(() => {
    const { code, nativeName } = resolveActiveLanguage(i18nInstance)
    return {
      language: code,
      nativeName,
      setLanguage,
      isRTL: RTL_LANGUAGES.includes(code),
    }
    // Re-derive when the active language changes (re-render is driven by
    // useTranslation's subscription to i18next's languageChanged event).
  }, [i18nInstance.language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}