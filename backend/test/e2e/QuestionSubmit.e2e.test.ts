import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GemmaService } from '../../src/ai/gemma.service';
import { GdbService } from '../../src/ai/gdb.service';
import { Question, User } from '../../src/database/entities';
import { MediaType, QuestionStatus, Season } from '../../src/common/enums';
import { createTestApp } from './helpers/app.helper';
import { cleanTestData, seedTestUsers } from './helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from './helpers/auth.helper';

describe('Question Submit (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let gemmaService: GemmaService;
  let gdbService: GdbService;
  let farmerToken: string;

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

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    gemmaService = testApp.gemmaService;
    gdbService = testApp.gdbService;
    dataSource = app.get(DataSource);

    await seedTestUsers(dataSource);
    farmerToken = await getAuthToken(app, '9000000001');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
    await app.close();
  });

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
    const studentToken = await getAuthToken(app, '9000000002');
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
});
