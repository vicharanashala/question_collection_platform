import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GemmaService } from '../../../src/modules/ai/gemma.service';
import { GdbService } from '../../../src/modules/ai/gdb.service';
import { Question } from '../../../src/shared/database/entities';
import { MediaType, QuestionStatus, Season } from '../../../src/shared/classes/enums';
import { REPOSITORY_TOKENS, IUserRepository, IQuestionRepository } from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('Question Submit (e2e)', () => {
  let app: INestApplication;
  let userRepo: IUserRepository;
  let questionRepo: IQuestionRepository;
  let gemmaService: GemmaService;
  let gdbService: GdbService;
  let farmerToken: string;
  let studentToken: string;
  let adminToken: string;

  const validSubmitPayload = {
    language: 'mr',
    domains: ['Insect - Pest Management'],
    season: Season.KHARIF,
    cropType: 'Soybean',
    questionText: 'Soybean crop disease control question?',
    state: 'Maharashtra',
    district: 'Pune',
    mediaType: MediaType.NONE,
  };

  const previewPayload = {
    language: 'mr',
    domains: ['Insect - Pest Management'],
    season: Season.KHARIF,
    cropType: 'Soybean',
    questionText: 'Soybean crop disease control question?',
    mediaType: MediaType.NONE,
  };

  // Seeds a question directly into the DB, bypassing the API daily-limit check.
  // language deliberately omitted (defaults to 'en' on the schema) — see UserProfile.e2e.md
  // / test_plan.md for the real MongoDB text-index bug that setting it explicitly would trip.
  // editWindowClosesAt also omitted — that field was fully removed from the Question schema
  // when question editing was removed; it doesn't exist anymore.
  async function seedQuestion(userId: string, overrides: Partial<Question> = {}): Promise<Question> {
    const now = new Date();
    return questionRepo.create({
      userId,
      domains: ['Insect - Pest Management'],
      season: Season.KHARIF,
      cropType: 'Soybean',
      agroClimaticZone: 'eastern_plateau_and_hills',
      state: 'Maharashtra',
      district: 'Pune',
      block: null,
      questionText: `Seeded test question ${Date.now()}`,
      embedding: [0.1, 0.2, 0.3],
      mediaType: MediaType.NONE,
      mediaUrls: null,
      deviceInfo: null,
      status: QuestionStatus.PENDING,
      duplicateFlag: false,
      duplicateOfId: null,
      submittedAt: now,
      reviewedAt: null,
      reviewerId: null,
      rejectionReason: null,
      heldReason: null,
      approvalReason: null,
      ...overrides,
    } as Partial<Question>);
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    gemmaService = testApp.gemmaService;
    gdbService = testApp.gdbService;
    userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
    questionRepo = app.get<IQuestionRepository>(REPOSITORY_TOKENS.Question);

    await seedTestUsers(app);
    farmerToken = await getAuthToken(app, '9000000001');
    studentToken = await getAuthToken(app, '9000000002');
    adminToken = await getAuthToken(app, '9000000005');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  // ─── Original 10 Tests ──────────────────────────────────────────────────────

  it('Preview - happy path', async () => {
    const response = await request(app.getHttpServer())
      .post('/questions/preview')
      .set(getAuthHeaders(farmerToken))
      .send(previewPayload)
      .expect(200);

    expect(response.body.valid ?? true).toBe(true);
    expect(response.body.cropType).toEqual(expect.any(String));
    expect(response.body.domains).toEqual(expect.any(Array));
  });

  it('Submit - happy path -> status PENDING', async () => {
    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'How should I control pests in soybean crop?',
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBe(QuestionStatus.PENDING);
  });

  // AI/human-review confidence branching was removed on `develop` ("streamline question
  // review process by removing AI and human review statuses") — QuestionStatus no longer
  // has AI_REVIEW/HUMAN_REVIEW members at all; every new submission goes to PENDING
  // regardless of Gemma confidence (question.service.ts:311-312).
  it('Submit - low confidence -> still status PENDING (AI/human-review branching removed)', async () => {
    vi.mocked(gemmaService.inferCropAndDomains).mockResolvedValueOnce({
      crop: 'soybean',
      domains: ['Insect - Pest Management'],
      confidence: 0.7,
    });

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'Can soybean leaves with spots be treated?',
      })
      .expect(201);

    expect(response.body.status).toBe(QuestionStatus.PENDING);
  });

  it('Submit - GDB duplicate detected -> question rejected', async () => {
    vi.mocked(gdbService.checkDuplicate).mockResolvedValueOnce({
      isDuplicate: true,
      matchedQuestion: 'Similar question text',
      matchedAnswer: 'Some answer',
      similarityScore: 0.95,
      rawResponse: null,
    } as Awaited<ReturnType<GdbService['checkDuplicate']>>);

    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'Is this soybean pest question semantically duplicated?',
      })
      .expect(201);

    expect(response.body.status).toBe('DUPLICATE');
    expect(response.body.duplicate?.isDuplicate).toBe(true);
  });

  it('Submit - missing auth -> 401', async () => {
    await request(app.getHttpServer())
      .post('/questions')
      .send(validSubmitPayload)
      .expect(401);
  });

  it('Submit - questionText exceeds 1000 chars -> 400', async () => {
    await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'a'.repeat(1001),
      })
      .expect(400);
  });

  it('Submit - mediaType image but no mediaUrls -> 400', async () => {
    await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'What is shown in this soybean crop image?',
        mediaType: MediaType.IMAGE,
        mediaUrls: [],
      })
      .expect(400);
  });

  it('Edit - question editing has been removed; PATCH is always 403 even immediately after submit', async () => {
    // Question editing was removed entirely (question.service.ts's update() unconditionally
    // throws ForbiddenException after the ownership check), so this no longer depends on
    // any edit window — even a PATCH immediately following submit is forbidden.
    const submitResponse = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'Can I update this soybean question quickly?',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/questions/${submitResponse.body.id}`)
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'Updated text here' })
      .expect(403);

    expect(res.body.message).toMatch(/no longer available/i);
  });

  it('Submit - daily limit enforcement', async () => {
    const farmer = await userRepo.findByMobile('9000000001');

    // No bulk delete-by-filter on the repository abstraction — fetch then delete by id.
    const existing = await questionRepo.find({ userId: farmer!.id });
    await Promise.all(existing.map((q) => questionRepo.delete(q.id)));

    const submittedAt = new Date();

    await Promise.all(
      Array.from({ length: 19 }, (_, index) =>
        questionRepo.create({
          userId: farmer!.id,
          domains: ['Insect - Pest Management'],
          season: Season.KHARIF,
          cropType: 'Soybean',
          agroClimaticZone: 'eastern_plateau_and_hills',
          state: 'Maharashtra',
          district: 'Pune',
          block: null,
          questionText: `Seeded daily limit question ${index + 1}`,
          embedding: [0.1, 0.2, 0.3],
          mediaType: MediaType.NONE,
          mediaUrls: null,
          deviceInfo: null,
          status: QuestionStatus.PENDING,
          duplicateFlag: false,
          duplicateOfId: null,
          submittedAt,
          reviewedAt: null,
          reviewerId: null,
          rejectionReason: null,
          heldReason: null,
          approvalReason: null,
        } as Partial<Question>),
      ),
    );

    await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'This should be the twentieth question today.',
      })
      .expect(201);

    const limitResponse = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'This should exceed the daily question limit.',
      })
      .expect(400);

    expect(JSON.stringify(limitResponse.body.message).toLowerCase()).toContain('daily limit');
  });

  it('Get my questions - returns only own questions', async () => {
    const student = await userRepo.findByMobile('9000000002');
    const submittedAt = new Date();

    await questionRepo.create({
      userId: student!.id,
      domains: ['Insect - Pest Management'],
      season: Season.KHARIF,
      cropType: 'Soybean',
      agroClimaticZone: 'karnataka_plain_and_lcms',
      state: 'Karnataka',
      district: 'Bengaluru',
      block: null,
      questionText: 'Student owned question for list endpoint',
      embedding: [0.1, 0.2, 0.3],
      mediaType: MediaType.NONE,
      mediaUrls: null,
      deviceInfo: null,
      status: QuestionStatus.PENDING,
      duplicateFlag: false,
      duplicateOfId: null,
      submittedAt,
      reviewedAt: null,
      reviewerId: null,
      rejectionReason: null,
      heldReason: null,
      approvalReason: null,
    } as Partial<Question>);

    const response = await request(app.getHttpServer())
      .get('/questions')
      .set(getAuthHeaders(studentToken))
      .expect(200);

    expect(response.body.items).toEqual(expect.any(Array));
    expect(response.body.items.length).toBeGreaterThan(0);

    // Verify ownership by looking each returned id up directly rather than via a TypeORM
    // In() filter — In()'s FindOperator hits the same mistranslation bug as Between()
    // (documented in AdminAnalyticsAudit.e2e.md / test_plan.md): mongo-utils.ts's
    // translateValue() intercepts it via isTypeormFindOperator() before any dedicated
    // handler runs, and falls through to returning the raw id array as a literal filter
    // value, matching nothing.
    const returnedIds: string[] = response.body.items.map((item: { id: string }) => item.id);
    const returnedQuestions = await Promise.all(returnedIds.map((id) => questionRepo.findById(id)));

    expect(returnedQuestions.every((q) => q !== null)).toBe(true);
    expect(returnedQuestions.every((q) => q!.userId === student!.id)).toBe(true);
  });

  // ─── Layer 1 Extension ──────────────────────────────────────────────────────
  //
  // Real bug, not fixed here (documented in QuestionSubmit.e2e.md / test_plan.md), affects
  // all 6 tests below that hit a `/questions/:id` route: `question.controller.ts` guards
  // `PATCH /questions/:id`, `GET /questions/:id`, and 2 other `:id` routes with
  // `@Param('id', new ParseUUIDPipe())`. Every real question id in Mongo mode is a 24-char
  // ObjectId hex string, never a UUID, so `ParseUUIDPipe` always rejects it with 400 before
  // the request ever reaches the controller method — regardless of what the test is actually
  // trying to exercise (edit-removed 403, ownership 403, read visibility). Same class of bug
  // as WalletReward's `@IsUUID('4', ...)` finding on `paymentDetailId` — real ids throughout
  // this Mongo-migrated codebase are ObjectId strings, but several DTOs/route params still
  // validate against the old UUID format.



  it('Edit - even with an already-expired editWindowClosesAt, PATCH is 403 (feature removed, not window-dependent)', async () => {
    const farmer = await userRepo.findByMobile('9000000001');
    const question = await seedQuestion(farmer.id, {
      questionText: 'Question with an already-expired edit window',
      editWindowClosesAt: new Date(Date.now() - 1_000), // 1s in the past
    });

    const res = await request(app.getHttpServer())
      .patch(`/questions/${question.id}`)
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'Attempting edit after window closed' })
      .expect(403);

    expect(res.body.message).toMatch(/no longer available/i);
  });

  it('Edit - non-owner cannot edit another users question -> 403', async () => {
    const farmer = await userRepo.findByMobile('9000000001');
    const question = await seedQuestion(farmer.id, {
      questionText: 'Farmer question that student should not be able to edit',
    });

    await request(app.getHttpServer())
      .patch(`/questions/${question.id}`)
      .set(getAuthHeaders(studentToken))
      .send({ questionText: 'Unauthorized edit attempt by student' })
      .expect(403);
  });

  it('GET /questions/:id - owner can read own pending question', async () => {
    const farmer = await userRepo.findByMobile('9000000001');
    const question = await seedQuestion(farmer.id, {
      questionText: 'Farmer question that only owner should read',
    });

    const response = await request(app.getHttpServer())
      .get(`/questions/${question.id}`)
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(response.body.id).toBe(question.id);
    expect(response.body.questionText).toBe('Farmer question that only owner should read');
  });

  it('GET /questions/:id - non-owner cannot read a non-approved question -> 403', async () => {
    const farmer = await userRepo.findByMobile('9000000001');
    const question = await seedQuestion(farmer.id, {
      questionText: 'Pending question invisible to non-owner',
      status: QuestionStatus.PENDING,
    });

    await request(app.getHttpServer())
      .get(`/questions/${question.id}`)
      .set(getAuthHeaders(studentToken))
      .expect(403);
  });

  it('GET /questions/:id - approved question is visible to any authenticated user', async () => {
    const farmer = await userRepo.findByMobile('9000000001');
    const question = await seedQuestion(farmer.id, {
      questionText: 'Question that will be approved and become public',
    });

    await request(app.getHttpServer())
      .post(`/questions/${question.id}/approve`)
      .set(getAuthHeaders(adminToken))
      .send({})
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/questions/${question.id}`)
      .set(getAuthHeaders(studentToken))
      .expect(200);

    expect(response.body.id).toBe(question.id);
    expect(response.body.status).toBe(QuestionStatus.APPROVED);
  });

  it('GET /questions - pagination returns correct page size and totals', async () => {
    const student = await userRepo.findByMobile('9000000002');
    // Seed 3 questions for student so we have enough to paginate
    for (let i = 0; i < 3; i++) {
      await seedQuestion(student.id, { questionText: `Pagination test question ${i + 1} ts=${Date.now()}` });
    }

    const response = await request(app.getHttpServer())
      .get('/questions?page=1&limit=2')
      .set(getAuthHeaders(studentToken))
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.limit).toBe(2);
    expect(response.body.total).toBeGreaterThanOrEqual(3);
    expect(response.body.pages).toBeGreaterThanOrEqual(2);
  });

  // AI_REVIEW/HUMAN_REVIEW statuses were removed on `develop`; using HELD as the "distinct
  // from PENDING" status instead, same substitution as AdminAnalyticsAudit.e2e.test.ts.
  it('GET /questions - status filter returns only questions matching that status', async () => {
    const student = await userRepo.findByMobile('9000000002');
    await seedQuestion(student!.id, {
      questionText: `Filter test PENDING ${Date.now()}`,
      status: QuestionStatus.PENDING,
    });
    await seedQuestion(student!.id, {
      questionText: `Filter test HELD ${Date.now()}`,
      status: QuestionStatus.HELD,
    });

    const response = await request(app.getHttpServer())
      .get('/questions?status=held')
      .set(getAuthHeaders(studentToken))
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every((q: { status: string }) => q.status === QuestionStatus.HELD),
    ).toBe(true);
  });

  it('GET /questions/stats/me - returns daily count, remaining, and limit', async () => {
    const response = await request(app.getHttpServer())
      .get('/questions/stats/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(response.body).toMatchObject({
      dailyCount: expect.any(Number),
      remainingToday: expect.any(Number),
      dailyLimit: expect.anything(), // config values are stored as strings in admin_config
    });
    // Invariant: remaining === max(0, limit - count). The sum can exceed limit when accumulated
    // submissions from multiple test runs on the same day push dailyCount above dailyLimit.
    const limit = Number(response.body.dailyLimit);
    const count = response.body.dailyCount;
    expect(response.body.remainingToday).toBe(Math.max(0, limit - count));
  });

  it('Submit - valid video mediaType with URL -> 201', async () => {
    // Student is not at the daily limit; farmer reached it in the limit-enforcement test above
    const response = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(studentToken))
      .send({
        ...validSubmitPayload,
        questionText: 'How should I apply pesticide spray on my soybean crop?',
        mediaType: MediaType.VIDEO,
        mediaUrls: ['https://storage.example.com/test-video.mp4'],
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.status).toBeDefined();
  });

  it('Submit - missing required field (state) -> 400', async () => {
    const { state: _state, ...payloadWithoutState } = validSubmitPayload;

    await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...payloadWithoutState,
        questionText: 'Question submitted without a state field',
      })
      .expect(400);
  });

  it('Submit - empty domains array -> 400', async () => {
    await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'Question with an empty domains array',
        domains: [],
      })
      .expect(400);
  });

  it('Preview - GDB duplicate flag is reflected in the preview response', async () => {
    vi.mocked(gdbService.checkDuplicate).mockResolvedValueOnce({
      isDuplicate: true,
      matchedQuestion: 'An existing soybean pest management question',
      matchedAnswer: 'Use neem-based pesticides.',
      similarityScore: 0.97,
      rawResponse: null,
    } as Awaited<ReturnType<GdbService['checkDuplicate']>>);

    const response = await request(app.getHttpServer())
      .post('/questions/preview')
      .set(getAuthHeaders(farmerToken))
      .send(previewPayload)
      .expect(200);

    expect(response.body.duplicate).toBeDefined();
    expect(response.body.duplicate.isDuplicate).toBe(true);
    expect(response.body.duplicate.matchedQuestion).toBe('An existing soybean pest management question');
    expect(response.body.duplicate.similarityScore).toBe(0.97);
  });

  it('GET /questions - admin sees questions from all users, not just own', async () => {
    const farmer = await userRepo.findByMobile('9000000001');
    const farmerQuestion = await seedQuestion(farmer.id, {
      questionText: `Admin visibility test question ${Date.now()}`,
    });

    const response = await request(app.getHttpServer())
      .get('/questions')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    const returnedIds = (response.body.items as { id: string }[]).map((q) => q.id);
    expect(returnedIds).toContain(farmerQuestion.id);
  });
});
