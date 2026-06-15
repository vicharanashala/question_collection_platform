import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '../i18n';

/**
 * Simple script-based language detection using character ranges.
 * For production, integrate a proper NER library or API.
 */
export function detectLanguage(text: string): SupportedLanguageCode {
  if (!text || text.trim().length === 0) return 'hi';

  const langScores: Record<string, number> = {};

  for (const lang of SUPPORTED_LANGUAGES) {
    langScores[lang.code] = 0;
  }

  for (const lang of SUPPORTED_LANGUAGES) {
    const ranges = SCRIPT_RANGES[lang.code];
    if (!ranges) continue;

    for (const char of text) {
      const code = char.charCodeAt(0);
      for (const [start, end] of ranges) {
        if (code >= start && code <= end) {
          langScores[lang.code]++;
          break;
        }
      }
    }
  }

  let bestLang: SupportedLanguageCode = 'hi';
  let bestScore = 0;

  for (const [code, score] of Object.entries(langScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = code as SupportedLanguageCode;
    }
  }

  return bestScore > 0 ? bestLang : 'hi';
}

// Unicode ranges for each script
const SCRIPT_RANGES: Record<string, [number, number][]> = {
  as: [[0x0980, 0x09FF]],           // Bengali+Assamese
  bn: [[0x0980, 0x09FF]],           // Bengali
  brx: [[0x0900, 0x097F]],          // Devanagari (approximation)
  doi: [[0x0900, 0x097F]],          // Devanagari
  gu: [[0x0A80, 0x0AFF]],           // Gujarati
  hi: [[0x0900, 0x097F]],           // Devanagari
  kn: [[0x0C80, 0x0CFF]],           // Kannada
  ks: [[0x0600, 0x06FF], [0x0750, 0x077F]], // Arabic
  kok: [[0x0900, 0x097F]],          // Devanagari (Konkani uses Devanagari script)
  mai: [[0x0900, 0x097F]],          // Devanagari
  ml: [[0x0D00, 0x0D7F]],           // Malayalam
  mni: [[0x0980, 0x09FF]],          // Bengali (Meitei Mayek is also used but Bengali range works for common text)
  mr: [[0x0900, 0x097F]],           // Devanagari
  ne: [[0x0900, 0x097F]],           // Devanagari
  or: [[0x0B00, 0x0B7F]],           // Odia
  pa: [[0x0A00, 0x0A7F]],           // Gurmukhi
  sa: [[0x0900, 0x097F]],           // Devanagari
  sat: [[0x1C50, 0x1C7F]],          // Ol Chiki
  sd: [[0x0600, 0x06FF]],           // Arabic
  ta: [[0x0B80, 0x0BFF]],           // Tamil
  te: [[0x0C00, 0x0C7F]],           // Telugu
  ur: [[0x0600, 0x06FF], [0x0750, 0x077F]], // Arabic
};

/**
 * Get the display name for a language code
 */
export function getLanguageName(code: SupportedLanguageCode): string {
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.code === code) return lang.nativeName;
  }
  return code;
}

/**
 * Get the English name for a language code
 */
export function getLanguageNameEnglish(code: SupportedLanguageCode): string {
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.code === code) return lang.name;
  }
  return code;
}