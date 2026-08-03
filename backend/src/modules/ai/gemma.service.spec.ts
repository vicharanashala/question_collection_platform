import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GemmaService } from './gemma.service';

// ─── Config helper ────────────────────────────────────────────────────────────

function cfg(values: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    'llm.baseUrl': 'https://api.groq.com/openai/v1',
    'llm.apiKey': 'test-key',
    'llm.model': 'meta-llama/llama-4-maverick',
  };
  const merged = { ...defaults, ...values };
  return {
    get: jest.fn((key: string, fallback?: unknown) => merged[key] ?? fallback),
  } as unknown as ConfigService;
}

// ─── Completion fixture helpers ──────────────────────────────────────────────

function cropCompletion(crop: string, confidence: number) {
  return {
    choices: [{ message: { content: JSON.stringify({ crop, confidence }) } }],
  };
}

function domainCompletion(domains: string[], confidence: number) {
  return {
    choices: [{ message: { content: JSON.stringify({ domains, confidence }) } }],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GemmaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Disabled ──────────────────────────────────────────────────────────────

  describe('when LLM is disabled', () => {
    it('returns keyword fallback without calling axios', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains(
        'My rice leaves have yellow spots and rust',
      );

      expect(result.crop).toBe('Unknown');
      expect(result.domains).toContain('Disease Management');
      expect(result.confidence).toBe(0.0);
    });
  });

  // ─── Crop inference ────────────────────────────────────────────────────────

  describe('crop inference', () => {
    it('returns crop and confidence from LLM', async () => {
      const spy = jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: cropCompletion('Rice', 0.92) });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Rice nitrogen deficiency');

      expect(result.crop).toBe('Rice');
      expect(result.confidence).toBe(0.92);
      spy.mockRestore();
    });

    it('normalises an unknown crop to Unknown', async () => {
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: cropCompletion('Kangkong', 0.75) });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Weed in kangkong field');

      expect(result.crop).toBe('Unknown');
    });

    it('normalises crop case-insensitively', async () => {
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: cropCompletion('WHEAT', 0.9) });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Wheat NPK ratio');

      expect(result.crop).toBe('Wheat');
    });

    it('clamps crop confidence > 1.0 to 1.0', async () => {
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: cropCompletion('Cotton', 1.5) });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Cotton pest attack');

      expect(result.confidence).toBe(1.0);
    });

    it('clamps negative crop confidence to 0.0', async () => {
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: cropCompletion('Sugarcane', -0.3) });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Sugarcane weed question');

      expect(result.confidence).toBe(0.0);
    });

    it('returns Unknown when crop call throws (after retries)', async () => {
      jest.spyOn(axios, 'post').mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Any question');

      // 1 initial + 2 retries = 3 calls for crop
      expect(result.crop).toBe('Unknown');
      expect(result.confidence).toBe(0.0);
    });

    it('strips markdown code fences from crop response', async () => {
      jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { choices: [{ message: { content: '```json\n{"crop":"Rice","confidence":0.91}\n```' } }] },
      });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Rice nitrogen deficiency');

      expect(result.crop).toBe('Rice');
      expect(result.confidence).toBe(0.91);
    });
  });

  // ─── Domain inference ──────────────────────────────────────────────────────

  describe('domain inference', () => {
    it('returns domains from LLM up to max 3', async () => {
      jest.spyOn(axios, 'post')
        .mockResolvedValueOnce({ data: cropCompletion('Wheat', 0.88) })
        .mockResolvedValueOnce({
          data: domainCompletion(
            ['Nutrient Management', 'Insect–Pest Management', 'Water Management', 'Fake Domain', 'Weed Management'],
            0.88,
          ),
        });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Wheat field pest and water issue');

      // Up to 3 valid domains, no 'Fake Domain'
      expect(result.domains.length).toBeLessThanOrEqual(3);
      expect(result.domains).not.toContain('Fake Domain');
    });

    it('returns [Others] when all returned domains are invalid and keyword fallback has no match', async () => {
      jest.spyOn(axios, 'post')
        .mockResolvedValueOnce({ data: cropCompletion('Maize', 0.5) })
        .mockResolvedValueOnce({ data: domainCompletion(['Not a Real Domain', 'Also Not Real'], 0.5) });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Random farm question');

      // Keyword fallback fires but 'Random farm question' matches no domain keywords
      expect(result.domains).toEqual(['Others']);
    });

    it('falls back to keyword inference when domain call throws', async () => {
      jest.spyOn(axios, 'post')
        .mockResolvedValueOnce({ data: cropCompletion('Tomato', 0.9) })
        .mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Pest attack on my tomato plants');

      // Keyword inference fires for domains — it infers at least one domain from tomato/pest
      expect(result.domains.length).toBeGreaterThan(0);
    });

    it('strips markdown code fences from domain response', async () => {
      jest.spyOn(axios, 'post')
        .mockResolvedValueOnce({ data: cropCompletion('Rice', 0.9) })
        .mockResolvedValueOnce({
          data: { choices: [{ message: { content: '```json\n{"domains":["Nutrient Management"],"confidence":0.88}\n```' } }] },
        });
      const service = new GemmaService(cfg());

      const result = await service.inferCropAndDomains('Rice nutrient question');

      // The LLM returns a domain; valid domain is normalised by normaliseDomains
      expect(result.domains.length).toBeGreaterThan(0);
    });
  });

  // ─── Keyword fallback (LLM disabled) ───────────────────────────────────────

  describe('keyword fallback (LLM disabled)', () => {
    it('infers domains from fertilizer keywords', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains('Which NPK ratio is best for rabi wheat?');

      expect(result.domains.length).toBeGreaterThan(0);
      expect(result.domains).not.toEqual(['Others']);
    });

    it('infers Disease Management from disease keywords', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains('My potato plants got late blight');

      expect(result.domains).toContain('Disease Management');
    });

    it('returns [Others] when no domain keywords match', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains('Tell me a story about farming');

      expect(result.domains).toEqual(['Others']);
    });
  });
});