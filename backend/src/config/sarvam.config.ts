import { registerAs } from '@nestjs/config';

export const sarvamConfig = registerAs('sarvam', () => ({
  apiKey: process.env.SARVAM_API_KEY || '',
  sttUrl: process.env.SARVAM_STT_URL || 'https://api.sarvam.ai/speech-to-text',
  translateUrl: process.env.SARVAM_TRANSLATE_URL || 'https://api.sarvam.ai/translate',
  // Supported Indian language codes used by Sarvam
  supportedLanguages: [
    'as-IN', // Assamese
    'bn-IN', // Bengali
    'brx-IN', // Bodo
    'doi-IN', // Dogri
    'gu-IN', // Gujarati
    'hi-IN', // Hindi
    'kn-IN', // Kannada
    'ks-IN', // Kashmiri
    'kok-IN', // Konkani
    'mai-IN', // Maithili
    'ml-IN', // Malayalam
    'mni-IN', // Manipuri
    'mr-IN', // Marathi
    'ne-IN', // Nepali
    'or-IN', // Odia
    'pa-IN', // Punjabi
    'sa-IN', // Sanskrit
    'sat-IN', // Santali
    'sd-IN', // Sindhi
    'ta-IN', // Tamil
    'te-IN', // Telugu
    'ur-IN', // Urdu
    'en-IN', // English (India)
  ],
}));