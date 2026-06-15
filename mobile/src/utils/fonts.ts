import { Platform } from 'react-native';

/**
 * Font configuration for 22 Indian languages.
 *
 * Android 5.0+ and iOS ship with Noto fonts that cover most Indian scripts.
 * For production, consider bundling targeted fonts for offline use.
 *
 * Strategy:
 * - Android: use system fonts (Noto Sans covers all 22 scripts)
 * - iOS: use system fonts (SF Pro covers most scripts; some may need custom fonts)
 *
 * To add custom fonts:
 * 1. Add font files to assets/fonts/
 * 2. Update app.json expo.fonts array
 * 3. Update FONT_CONFIG below
 */

// Script code -> font family mapping
export const FONT_CONFIG: Record<string, string | undefined> = {
  // Devanagari script (Hindi, Marathi, Nepali, Sanskrit, etc.)
  default: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),

  // Per-script fonts (when custom fonts are bundled)
  as: undefined,  // Assamese — Bengali script
  bn: undefined,  // Bengali — Bengali script
  brx: undefined, // Bodo — Devanagari
  doi: undefined, // Dogri — Devanagari
  gu: undefined,  // Gujarati — Gujarati script
  hi: undefined,  // Hindi — Devanagari
  kn: undefined,  // Kannada — Kannada script
  ks: undefined,  // Kashmiri — Arabic script
  kok: undefined, // Konkani — Devanagari
  mai: undefined, // Maithili — Devanagari
  ml: undefined,  // Malayalam — Malayalam script
  mni: undefined, // Manipuri — Bengali/Meitei script
  mr: undefined,  // Marathi — Devanagari
  ne: undefined,  // Nepali — Devanagari
  or: undefined,  // Odia — Odia script
  pa: undefined,  // Punjabi — Gurmukhi script
  sa: undefined,  // Sanskrit — Devanagari
  sat: undefined, // Santali — Ol Chiki
  sd: undefined,  // Sindhi — Arabic script
  ta: undefined,  // Tamil — Tamil script
  te: undefined,  // Telugu — Telugu script
  ur: undefined,  // Urdu — Arabic script
};

/**
 * Get font family for a given language code.
 * Falls back to system default if no specific font is configured.
 */
export function getFontFamily(languageCode: string): string {
  return FONT_CONFIG[languageCode] ?? FONT_CONFIG.default ?? 'System';
}

/**
 * Check if a font family is available on the current platform.
 */
export function isFontAvailable(family: string): boolean {
  if (family === 'System' || family === undefined) return true;
  // In a real implementation, you could check against a font registry
  return true;
}