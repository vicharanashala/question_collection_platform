import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GemmaService } from '../../../src/modules/ai/gemma.service';
import { GdbService } from '../../../src/modules/ai/gdb.service';
import { EmbedService } from '../../../src/modules/ai/embed.service';
import { MediaType, QuestionStatus, Season } from '../../../src/shared/classes/enums';
import { REPOSITORY_TOKENS, IQuestionRepository, IAdminConfigRepository } from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('AI Pipeline (e2e)', () => {
  let app: INestApplication;
  let questionRepo: IQuestionRepository;
  let gemmaService: GemmaService;
  let gdbService: GdbService;
  let embedService: EmbedService;
  let farmerToken: string;
  let adminToken: string;

  const basePayload = {
    language: 'mr',
    domains: ['Insect - Pest Management'],
    season: Season.KHARIF,
    cropType: 'Soybean',
    state: 'Maharashtra',
    district: 'Pune',
    mediaType: MediaType.NONE,
  };

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    gemmaService = testApp.gemmaService;
    gdbService = testApp.gdbService;
    embedService = testApp.embedService;
    questionRepo = app.get<IQuestionRepository>(REPOSITORY_TOKENS.Question);

    await seedTestUsers(app);
    farmerToken = await getAuthToken(app, '9000000001');
    adminToken = await getAuthToken(app, '9000000005');
  });

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gemmaService.inferCropAndDomains).mockResolvedValue({
      crop: 'soybean',
      domains: ['Insect - Pest Management'],
      confidence: 0.95,
    });
    vi.mocked(gdbService.checkDuplicate).mockResolvedValue({
      isDuplicate: false,
      matchedQuestionId: null,
      matchedQuestion: null,
      matchedAnswer: null,
      similarityScore: null,
      rawResponse: null,
    });
    vi.mocked(embedService.embed).mockResolvedValue([0.1, 0.2, 0.3]);
  });

  // ── Test 1: Preview shows Gemma-inferred crop and domains ─────────────────────

  it('Preview - Gemma "Unknown" crop is reflected in the preview response', async () => {
    vi.mocked(gemmaService.inferCropAndDomains).mockResolvedValueOnce({
      crop: 'Unknown',
      domains: ['Others'],
      confidence: 0.4,
    });

    const response = await request(app.getHttpServer())
      .post('/questions/preview')
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'Some ambiguous question with no identifiable crop?' })
      .expect(200);

    expect(response.body.cropType).toBe('Unknown');
    expect(response.body.domains).toEqual(['Others']);
  });

  // ── Test 2: Confidence exactly at 0.9 → PENDING (boundary) ───────────────────

  it('Submit - confidence exactly 0.9 → status PENDING (not HUMAN_REVIEW)', async () => {
    vi.mocked(gemmaService.inferCropAndDomains).mockResolvedValueOnce({
      crop: 'soybean',
      domains: ['Insect - Pest Management'],
      confidence: 0.9,
    });

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...basePayload, questionText: 'Boundary confidence soybean aphid question at exactly 0.9?' })
      .expect(201);

    expect(response.body.status).toBe(QuestionStatus.PENDING);
  });

  // ── Test 3: Confidence below the old AI/human-review boundary → still PENDING ─
  // `develop` removed the AI_REVIEW/HUMAN_REVIEW confidence-branching entirely
  // (QuestionStatus no longer even has those members — see question.service.ts:311-312,
  // "All new submissions go to PENDING for curator review"). Low Gemma confidence no
  // longer routes anywhere special; every new submission is PENDING regardless.

  it('Submit - confidence 0.899 (below old AI/human-review boundary) → still status PENDING', async () => {
    vi.mocked(gemmaService.inferCropAndDomains).mockResolvedValueOnce({
      crop: 'soybean',
      domains: ['Insect - Pest Management'],
      confidence: 0.899,
    });

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...basePayload, questionText: 'Soybean leaf yellowing cause and treatment?' })
      .expect(201);

    expect(response.body.status).toBe(QuestionStatus.PENDING);
  });

  // ── Test 4: GDB similarity below threshold → saves as PENDING ────────────────

  it('Submit - GDB similarity below threshold → question saves as PENDING', async () => {
    vi.mocked(gdbService.checkDuplicate).mockResolvedValueOnce({
      isDuplicate: false,
      matchedQuestionId: null,
      matchedQuestion: 'Distantly related existing question',
      matchedAnswer: null,
      similarityScore: 0.5,
      rawResponse: null,
    });

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...basePayload, questionText: 'When should I irrigate soybean during pod fill stage?' })
      .expect(201);

    expect(response.body.status).toBe(QuestionStatus.PENDING);
    const saved = await questionRepo.findById(response.body.id);
    expect(saved).not.toBeNull();
    expect(saved!.duplicateFlag).toBe(false);
  });

  // ── Test 5: GDB detects duplicate → DUPLICATE status with full match details ──

  it('Submit - GDB detects duplicate → returns DUPLICATE status with matched Q&A', async () => {
    vi.mocked(gdbService.checkDuplicate).mockResolvedValueOnce({
      isDuplicate: true,
      matchedQuestionId: null,
      matchedQuestion: 'How do I control aphids on soybean?',
      matchedAnswer: 'Apply neem-based organic pesticide in the morning.',
      similarityScore: 0.95,
      rawResponse: null,
    });

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...basePayload, questionText: 'What is the best way to manage aphid infestation on soybean?' })
      .expect(201);

    expect(response.body.status).toBe('DUPLICATE');
    expect(response.body.duplicate.isDuplicate).toBe(true);
    expect(response.body.duplicate.matchedQuestion).toBe('How do I control aphids on soybean?');
    expect(response.body.duplicate.matchedAnswer).toBe('Apply neem-based organic pesticide in the morning.');
    expect(response.body.duplicate.similarityScore).toBe(0.95);

    // GDB-detected duplicates ARE persisted as a real REJECTED question row (same design as
    // the exact-DB-duplicate path) — they count against the daily limit, unlike the old
    // assumption that DUPLICATE responses returned no id at all.
    expect(response.body.id).toBeTruthy();
    const saved = await questionRepo.findById(response.body.id);
    expect(saved).not.toBeNull();
    expect(saved!.status).toBe(QuestionStatus.REJECTED);
  });

  // ── Test 6: Embedding returns null → question still saves ─────────────────────

  it('Submit - embedding service returns null → question still saves', async () => {
    vi.mocked(embedService.embed).mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...basePayload, questionText: 'What fertilizer dose is safe for soybean at jointing stage?' })
      .expect(201);

    expect(response.body.id).toBeDefined();
    const saved = await questionRepo.findById(response.body.id);
    expect(saved).not.toBeNull();
    expect(saved!.embedding).toBeNull();
  });

  // ── Test 7: Multiple user-provided domains → all stored on question ───────────

  it('Submit - multiple domains in payload → all stored on the question record', async () => {
    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...basePayload,
        domains: ['Insect - Pest Management', 'Disease Management'],
        questionText: 'My soybean has both aphids and yellow mosaic disease — how do I treat both?',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    const saved = await questionRepo.findById(response.body.id);
    expect(saved).not.toBeNull();
    expect(saved!.domains).toContain('Insect - Pest Management');
    expect(saved!.domains).toContain('Disease Management');
    expect(saved!.domains).toHaveLength(2);
  });

  // ── Test 8: Admin config threshold update → persists in database ──────────────
  //
  // Real bug, not fixed here (documented in AIPipeline.e2e.md / test_plan.md): AdminService
  // .listConfig() calls `this.configRepo.find({ order: { key: 'ASC' } })` — a TypeORM-style
  // call with no `where` wrapper. The Mongo repository abstraction's find(filter) treats its
  // whole argument as a literal filter (no `order`/`take`/`select` support), so it searches
  // for documents with a field literally named `order`, which none have — GET /admin/config
  // unconditionally returns `{ items: [] }` in Mongo mode. PATCH /admin/config itself (via
  // updateConfig()) persists correctly — it's only the list-back path that's broken — so this
  // test verifies persistence directly via the config repository instead of round-tripping
  // through the broken GET endpoint.

  it('Admin config - duplicate_similarity_threshold update persists', async () => {
    await request(app.getHttpServer())
      .patch('/admin/config')
      .set(getAuthHeaders(adminToken))
      .send({ key: 'duplicate_similarity_threshold', value: 0.99 })
      .expect(200);

    const configRepo = app.get<IAdminConfigRepository>(REPOSITORY_TOKENS.AdminConfig);
    const thresholdEntry = await configRepo.findByKey('duplicate_similarity_threshold');
    expect(thresholdEntry?.value).toBe(0.99);

    // Restore
    await request(app.getHttpServer())
      .patch('/admin/config')
      .set(getAuthHeaders(adminToken))
      .send({ key: 'duplicate_similarity_threshold', value: 0.9 })
      .expect(200);
  });

  // ── Test 9: Preview duplicate flag reflected when GDB finds a match ───────────

  it('Preview - GDB duplicate result is returned in the preview response', async () => {
    vi.mocked(gdbService.checkDuplicate).mockResolvedValueOnce({
      isDuplicate: true,
      matchedQuestionId: null,
      matchedQuestion: 'How to control stem borer in soybean?',
      matchedAnswer: 'Use chlorpyrifos 20 EC at 2 ml/litre water.',
      similarityScore: 0.97,
      rawResponse: null,
    });

    const response = await request(app.getHttpServer())
      .post('/questions/preview')
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'What insecticide kills stem borer in soybean crops?' })
      .expect(200);

    expect(response.body.duplicate.isDuplicate).toBe(true);
    expect(response.body.duplicate.matchedQuestion).toBe('How to control stem borer in soybean?');
    expect(response.body.duplicate.similarityScore).toBe(0.97);
  });

  // ── Test 10: Gemma domains are used when dto.domains not provided (submit fallback not reachable via API)
  //            → preview endpoint returns Gemma-inferred domains

  it('Preview - multiple Gemma-inferred domains appear in the preview response', async () => {
    vi.mocked(gemmaService.inferCropAndDomains).mockResolvedValueOnce({
      crop: 'soybean',
      domains: ['Insect - Pest Management', 'Disease Management'],
      confidence: 0.92,
    });

    const response = await request(app.getHttpServer())
      .post('/questions/preview')
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'My soybean crop has aphids and also shows signs of rust disease?' })
      .expect(200);

    expect(response.body.domains).toContain('Insect - Pest Management');
    expect(response.body.domains).toContain('Disease Management');
  });
});
