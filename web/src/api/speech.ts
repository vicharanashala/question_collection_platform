import { getAccessToken, request } from './client'

/**
 * Maps our 2-letter app language code to Sarvam's locale suffix.
 * e.g. 'hi' → 'hi-IN', 'bn' → 'bn-IN'.
 *
 * Also accepts already-qualified codes (e.g. 'hi-IN') and returns them unchanged.
 */
export function toSarvamLang(code: string): string {
  if (code.includes('-')) return code
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

export interface TranscriptionResult {
  text: string
  confidence: number
  languageCode: string
}

export interface TranslationResult {
  translatedText: string
  confidence: number
  sourceLanguage: string
  targetLanguage: string
}

export const speechApi = {
  /**
   * One-shot STT: upload a recorded audio blob and transcribe it via Sarvam.
   *
   * The browser MediaRecorder produces blobs whose MIME type depends on the
   * browser ('audio/webm' on Chromium, 'audio/mp4' on Safari). The backend
   * Nest endpoint (`POST /api/speech/stt`, with `FileInterceptor('audio')`)
   * accepts the raw bytes regardless of container — we send the blob as-is.
   *
   * Mirrors the mobile `speechApi.speechToText` flow exactly so both clients
   * talk to the same backend handler.
   *
   * @param audioBlob      Browser-recorded audio blob (from MediaRecorder)
   * @param languageCode   Sarvam language code (e.g. 'hi-IN', 'en-IN', 'unknown' for auto-detect)
   * @param filename       Optional filename to send with the blob
   */
  async speechToText(audioBlob: Blob, languageCode: string, filename = 'recording.webm'): Promise<{ text: string }> {
    const token = getAccessToken()
    const formData = new FormData()
    // Important: do NOT set Content-Type header manually — the browser will
    // set the correct multipart boundary. Setting it manually breaks the upload.
    formData.append('audio', audioBlob, filename)
    formData.append('language', languageCode)

    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
    const res = await fetch(`${base}/speech/stt`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
      signal: AbortSignal.timeout(120_000), // transcription can take a while for long audio
    })
    if (!res.ok) {
      let message = `STT failed (${res.status})`
      try {
        const data = await res.json()
        if (data?.message) message = data.message
      } catch {
        /* ignore */
      }
      throw new Error(message)
    }
    const data = (await res.json()) as { text: string }
    return data
  },

  /**
   * Translate text from one language to another.
   * @param text  Source text
   * @param targetLanguage  Our 2-letter target language code
   * @param sourceLanguage  Our 2-letter source language code (defaults to 'en')
   */
  translate(text: string, targetLanguage: string, sourceLanguage = 'en'): Promise<TranslationResult> {
    return request<TranslationResult>('/speech/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage: toSarvamLang(targetLanguage),
        sourceLanguage: toSarvamLang(sourceLanguage),
      }),
    })
  },
}