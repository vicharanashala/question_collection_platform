import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GemmaService } from '../../../src/ai/gemma.service';
import { GdbService } from '../../../src/ai/gdb.service';
import { Question, User } from '../../../src/database/entities';
import { MediaType, QuestionStatus, Season } from '../../../src/common/enums';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('Question Submit (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
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
  async function seedQuestion(userId: string, overrides: Partial<Question> = {}): Promise<Question> {
    const questionRepo = dataSource.getRepository(Question);
    const now = new Date();
    return questionRepo.save(
      questionRepo.create({
        userId,
        language: 'mr',
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
        editWindowClosesAt: new Date(now.getTime() + 30_000),
        submittedAt: now,
        reviewedAt: null,
        reviewerId: null,
        rejectionReason: null,
        heldReason: null,
        approvalReason: null,
        ...overrides,
      }),
    );
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    gemmaService = testApp.gemmaService;
    gdbService = testApp.gdbService;
    dataSource = app.get(DataSource);

    await seedTestUsers(dataSource);
    farmerToken = await getAuthToken(app, '9000000001');
    studentToken = await getAuthToken(app, '9000000002');
    adminToken = await getAuthToken(app, '9000000005');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
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

  it('Submit - low confidence -> status HUMAN_REVIEW', async () => {
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

    expect(response.body.status).toBe(QuestionStatus.HUMAN_REVIEW);
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

  it('Edit window - edit within 30s -> succeeds', async () => {
    const submitResponse = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({
        ...validSubmitPayload,
        questionText: 'Can I update this soybean question quickly?',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/questions/${submitResponse.body.id}`)
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'Updated text here' })
      .expect(200);
  });

  it('Submit - daily limit enforcement', async () => {
    const farmer = await dataSource.getRepository(User).findOneByOrFail({
      mobileNumber: '9000000001',
    });
    const questionRepo = dataSource.getRepository(Question);
    await questionRepo.delete({ userId: farmer.id });

    const submittedAt = new Date();
    const editWindowClosesAt = new Date(submittedAt.getTime() + 30_000);

    await questionRepo.save(
      Array.from({ length: 19 }, (_, index) =>
        questionRepo.create({
          userId: farmer.id,
          language: 'mr',
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
          editWindowClosesAt,
          submittedAt,
          reviewedAt: null,
          reviewerId: null,
          rejectionReason: null,
          heldReason: null,
          approvalReason: null,
        }),
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
    const student = await dataSource.getRepository(User).findOneByOrFail({
      mobileNumber: '9000000002',
    });
    const questionRepo = dataSource.getRepository(Question);
    const submittedAt = new Date();

    await questionRepo.save(
      questionRepo.create({
        userId: student.id,
        language: 'kn',
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
        editWindowClosesAt: new Date(submittedAt.getTime() + 30_000),
        submittedAt,
        reviewedAt: null,
        reviewerId: null,
        rejectionReason: null,
        heldReason: null,
        approvalReason: null,
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/questions')
      .set(getAuthHeaders(studentToken))
      .expect(200);

    expect(response.body.items).toEqual(expect.any(Array));
    expect(response.body.items.length).toBeGreaterThan(0);

    const returnedIds = response.body.items.map((item: { id: string }) => item.id);
    const returnedQuestions = await questionRepo.find({
      where: { id: In(returnedIds) },
      select: ['id', 'userId'],
    });

    expect(returnedQuestions).toHaveLength(returnedIds.length);
    expect(returnedQuestions.every((question) => question.userId === student.id)).toBe(true);
  });

  // ─── Layer 1 Extension ──────────────────────────────────────────────────────

  it('Edit window - edit after window closes -> 400', async () => {
    const farmer = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000001' });
    const question = await seedQuestion(farmer.id, {
      questionText: 'Question with an already-expired edit window',
      editWindowClosesAt: new Date(Date.now() - 1_000), // 1s in the past
    });

    await request(app.getHttpServer())
      .patch(`/questions/${question.id}`)
      .set(getAuthHeaders(farmerToken))
      .send({ questionText: 'Attempting edit after window closed' })
      .expect(400);
  });

  it('Edit - non-owner cannot edit another users question -> 403', async () => {
    const farmer = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000001' });
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
    const farmer = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000001' });
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
    const farmer = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000001' });
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
    const farmer = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000001' });
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
    const student = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000002' });
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

  it('GET /questions - status filter returns only questions matching that status', async () => {
    const student = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000002' });
    await seedQuestion(student.id, {
      questionText: `Filter test PENDING ${Date.now()}`,
      status: QuestionStatus.PENDING,
    });
    await seedQuestion(student.id, {
      questionText: `Filter test HUMAN_REVIEW ${Date.now()}`,
      status: QuestionStatus.HUMAN_REVIEW,
    });

    const response = await request(app.getHttpServer())
      .get('/questions?status=human_review')
      .set(getAuthHeaders(studentToken))
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every((q: { status: string }) => q.status === QuestionStatus.HUMAN_REVIEW),
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
    const farmer = await dataSource.getRepository(User).findOneByOrFail({ mobileNumber: '9000000001' });
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
