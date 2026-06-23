/**
 * GemmaService — calls an OpenAI-compatible LLM API for crop & domain inference.
 *
 * Compatible providers: Groq, Together AI, Cerebras, or any OpenAI-compatible endpoint.
 * Set OPENAI_BASE_URL and OPENAI_API_KEY in .env to enable.
 *
 * Crop and domain inference are separate LLM calls with independent retry + fallback.
 * If the LLM is disabled or a call fails, crop falls back to "Unknown" and domains
 * fall back to the keyword-based inferDomains() from ../question/constants/domains.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { inferDomains, DOMAINS } from '../question/constants/domains';
import { CROPS } from '../question/constants/crops';
import { GemmaInferenceResult } from './dto/infer-crop-domain.dto';

const RETRY_DELAY_MS = 500;
const MAX_RETRIES = 2;

// ─── Crop inference prompt ─────────────────────────────────────────────────────

const CROP_SYSTEM_PROMPT = `You are an agricultural AI assistant. Respond with ONLY valid JSON — no markdown, no explanation.

{
  "crop": "CropName or Unknown",
  "confidence": 0.0-1.0
}

Available crops: ${CROPS.join(', ')}.

Identify the crop mentioned in the farmer's question from the list above, or "Unknown" if none is identifiable. confidence is your certainty.`;

// ─── Domain inference prompt ───────────────────────────────────────────────────

const DOMAIN_SYSTEM_PROMPT = `You are an agricultural AI assistant. Respond with ONLY valid JSON — no markdown, no explanation.

{
  "domains": ["Domain1", "Domain2"],
  "confidence": 0.0-1.0
}

Available domains: ${DOMAINS.join(', ')}.

Rules:
- domains must be 1-3 values from the domains list
- confidence is your certainty (0.0 = no confidence, 1.0 = certain)
- Respond with ONLY the JSON object, no surrounding text`;

const USER_PROMPT = (question: string) => `Question: "${question}"`;

@Injectable()
export class GemmaService {
  private readonly logger = new Logger(GemmaService.name);

  constructor(private readonly configService: ConfigService) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async inferCropAndDomains(questionText: string): Promise<GemmaInferenceResult> {
    if (!this.isEnabled()) {
      return this.fallback(questionText);
    }

    const [cropResult, domainResult] = await Promise.all([
      this.inferCropWithRetry(questionText),
      this.inferDomainsWithRetry(questionText),
    ]);

    return {
      crop: cropResult.crop,
      domains: domainResult.domains,
      confidence: cropResult.confidence,
    };
  }

  // ─── Crop inference with retry ───────────────────────────────────────────────

  private async inferCropWithRetry(questionText: string): Promise<{
    crop: string;
    confidence: number;
  }> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.inferCrop(questionText);
      } catch (err) {
        this.logger.warn(
          `[Crop] attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (attempt < MAX_RETRIES) await this.delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    this.logger.warn('[Crop] exhausted retries — returning Unknown');
    return { crop: 'Unknown', confidence: 0.0 };
  }

  private async inferCrop(questionText: string): Promise<{ crop: string; confidence: number }> {
    const client = this.getClient();
    const model = this.configService.get<string>('llm.model', 'meta-llama/llama-4-maverick');

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: CROP_SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(questionText) },
      ],
      temperature: 0.2,
      max_tokens: 64,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    let parsed: { crop?: unknown; confidence?: unknown };
    try {
      const jsonStr = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`Non-JSON: ${raw.slice(0, 80)}`);
    }

    const crop = this.normaliseCrop(parsed.crop as string);
    const confidence = this.clipConfidence(parsed.confidence);
    return { crop, confidence };
  }

  // ─── Domain inference with retry ─────────────────────────────────────────────

  private async inferDomainsWithRetry(questionText: string): Promise<{
    domains: string[];
    confidence: number;
  }> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.inferDomains(questionText);
      } catch (err) {
        this.logger.warn(
          `[Domains] attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (attempt < MAX_RETRIES) await this.delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    this.logger.warn('[Domains] exhausted retries — using keyword fallback');
    const domains = inferDomains(questionText);
    return { domains, confidence: 0.0 };
  }

  private async inferDomains(questionText: string): Promise<{
    domains: string[];
    confidence: number;
  }> {
    const client = this.getClient();
    const model = this.configService.get<string>('llm.model', 'meta-llama/llama-4-maverick');

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: DOMAIN_SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(questionText) },
      ],
      temperature: 0.2,
      max_tokens: 128,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    let parsed: { domains?: unknown; confidence?: unknown };
    try {
      const jsonStr = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`Non-JSON: ${raw.slice(0, 80)}`);
    }

    const domains = this.normaliseDomains(parsed.domains);
    const confidence = this.clipConfidence(parsed.confidence);
    return { domains, confidence };
  }

  // ─── Normalisation helpers ───────────────────────────────────────────────────

  private normaliseCrop(raw: string): string {
    const lc = raw?.toLowerCase().trim();
    const match = [...CROPS].find((c) => c.toLowerCase() === lc);
    return match ?? 'Unknown';
  }

  private normaliseDomains(raw: unknown): string[] {
    const validLc = new Map(DOMAINS.map((d) => [d.toLowerCase(), d]));
    const matched: string[] = [];

    if (!Array.isArray(raw)) return inferDomains('');

    for (const item of raw as unknown[]) {
      const canon = validLc.get(String(item).toLowerCase().trim());
      if (canon && !matched.includes(canon)) {
        matched.push(canon);
        if (matched.length >= 3) break;
      }
    }

    return matched.length > 0 ? matched : ['Others'];
  }

  private clipConfidence(val: unknown): number {
    const f = parseFloat(String(val));
    if (isNaN(f)) return 0.0;
    return Math.max(0.0, Math.min(1.0, f));
  }

  // ─── Fallback (LLM disabled) ────────────────────────────────────────────────

  private fallback(questionText: string): GemmaInferenceResult {
    const domains = inferDomains(questionText);
    return { crop: 'Unknown', domains, confidence: 0.0 };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private isEnabled(): boolean {
    const url = this.configService.get<string>('llm.baseUrl')?.trim();
    const apiKey = this.configService.get<string>('llm.apiKey')?.trim();
    return url !== '' && apiKey !== undefined && apiKey !== '';
  }

  private getClient(): OpenAI {
    const baseURL = this.configService.get<string>('llm.baseUrl')!.trim();
    const apiKey = this.configService.get<string>('llm.apiKey')!.trim();
    return new OpenAI({ baseURL, apiKey });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}