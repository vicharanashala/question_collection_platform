import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getLocales } from 'expo-localization';
import bundledResources from './resources';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', script: 'Latin' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', script: 'Bengali' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali' },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', script: 'Devanagari' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', script: 'Devanagari' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर / كشميري', script: 'Arabic' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', script: 'Devanagari' },
  { code: 'mai', name: 'Maithili', nativeName: 'মৈথিলী', script: 'Devanagari' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam' },
  { code: 'mni', name: 'Manipuri', nativeName: 'মণিপুরী', script: 'Bengali' },
  { code: 'mr', name: 'Marathi', nativeName: 'মরাঠী', script: 'Devanagari' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', script: 'Devanagari' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Odia' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', script: 'Devanagari' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'OlChiki' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سندھي / سنڌي', script: 'Arabic' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', script: 'Arabic', rtl: true },
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// RTL languages
export const RTL_LANGUAGES: SupportedLanguageCode[] = ['ur', 'ks', 'sd'];

// Get device locale and find matching supported language
export function getDeviceLanguage(): SupportedLanguageCode {
  const locales = getLocales();
  if (locales.length === 0) return 'en';

  for (const locale of locales) {
    const code = locale.languageCode as SupportedLanguageCode;
    if (SUPPORTED_LANGUAGES.find((l) => l.code === code)) {
      return code;
    }
  }
  return 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: __DEV__,
    ns: ['common', 'auth', 'home', 'question', 'wallet', 'profile', 'admin'],
    defaultNS: 'common',
    fallbackNS: 'common',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'deviceLocale'],
      caches: ['localStorage'],
      lookupLocalStorage: 'appLanguage',
    },
    nsSeparator: false,
    keySeparator: '.',
    react: {
      useSuspense: false,
    },
    // Bundled resources — no HttpBackend needed, works fully offline.
    resources: bundledResources,
  });

export default i18n;