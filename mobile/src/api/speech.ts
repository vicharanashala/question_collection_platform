import api, { uploadAudioFile } from './client';

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
   * Upload a local audio file then transcribe it to text via Sarvam.
   *
   * Step 1 — POST /speech/upload (multipart) → { audioUrl: string }
   * Step 2 — POST /speech/transcribe (JSON)  → { text, confidence, languageCode }
   *
   * @param audioUri  Local URI of the recorded audio file (from expo-audio)
   * @param languageCode  Our 2-letter language code (e.g. 'hi', 'ta')
   */
  async transcribe(audioUri: string, languageCode: string): Promise<TranscriptionResult> {
    // Step 1: Upload the file and get a publicly accessible URL
    const { audioUrl } = await uploadAudioFile(audioUri, 'recording.m4a');

    // Step 2: Send the URL to the transcription endpoint
    const result = await api.post<TranscriptionResult>('/speech/transcribe', {
      audioUrl,
      languageCode: toSarvamLang(languageCode),
    });
    return result.data;
  },

  /**
   * Translate text from one language to another.
   * @param text  Source text
   * @param targetLanguage  Our 2-letter target language code
   * @param sourceLanguage  Our 2-letter source language code (defaults to 'en')
   */
  translate(
    text: string,
    targetLanguage: string,
    sourceLanguage = 'en',
  ): Promise<TranslationResult> {
    return api
      .post<TranslationResult>('/speech/translate', {
        text,
        targetLanguage: toSarvamLang(targetLanguage),
        sourceLanguage: toSarvamLang(sourceLanguage),
      })
      .then((r) => r.data);
  },
};