import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as FormData from 'form-data';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
   * Send audio bytes directly to Sarvam STT and return the transcript.
   * The buffer is streamed as multipart/form-data — nothing is written to disk.
   */
  async transcribeBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    languageCode: string,
  ): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new HttpException(
        'Sarvam API key is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.debug(
      `Transcribing ${buffer.length} bytes (${filename}, ${mimeType}) in ${languageCode}`,
    );

    // Minimum valid audio: 1 second of 16kHz mono 16-bit PCM = 32 KB.
    // A file smaller than this is almost certainly corrupt/incomplete.
    const MIN_VALID_BYTES = 1_024;
    if (buffer.length < MIN_VALID_BYTES) {
      this.logger.warn(
        `Audio buffer too small (${buffer.length} B) — skipping transcription`,
      );
      return { text: '', confidence: 0, languageCode };
    }

    // Sarvam STT rejects AAC/M4A but accepts WAV (PCM). Convert if needed.
    const wavBuffer = await this.m4aToWav(buffer, filename);

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const form = new FormData();
        form.append('file', wavBuffer, {
          filename: filename.replace(/\.[^.]+$/, '.wav'),
          contentType: 'audio/wav',
        });
        form.append('language_code', languageCode);
        form.append('model', 'saarika:v2.5');

        const response = await axios.post(this.sttUrl, form, {
          headers: {
            ...form.getHeaders(),
            'api-subscription-key': this.apiKey,
          },
          timeout: 30_000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        const data = response.data;
        this.logger.debug(
          `Sarvam response (${response.status}): ${JSON.stringify(data).slice(0, 200)}`,
        );
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

        this.logger.warn(
          `Sarvam STT attempt ${attempt} failed: ${axiosErr.message}. Retrying…`,
        );
      }
    }

    throw new HttpException(
      'Audio transcription failed unexpectedly.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Convert an M4A/AAC buffer to 16 kHz mono 16-bit PCM WAV.
   * Tries ffmpeg first (Linux), then afconvert (macOS), then falls back to
   * passing the original buffer unchanged.
   *
   * ffmpeg rejects M4A files produced by iOS Simulator because they contain
   * a non-standard 'chnl' box (version 1) — this is stripped before conversion.
   * afconvert handles 'chnl' natively so no stripping is needed on macOS.
   */
  private async m4aToWav(buffer: Buffer, filename: string): Promise<Buffer> {
    const ext = filename.split('.').pop()?.toLowerCase();
    const isAac =
      ext === 'm4a' || ext === 'aac' || filename.includes('audio/mp4');
    if (!isAac) return buffer;

    const safeName = `sarvam_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputPath = join(tmpdir(), `${safeName}.m4a`);
    const outputPath = join(tmpdir(), `${safeName}.wav`);

    try {
      // Try ffmpeg first (Linux / production containers)
      if (this.commandExists('ffmpeg')) {
        // iOS Simulator M4A has a 'chnl' box ffmpeg can't parse — strip it first
        const cleanedBuffer = this.stripChnlBox(buffer);
        writeFileSync(inputPath, cleanedBuffer);
        execSync(
          `ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -acodec pcm_s16le "${outputPath}"`,
          { timeout: 15_000, stdio: 'pipe' },
        );
        this.logger.debug(
          `ffmpeg converted M4A (${buffer.length} B) → WAV (${readFileSync(outputPath).length} B)`,
        );
        return readFileSync(outputPath);
      }

      // Fall back to afconvert (macOS development) — handles chnl natively
      if (this.commandExists('/usr/bin/afconvert')) {
        writeFileSync(inputPath, buffer);
        execSync(
          `/usr/bin/afconvert -f WAVE -d LEI16@16000 "${inputPath}" "${outputPath}"`,
          { timeout: 15_000, stdio: 'pipe' },
        );
        this.logger.debug(
          `afconvert converted M4A (${buffer.length} B) → WAV (${readFileSync(outputPath).length} B)`,
        );
        return readFileSync(outputPath);
      }

      this.logger.warn(
        'No audio converter found (ffmpeg or afconvert); sending M4A directly to Sarvam',
      );
      return buffer;
    } catch (err) {
      this.logger.warn(
        `M4A→WAV conversion failed (${(err as Error).message}); sending original buffer`,
      );
      return buffer;
    } finally {
      try { unlinkSync(inputPath); } catch { /* ignore */ }
      try { unlinkSync(outputPath); } catch { /* ignore */ }
    }
  }

  /**
   * Strip the non-standard 'chnl' box from iOS Simulator M4A recordings.
   * ffmpeg cannot parse 'chnl' version 1 boxes; afconvert can.
   * Safe: only zeroes the 16-byte chnl box if found; leaves everything else intact.
   */
  private stripChnlBox(buf: Buffer): Buffer {
    for (let i = 0; i < buf.length - 4; i++) {
      if (
        buf[i] === 0x63 &&    // 'c'
        buf[i + 1] === 0x68 && // 'h'
        buf[i + 2] === 0x6e && // 'n'
        buf[i + 3] === 0x6c    // 'l'
      ) {
        const size = buf.readUInt32BE(i - 4);
        // chnl boxes are typically 16 bytes
        if (size === 16 || (size > 0 && size < buf.length - i + 4)) {
          const cleaned = Buffer.from(buf);
          cleaned.fill(0, i - 4, i - 4 + size);
          this.logger.debug(`Stripped chnl box (${size} bytes) from M4A`);
          return cleaned;
        }
      }
    }
    return buf;
  }

  /** Check if a command is available in PATH. */
  private commandExists(cmd: string): boolean {
    try {
      execSync(
        process.platform === 'win32'
          ? `where ${cmd}`
          : `command -v ${cmd}`,
        { stdio: 'pipe', timeout: 5_000 },
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Translate English text to a target Indian language using Sarvam Translate API.
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

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const requestPayload = {
          input: text,
          source_language_code: sourceLanguage,
          target_language_code: targetLanguage,
          model: 'sarvam-translate:v1',
        };
        this.logger.debug(`Sarvam translate request: ${JSON.stringify(requestPayload)}`);
        const response = await axios.post(
          this.translateUrl,
          requestPayload,
          {
            headers: {
              'api-subscription-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 30_000,
          },
        );

        this.logger.debug(`Sarvam translate response (${response.status}): ${JSON.stringify(response.data).slice(0, 300)}`);
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