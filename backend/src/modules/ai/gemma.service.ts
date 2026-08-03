/**
 * GemmaService — calls an OpenAI-compatible LLM API for crop & domain inference.
 *
 * Compatible providers: Groq, Together AI, Cerebras, or any OpenAI-compatible endpoint.
 * Set OPENAI_BASE_URL and OPENAI_API_KEY in .env to enable.
 *
 * Crop and domain inference are separate LLM calls with independent retry + fallback.
 * If the LLM is disabled or a call fails, crop falls back to "Unknown" and domains
 * fall back to the keyword-based inferDomains() from ../question/constants/domains.
 *
 * Proxy support: when PROXY is set, requests to VM_SERVER_URL are routed through it
 * via the standard axios `proxy` config object (no extra agent libraries needed for
 * axios itself; https-proxy-agent is used only for the Node.js fetch path in
 * GdbService / EmbedService).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { inferDomains, DOMAINS } from '../question/constants/domains';
import { CROPS } from '../question/constants/crops';
import { GemmaInferenceResult } from './dto/infer-crop-domain.dto';
import { VmProxyService } from '../../shared/services/vm-proxy';

const RETRY_DELAY_MS = 500;
const MAX_RETRIES = 2;

// ─── Crop inference prompt ─────────────────────────────────────────────────────

const CROP_SYSTEM_PROMPT = `You are an expert agricultural classifier. Your only job is to identify which crop (if any) a farmer is asking about.

Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation.

Schema:
{
  "crop": string,       // One value from the crop list below, or "Unknown"
  "confidence": number  // Float between 0.0 (no idea) and 1.0 (certain)
}

Crop list:
${CROPS.map((c) => `- ${c}`).join("\n")}

Rules:
- "crop" must be an exact match from the list above, or "Unknown"
- Use "Unknown" if no crop is mentioned or identifiable
- "confidence" reflects how certain you are of the match
- Partial mentions, local names, and regional synonyms should still resolve to the correct crop if identifiable
- Do NOT infer a crop from context alone (e.g. "paddy field" → Rice is fine, but "watering plants" → Unknown)`;

const DOMAIN_SYSTEM_PROMPT = `You are an expert agricultural classifier. Your only job is to identify which agricultural domain(s) a farmer's question belongs to.

Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation.

Schema:
{
  "domains": string[],  // 1–3 values from the domain list below
  "confidence": number  // Float between 0.0 (no idea) and 1.0 (certain)
}

Domain list:
${DOMAINS.map((d) => `- ${d}`).join("\n")}

Rules:
- "domains" must contain between 1 and 3 values, each an exact match from the list above
- Order by relevance — most relevant domain first
- "confidence" reflects your certainty across all selected domains
- If the question spans multiple domains, include all that clearly apply (up to 3)
- Do NOT include a domain unless it is clearly and directly relevant to the question`;
const USER_PROMPT = (question: string) => `Question: "${question}"`;

// ─── Chat completions request shape ───────────────────────────────────────────

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

interface ChatCompletionResponse {
  choices: { message: { content: string } }[];
}

@Injectable()
export class GemmaService {
  private readonly logger = new Logger(GemmaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly vmProxy: VmProxyService,
  ) {}

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
    this.logger.warn('[Gemma/Crop] exhausted retries — returning Unknown');
    return { crop: 'Unknown', confidence: 0.0 };
  }

  private async inferCrop(questionText: string): Promise<{ crop: string; confidence: number }> {
    const model = this.configService.get<string>('llm.model', 'meta-llama/llama-4-maverick');

    const raw = await this.chatCompletion({
      model,
      messages: [
        { role: 'system', content: CROP_SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(questionText) },
      ],
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = this.tryParseJson(raw, ['crop', 'confidence']);
    } catch {
      throw new Error(`Non-JSON: ${raw.slice(0, 120)}`);
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
    this.logger.warn('[Gemma/Domains] exhausted retries — using keyword fallback');
    const domains = inferDomains(questionText);
    return { domains, confidence: 0.0 };
  }

  private async inferDomains(questionText: string): Promise<{
    domains: string[];
    confidence: number;
  }> {
    const model = this.configService.get<string>('llm.model', 'meta-llama/llama-4-maverick');

    const raw = await this.chatCompletion({
      model,
      messages: [
        { role: 'system', content: DOMAIN_SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT(questionText) },
      ],
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = this.tryParseJson(raw, ['domains', 'confidence']);
    } catch {
      throw new Error(`Non-JSON: ${raw.slice(0, 120)}`);
    }

    const domains = this.normaliseDomains(parsed.domains);
    const confidence = this.clipConfidence(parsed.confidence);
    return { domains, confidence };
  }

  // ─── Shared chat completion call ─────────────────────────────────────────────

  /**
   * Makes a chat completions POST to the LLM base URL.
   * When PROXY is set, injects the standard axios `proxy` config so the request
   * is routed through the configured forward proxy for VM_SERVER_URL destinations.
   */
  private async chatCompletion(request: ChatCompletionRequest): Promise<string> {
    const baseUrl = this.configService.get<string>('llm.baseUrl')!.trim();
    const apiKey = this.configService.get<string>('llm.apiKey')!.trim();
    const url = `${baseUrl}/chat/completions`;

    const proxyConfig = this.vmProxy.getProxyConfigForVmServer();

    const axiosOptions = proxyConfig
      ? { proxy: proxyConfig }
      : undefined;

    const body: ChatCompletionRequest = {
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' },
      ...request,
    };

    this.logger.debug(`[Gemma] POST ${url}`);

    try {
      const response = await axios.post<ChatCompletionResponse>(
        url,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 30_000,
          ...axiosOptions,
        },
      );

      return response.data.choices[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      const detail = axiosErr.response?.data?.error?.message ?? axiosErr.message;
      throw new Error(`chat completion failed: ${detail}`);
    }
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse JSON from the model response with two strategies:
   * 1. Direct JSON.parse after stripping markdown code fences
   * 2. Regex extraction of key fields from partial/truncated responses
   *
   * Returns a partial object so callers can check which fields exist.
   * Throws only if no fields could be recovered at all.
   */
  private tryParseJson(
    raw: string,
    fields: string[],
  ): Record<string, unknown> {
    // Strategy 1: clean markdown fences + JSON.parse
    const stripped = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      // Strategy 2: regex-extract known fields from partial output
      const extracted: Record<string, unknown> = {};
      for (const field of fields) {
        const re = new RegExp(`"${field}"\s*:\s*("[^"]*"|\[[^\]]*\]|\d+\.?\d*)`, 'i');
        const m = stripped.match(re);
        if (m) {
          try {
            extracted[field] = JSON.parse(m[1]);
          } catch {
            extracted[field] = m[1].replace(/^"|"$/g, '');
          }
        }
      }
      if (Object.keys(extracted).length > 0) {
        return extracted;
      }
      // Nothing recoverable — throw so retry kicks in
      throw new Error(`Non-JSON: ${raw.slice(0, 120)}`);
    }
  }
}