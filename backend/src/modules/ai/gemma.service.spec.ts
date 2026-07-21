import { ConfigService } from '@nestjs/config';

// ─── Mock openai module BEFORE importing GemmaService ───────────────────────

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

// ─── Import after mock is established ───────────────────────────────────────

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
    id: 'crop-test',
    model: 'llama-4',
    choices: [
      {
        message: { role: 'assistant', refusal: null, content: JSON.stringify({ crop, confidence }) },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

function domainCompletion(domains: string[], confidence: number) {
  return {
    id: 'domain-test',
    model: 'llama-4',
    choices: [
      {
        message: { role: 'assistant', refusal: null, content: JSON.stringify({ domains, confidence }) },
        finish_reason: 'stop',
        index: 0,
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GemmaService', () => {
  afterEach(() => {
    mockCreate.mockReset();
    jest.restoreAllMocks();
  });

  // ─── Disabled ──────────────────────────────────────────────────────────────

  describe('when LLM is disabled', () => {
    it('returns keyword fallback without calling the LLM', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains(
        'My rice leaves have yellow spots and rust',
      );

      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.crop).toBe('Unknown');
      expect(result.domains).toContain('Disease Management');
      expect(result.confidence).toBe(0.0);
    });
  });

  // ─── Crop inference ────────────────────────────────────────────────────────

  describe('crop inference', () => {
    it('returns crop and confidence from LLM', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Rice', 0.92))
        .mockResolvedValueOnce(domainCompletion(['Nutrient Management'], 0.9));

      const result = await service.inferCropAndDomains('Rice nitrogen deficiency');

      expect(result.crop).toBe('Rice');
      expect(result.confidence).toBe(0.92);
    });

    it('normalises an unknown crop to Unknown', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Kangkong', 0.75))
        .mockResolvedValueOnce(domainCompletion(['Weed Management'], 0.8));

      const result = await service.inferCropAndDomains('Weed in kangkong field');

      expect(result.crop).toBe('Unknown');
    });

    it('normalises crop case-insensitively', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('WHEAT', 0.9))
        .mockResolvedValueOnce(domainCompletion(['Nutrient Management'], 0.9));

      const result = await service.inferCropAndDomains('Wheat NPK ratio');

      expect(result.crop).toBe('Wheat');
    });

    it('clamps crop confidence > 1.0 to 1.0', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Cotton', 1.5))
        .mockResolvedValueOnce(domainCompletion(['Insect–Pest Management'], 0.9));

      const result = await service.inferCropAndDomains('Cotton pest attack');

      expect(result.confidence).toBe(1.0);
    });

    it('clamps negative crop confidence to 0.0', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Sugarcane', -0.3))
        .mockResolvedValueOnce(domainCompletion(['Weed Management'], 0.9));

      const result = await service.inferCropAndDomains('Sugarcane weed question');

      expect(result.confidence).toBe(0.0);
    });

    it('returns Unknown when crop call throws (after retries)', async () => {
      const service = new GemmaService(cfg());
      mockCreate.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.inferCropAndDomains('Any question');

      expect(mockCreate).toHaveBeenCalledTimes(6); // 3 crop retries + 3 domain retries
      expect(result.crop).toBe('Unknown');
      expect(result.confidence).toBe(0.0);
    });

    it('strips markdown code fences from crop response', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                refusal: null,
                content: '```json\n{"crop":"Rice","confidence":0.91}\n```',
              },
              finish_reason: 'stop',
              index: 0,
            },
          ],
        })
        .mockResolvedValueOnce(domainCompletion(['Nutrient Management'], 0.9));

      const result = await service.inferCropAndDomains('Rice nitrogen deficiency');

      expect(result.crop).toBe('Rice');
      expect(result.confidence).toBe(0.91);
    });
  });

  // ─── Domain inference ──────────────────────────────────────────────────────

  describe('domain inference', () => {
    it('returns domains from LLM up to max 3', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Wheat', 0.88))
        .mockResolvedValueOnce(
          domainCompletion(
            [
              'Nutrient Management',
              'Insect–Pest Management',
              'Water Management',
              'Fake Domain',
              'Weed Management',
            ],
            0.88,
          ),
        );

      const result = await service.inferCropAndDomains(
        'Wheat field pest and water issue',
      );

      expect(result.domains).toHaveLength(3);
      expect(result.domains).not.toContain('Fake Domain');
    });

    it('returns [Others] when all returned domains are invalid', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Maize', 0.5))
        .mockResolvedValueOnce(domainCompletion(['Not a Real Domain', 'Also Not Real'], 0.5));

      const result = await service.inferCropAndDomains('Random farm question');

      expect(result.domains).toEqual(['Others']);
    });

    it('falls back to keyword inference when domain call throws', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Tomato', 0.9))
        .mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.inferCropAndDomains(
        'Pest attack on my tomato plants',
      );

      expect(result.domains).toContain('Insect–Pest Management');
    });

    it('falls back to keyword inference on HTTP 429', async () => {
      const service = new GemmaService(cfg());
      const err = Object.assign(new Error('Rate limited'), { response: { status: 429 } });
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Rice', 0.9))
        .mockRejectedValue(err);

      const result = await service.inferCropAndDomains('Rice irrigation question');

      expect(result.domains).toContain('Water Management');
    });

    it('strips markdown code fences from domain response', async () => {
      const service = new GemmaService(cfg());
      mockCreate
        .mockResolvedValueOnce(cropCompletion('Rice', 0.9))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                refusal: null,
                content: '```json\n{"domains":["Nutrient Management"],"confidence":0.88}\n```',
              },
              finish_reason: 'stop',
              index: 0,
            },
          ],
        });

      const result = await service.inferCropAndDomains('Rice nutrient question');

      expect(result.domains).toEqual(['Nutrient Management']);
    });
  });

  // ─── Keyword fallback (LLM disabled) ───────────────────────────────────────

  describe('keyword fallback (LLM disabled)', () => {
    it('infers Nutrient Management from fertilizer keywords', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains(
        'Which NPK ratio is best for rabi wheat?',
      );
      expect(result.domains).toContain('Nutrient Management');
    });

    it('infers Disease Management from disease keywords', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains(
        'My potato plants got late blight',
      );
      expect(result.domains).toContain('Disease Management');
    });

    it('returns [Others] when no domain keywords match', async () => {
      const service = new GemmaService(cfg({ 'llm.baseUrl': '' }));
      const result = await service.inferCropAndDomains(
        'Tell me a story about farming',
      );
      expect(result.domains).toEqual(['Others']);
    });
  });
});