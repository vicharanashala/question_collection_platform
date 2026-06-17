import { request } from './client'

/** Maps our 2-letter language code to Sarvam's locale suffix. */
export function toSarvamLang(code: string): string {
  const map: Record<string, string> = {
    as: 'as-IN', bn: 'bn-IN', brx: 'brx-IN', doi: 'doi-IN',
    gu: 'gu-IN', hi: 'hi-IN', kn: 'kn-IN', ks: 'ks-IN',
    kok: 'kok-IN', mai: 'mai-IN', ml: 'ml-IN', mni: 'mni-IN',
    mr: 'mr-IN', ne: 'ne-IN', or: 'or-IN', pa: 'pa-IN',
    sa: 'sa-IN', sat: 'sat-IN', sd: 'sd-IN', ta: 'ta-IN',
    te: 'te-IN', ur: 'ur-IN', en: 'en-IN',
  }
  return map[code] ?? `${code}-IN`
}

export interface TranslationResult {
  translatedText: string
  confidence: number
  sourceLanguage: string
  targetLanguage: string
}

export const speechApi = {
  /** Translate English text to a target language. */
  translate(text: string, targetLanguage: string): Promise<TranslationResult> {
    return request<TranslationResult>('/speech/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage: toSarvamLang(targetLanguage),
        sourceLanguage: 'en-IN',
      }),
    })
  },
}