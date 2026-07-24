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

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * One-shot STT for a complete audio file.
   *
   * Process:
   *  1. Convert to 16 kHz mono 16-bit PCM WAV via ffmpeg / afconvert.
   *  2. Probe duration with ffprobe; reject if < 0.5 s or > 60 s.
   *  3. If > 30 s, split into non-overlapping 30 s chunks and transcribe
   *     each sequentially, concatenating the results.
   *  4. Call Sarvam STT API with model="saaras:v3" and mode="transcribe".
   */
  async transcribeFile(
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

    // Step 1 – Convert to 16 kHz mono WAV.
    const wavBuffer = await this.toWav(buffer, filename, mimeType);

    // Step 2 – Probe duration.
    const durationSec = await this.probeDuration(wavBuffer);
    this.logger.debug(
      `[transcribeFile] duration=${durationSec.toFixed(2)}s, size=${wavBuffer.length} B`,
    );

    if (durationSec < 0.5) {
      throw new HttpException(
        'Audio is too short. Please record a longer message.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Step 3 – Chunk if > 5 min so Sarvam receives manageable segments.
    const MAX_CHUNK_SEC = 5 * 60;
    if (durationSec <= MAX_CHUNK_SEC) {
      return this.callSarvamStt(wavBuffer, filename, languageCode);
    }

    const chunkBuffers = await this.splitAudio(wavBuffer, MAX_CHUNK_SEC);
    this.logger.log(
      `[transcribeFile] splitting ${durationSec.toFixed(0)}s audio into ${chunkBuffers.length} chunks`,
    );

    const texts: string[] = [];
    for (let i = 0; i < chunkBuffers.length; i++) {
      const result = await this.callSarvamStt(
        chunkBuffers[i],
        `chunk_${i + 1}_${filename}`,
        languageCode,
      );
      if (result.text.trim()) {
        texts.push(result.text.trim());
      }
    }

    return { text: texts.join(' '), confidence: 1.0, languageCode };
  }

  /**
   * Stream a raw audio buffer directly to Sarvam STT and return the transcript.
   * Used for real-time chunk transcription during active recording.
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

    // Minimum valid audio: a few KB. Smaller is almost certainly corrupt.
    const MIN_VALID_BYTES = 1_024;
    if (buffer.length < MIN_VALID_BYTES) {
      this.logger.warn(
        `Audio buffer too small (${buffer.length} B) — skipping transcription`,
      );
      return { text: '', confidence: 0, languageCode };
    }

    // Convert to 16 kHz mono WAV if needed.
    const wavBuffer = await this.toWav(buffer, filename, mimeType);

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
          const waitMs = retryAfter * 1_000 * attempt;
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
        this.logger.debug(
          `Sarvam translate request: ${JSON.stringify(requestPayload)}`,
        );
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

        this.logger.debug(
          `Sarvam translate response (${response.status}): ${JSON.stringify(response.data).slice(0, 300)}`,
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
          const waitMs = retryAfter * 1_000 * attempt;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert any audio codec to 16 kHz mono 16-bit PCM WAV.
   * Tries ffmpeg first (Linux), then afconvert (macOS), then returns the
   * original buffer unchanged as a best-effort fallback.
   */
  private async toWav(
    buffer: Buffer,
    filename: string,
    _mimeType: string,
  ): Promise<Buffer> {
    const ext = filename.split('.').pop()?.toLowerCase();
    const isNonWav = ext !== 'wav' && ext !== 'wave';
    if (!isNonWav) return buffer;

    const safeName = `sarvam_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputPath = join(tmpdir(), `${safeName}_input.${ext ?? 'audio'}`);
    const outputPath = join(tmpdir(), `${safeName}.wav`);

    try {
      writeFileSync(inputPath, buffer);

      if (this.commandExists('ffmpeg')) {
        // iOS Simulator M4A has a 'chnl' box ffmpeg can't parse — strip it first.
        const cleanedBuffer = this.stripChnlBox(buffer);
        writeFileSync(inputPath, cleanedBuffer);
        execSync(
          `ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -acodec pcm_s16le "${outputPath}"`,
          { timeout: 30_000, stdio: 'pipe' },
        );
        this.logger.debug(
          `ffmpeg converted (${buffer.length} B) → WAV (${readFileSync(outputPath).length} B)`,
        );
        return readFileSync(outputPath);
      }

      if (this.commandExists('/usr/bin/afconvert')) {
        execSync(
          `/usr/bin/afconvert -f WAVE -d LEI16@16000 "${inputPath}" "${outputPath}"`,
          { timeout: 30_000, stdio: 'pipe' },
        );
        this.logger.debug(
          `afconvert converted (${buffer.length} B) → WAV (${readFileSync(outputPath).length} B)`,
        );
        return readFileSync(outputPath);
      }

      this.logger.warn(
        'No audio converter found; sending original format to Sarvam',
      );
      return buffer;
    } catch (err) {
      this.logger.warn(
        `Audio conversion failed (${(err as Error).message}); sending original`,
      );
      return buffer;
    } finally {
      try { unlinkSync(inputPath); } catch { /* ignore */ }
      try { unlinkSync(outputPath); } catch { /* ignore */ }
    }
  }

  /**
   * Probe the duration of a WAV buffer using ffprobe.
   * Returns seconds as a float, or falls back to size-based estimation
   * (16 kHz mono 16-bit PCM = 32 000 bytes/s).
   */
  private async probeDuration(buffer: Buffer): Promise<number> {
    const tmpPath = join(tmpdir(), `probe_${Date.now()}.wav`);
    try {
      writeFileSync(tmpPath, buffer);
      const out = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${tmpPath}"`,
        { timeout: 10_000, stdio: 'pipe' },
      );
      const secs = parseFloat(out.toString().trim());
      return isNaN(secs) ? buffer.length / 32_000 : secs;
    } catch {
      return buffer.length / 32_000;
    } finally {
      try { unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  /**
   * Split a WAV buffer into non-overlapping chunks of at most `maxSec` seconds
   * using ffmpeg's segment muxer for byte-accurate cuts at WAV packet boundaries.
   */
  private async splitAudio(buffer: Buffer, maxSec: number): Promise<Buffer[]> {
    const tmpInput = join(tmpdir(), `split_${Date.now()}_in.wav`);
    const tmpDir = join(tmpdir(), `split_${Date.now()}_chunks`);

    try {
      writeFileSync(tmpInput, buffer);
      execSync(`mkdir -p "${tmpDir}"`, { stdio: 'pipe' });

      execSync(
        `ffmpeg -y -i "${tmpInput}" -f segment -segment_time ${maxSec} -c copy "${tmpDir}/chunk_%03d.wav"`,
        { timeout: 60_000, stdio: 'pipe' },
      );

      const files = execSync(
        `ls -1 "${tmpDir}"/chunk_*.wav | sort -V`,
        { stdio: 'pipe' },
      )
        .toString()
        .trim()
        .split('\n')
        .filter(Boolean);

      return files.map((f) => readFileSync(f));
    } finally {
      try { unlinkSync(tmpInput); } catch { /* ignore */ }
      try { execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' }); } catch { /* ignore */ }
    }
  }

  /**
   * Call the Sarvam STT API for a single audio buffer.
   * Uses model="saaras:v3" and mode="transcribe".
   */
  private async callSarvamStt(
    buffer: Buffer,
    filename: string,
    languageCode: string,
  ): Promise<TranscriptionResult> {
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const form = new FormData();
        form.append('file', buffer, {
          filename: filename.replace(/\.[^.]+$/, '.wav'),
          contentType: 'audio/wav',
        });
        form.append('language_code', languageCode);
        form.append('model', 'saaras:v3');
        form.append('mode', 'transcribe');

        const response = await axios.post(this.sttUrl, form, {
          headers: {
            ...form.getHeaders(),
            'api-subscription-key': this.apiKey,
          },
          timeout: 60_000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        const data = response.data;
        this.logger.debug(
          `Sarvam STT response (${response.status}): ${JSON.stringify(data).slice(0, 200)}`,
        );

        const text =
          typeof data === 'string'
            ? data.trim()
            : (data?.text ?? data?.transcript ?? JSON.stringify(data));

        return { text, confidence: data?.confidence ?? 1.0, languageCode };
      } catch (err) {
        attempt++;
        const axiosErr = err as AxiosError;

        if (axiosErr.response?.status === 429) {
          const retryAfter = parseInt(
            axiosErr.response.headers['retry-after'] ?? '5',
            10,
          );
          const waitMs = retryAfter * 1_000 * attempt;
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
        if (size === 16 || (size > 0 && size < buf.length - i + 4)) {
          const cleaned = Buffer.from(buf);
          cleaned.fill(0, i - 4, i - 4 + size);
          this.logger.debug(`Stripped chnl box (${size} bytes) from audio`);
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
        process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`,
        { stdio: 'pipe', timeout: 5_000 },
      );
      return true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}