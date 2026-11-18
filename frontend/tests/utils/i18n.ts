import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/locales/en.json'

// Mirrors the app's i18n options with English loaded synchronously, so tests assert real UI copy.
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  fallbackNS: 'common',
  nsSeparator: false,
  keySeparator: '.',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  resources: { en },
})

export default i18n
