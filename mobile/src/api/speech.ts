import api from './client';

/**
 * Maps our 2-letter app language code to Sarvam's locale suffix.
 * e.g. 'hi' → 'hi-IN', 'bn' → 'bn-IN'
 */
export function toSarvamLang(code: string): string {
  const map: Record<string, string> = {
    as: 'as-IN',
    bn: 'bn-IN',
    brx: 'brx-IN',
    doi: 'doi-IN',
    gu: 'gu-IN',
    hi: 'hi-IN',
    kn: 'kn-IN',
    ks: 'ks-IN',
    kok: 'kok-IN',
    mai: 'mai-IN',
    ml: 'ml-IN',
    mni: 'mni-IN',
    mr: 'mr-IN',
    ne: 'ne-IN',
    or: 'or-IN',
    pa: 'pa-IN',
    sa: 'sa-IN',
    sat: 'sat-IN',
    sd: 'sd-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    ur: 'ur-IN',
    en: 'en-IN',
  };
  return map[code] ?? `${code}-IN`;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  languageCode: string;
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  sourceLanguage: string;
  targetLanguage: string;
}

export const speechApi = {
  /**
   * Transcribe an audio file (hosted at audioUrl) to text.
   * @param audioUrl  Public URL to the recorded audio file
   * @param languageCode  Our 2-letter language code (e.g. 'hi', 'ta')
   */
  transcribe(audioUrl: string, languageCode: string): Promise<TranscriptionResult> {
    return api
      .post<TranscriptionResult>('/speech/transcribe', {
        audioUrl,
        languageCode: toSarvamLang(languageCode),
      })
      .then((r) => r.data);
  },

  /**
   * Translate English text to a target language.
   * @param text  English source text
   * @param targetLanguage  Our 2-letter target language code
   */
  translate(text: string, targetLanguage: string): Promise<TranslationResult> {
    return api
      .post<TranslationResult>('/speech/translate', {
        text,
        targetLanguage: toSarvamLang(targetLanguage),
        sourceLanguage: 'en-IN',
      })
      .then((r) => r.data);
  },
};