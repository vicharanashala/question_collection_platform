import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

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

@Injectable()
export class SarvamService {
  private readonly logger = new Logger(SarvamService.name);
  private readonly apiKey: string;
  private readonly sttUrl: string;
  private readonly translateUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('sarvam.apiKey') ?? '';
    this.sttUrl =
      this.configService.get<string>('sarvam.sttUrl') ??
      'https://api.sarvam.ai/speech-to-text';
    this.translateUrl =
      this.configService.get<string>('sarvam.translateUrl') ??
      'https://api.sarvam.ai/translate';
  }

  /**
   * Transcribe an audio file to text using Sarvam STT API.
   *
   * @param audioUrl  Public URL to the audio file (MP3/WAV/FLAC)
   * @param languageCode  Sarvam language code e.g. 'hi-IN', 'ta-IN'
   */
  async transcribeAudio(
    audioUrl: string,
    languageCode: string,
  ): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new HttpException(
        'Sarvam API key is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.debug(
      `Transcribing audio at ${audioUrl} in language ${languageCode}`,
    );

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const response = await axios.post(
          this.sttUrl,
          {
            audio_url: audioUrl,
            language_code: languageCode,
            model: 'saarvam1.0',
          },
          {
            headers: {
              'api-subscription-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 30_000,
          },
        );

        const data = response.data;

        // Sarvam STT response shape (per docs — adjust if verification differs)
        const text =
          typeof data === 'string'
            ? data.trim()
            : (data?.text ?? data?.transcript ?? JSON.stringify(data));

        return {
          text,
          confidence: data?.confidence ?? data?.score ?? 1.0,
          languageCode,
        };
      } catch (err) {
        attempt++;
        const axiosErr = err as AxiosError;

        if (axiosErr.response?.status === 429) {
          // Rate limited — exponential backoff
          const retryAfter = parseInt(
            axiosErr.response.headers['retry-after'] ?? '5',
            10,
          );
          const waitMs = retryAfter * 1000 * attempt;
          this.logger.warn(
            `Sarvam STT rate-limited. Retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`,
          );
          await this.sleep(waitMs);
          continue;
        }

        if (attempt >= maxAttempts) {
          this.logger.error(
            `Sarvam STT failed after ${maxAttempts} attempts: ${axiosErr.message}`,
          );
          throw new HttpException(
            'Audio transcription failed. Please try again.',
            HttpStatus.BAD_GATEWAY,
          );
        }

        // Non-429 error, retry immediately
        this.logger.warn(
          `Sarvam STT attempt ${attempt} failed: ${axiosErr.message}. Retrying…`,
        );
      }
    }

    // Should not reach here, but satisfy TypeScript
    throw new HttpException(
      'Audio transcription failed unexpectedly.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Translate English text to a target Indian language using Sarvam Translate API.
   *
   * @param text  English source text
   * @param targetLanguage  Sarvam target language code e.g. 'hi-IN'
   * @param sourceLanguage  Source language code (defaults to 'en-IN')
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage = 'en-IN',
  ): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new HttpException(
        'Sarvam API key is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!text || text.trim().length === 0) {
      throw new HttpException(
        'Source text cannot be empty',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(
      `Translating from ${sourceLanguage} → ${targetLanguage}: "${text.slice(0, 50)}…"`,
    );

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const response = await axios.post(
          this.translateUrl,
          {
            text,
            source_language: sourceLanguage,
            target_language: targetLanguage,
            model: 'saarvam1.0',
          },
          {
            headers: {
              'api-subscription-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 30_000,
          },
        );

        const data = response.data;
        const translatedText =
          typeof data === 'string'
            ? data.trim()
            : (data?.translated_text ?? data?.output ?? JSON.stringify(data));

        return {
          translatedText,
          confidence: data?.confidence ?? data?.score ?? 1.0,
          sourceLanguage,
          targetLanguage,
        };
      } catch (err) {
        attempt++;
        const axiosErr = err as AxiosError;

        if (axiosErr.response?.status === 429) {
          const retryAfter = parseInt(
            axiosErr.response.headers['retry-after'] ?? '5',
            10,
          );
          const waitMs = retryAfter * 1000 * attempt;
          this.logger.warn(
            `Sarvam Translate rate-limited. Retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`,
          );
          await this.sleep(waitMs);
          continue;
        }

        if (attempt >= maxAttempts) {
          this.logger.error(
            `Sarvam Translate failed after ${maxAttempts} attempts: ${axiosErr.message}`,
          );
          throw new HttpException(
            'Translation failed. Please try again.',
            HttpStatus.BAD_GATEWAY,
          );
        }

        this.logger.warn(
          `Sarvam Translate attempt ${attempt} failed: ${axiosErr.message}. Retrying…`,
        );
      }
    }

    throw new HttpException(
      'Translation failed unexpectedly.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}