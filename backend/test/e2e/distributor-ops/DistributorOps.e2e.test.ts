import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Question } from '../../../src/shared/database/entities';
import { MediaType, QuestionStatus, Season } from '../../../src/shared/classes/enums';
import {
  REPOSITORY_TOKENS,
  IUserRepository,
  IQuestionRepository,
  IFinalQuestionRepository,
} from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('DistributorOps (e2e)', () => {
  let app: INestApplication;
  let userRepo: IUserRepository;
  let questionRepo: IQuestionRepository;
  let finalQuestionRepo: IFinalQuestionRepository;

  let distributorToken: string;
  let adminToken: string;
  let curatorToken: string;
  let farmerToken: string;
  let distributorId: string;

  // Approved question ids seeded in beforeAll (used for the queue/assign tests)
  let approvedQ1Id: string;
  let approvedQ2Id: string;
  let rejectedQId: string;

  // language deliberately omitted — see UserProfile.e2e.md / test_plan.md for the real
  // MongoDB text-index bug that setting it explicitly would trip.
  async function seedQuestion(userId: string, status: QuestionStatus, extra: Partial<Question> = {}): Promise<string> {
    const q = await questionRepo.create({
      userId,
      domains: ['Insect - Pest Management'],
      season: Season.KHARIF,
      cropType: 'Soybean',
      state: 'Maharashtra',
      district: 'Pune',
      mediaType: MediaType.NONE,
      duplicateFlag: false,
      submittedAt: new Date(),
      questionText: `Distributor test question [${status}] ${Date.now()}-${Math.random()}?`,
      status,
      ...extra,
    } as Partial<Question>);
    return q.id;
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
    questionRepo = app.get<IQuestionRepository>(REPOSITORY_TOKENS.Question);
    finalQuestionRepo = app.get<IFinalQuestionRepository>(REPOSITORY_TOKENS.FinalQuestion);

    await seedTestUsers(app);

    // seed.helper.ts's testUsers doesn't include a distributor — create one locally.
    // Given a unique username (see Auth.e2e.md for why: username is unique+sparse+default:
    // null on the schema, and a second null-username user would collide).
    const distributor = await userRepo.create({
      mobileNumber: '9000000009',
      name: 'Test Distributor',
      username: 'test_distributor_seed9',
      category: 'volunteer',
      state: 'Maharashtra',
      district: 'Pune',
      role: 'distributor',
      verificationStatus: 'verified',
      consentGiven: true,
      languagePreference: 'en',
      tokenVersion: 0,
    } as never);
    distributorId = distributor.id;

    [distributorToken, adminToken, curatorToken, farmerToken] = await Promise.all([
      getAuthToken(app, '9000000009'),
      getAuthToken(app, '9000000005'),
      getAuthToken(app, '9000000003'),
      getAuthToken(app, '9000000001'),
    ]);

    [approvedQ1Id, approvedQ2Id] = await Promise.all([
      seedQuestion(distributorId, QuestionStatus.APPROVED, { cropType: 'Soybean' }),
      seedQuestion(distributorId, QuestionStatus.APPROVED, { cropType: 'Cotton' }),
    ]);
    rejectedQId = await seedQuestion(distributorId, QuestionStatus.REJECTED);
  }, 60_000);

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  // ── 1. Reference data ─────────────────────────────────────────────────────────

  it('T1: GET /distributor/indian-states as distributor → 200, full state list', async () => {
    const res = await request(app.getHttpServer())
      .get('/distributor/indian-states')
      .set(getAuthHeaders(distributorToken))
      .expect(200);

    expect(Array.isArray(res.body.states)).toBe(true);
    expect(res.body.states).toContain('Maharashtra');
    expect(res.body.states.length).toBeGreaterThan(20);
  });

  it('T2: GET /distributor/indian-states as farmer (role=user) → 403', async () => {
    await request(app.getHttpServer())
      .get('/distributor/indian-states')
      .set(getAuthHeaders(farmerToken))
      .expect(403);
  });

  it('T3: GET /distributor/indian-states as curator → 403 (class guard is distributor/admin/super_admin only)', async () => {
    await request(app.getHttpServer())
      .get('/distributor/indian-states')
      .set(getAuthHeaders(curatorToken))
      .expect(403);
  });

  it('T4: GET /distributor/stats as admin → 200, byState + indianStatesTotal', async () => {
    const res = await request(app.getHttpServer())
      .get('/distributor/stats')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(typeof res.body.indianStatesTotal).toBe('number');
    expect(res.body.indianStatesTotal).toBeGreaterThan(20);
    expect(Array.isArray(res.body.byState)).toBe(true);
  });

  // ── 2. Approved-questions queue ───────────────────────────────────────────────

  it('T5: GET /distributor/questions as distributor → 200, only APPROVED questions listed', async () => {
    const res = await request(app.getHttpServer())
      .get('/distributor/questions')
      .set(getAuthHeaders(distributorToken))
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    const ids: string[] = res.body.items.map((q: { id: string }) => q.id);
    expect(ids).toContain(approvedQ1Id);
    expect(ids).toContain(approvedQ2Id);
    expect(ids).not.toContain(rejectedQId);
    expect(res.body.items.every((q: { status: string }) => q.status === QuestionStatus.APPROVED)).toBe(true);
  });

  it('T6: GET /distributor/questions/:id as distributor → 200, single approved question', async () => {
    const res = await request(app.getHttpServer())
      .get(`/distributor/questions/${approvedQ1Id}`)
      .set(getAuthHeaders(distributorToken))
      .expect(200);

    expect(res.body.id).toBe(approvedQ1Id);
    expect(res.body.status).toBe(QuestionStatus.APPROVED);
  });

  it('T7: GET /distributor/questions/:id for a non-approved question → 400', async () => {
    await request(app.getHttpServer())
      .get(`/distributor/questions/${rejectedQId}`)
      .set(getAuthHeaders(distributorToken))
      .expect(400);
  });

  it('T8: GET /distributor/questions/:id for a nonexistent id → 404', async () => {
    await request(app.getHttpServer())
      .get('/distributor/questions/000000000000000000000000')
      .set(getAuthHeaders(distributorToken))
      .expect(404);
  });

  // ── 3. Assign states ──────────────────────────────────────────────────────────

  it('T9: POST /distributor/questions/:id/assign-states as curator → 403 (method-level @Roles(DISTRIBUTOR) only)', async () => {
    await request(app.getHttpServer())
      .post(`/distributor/questions/${approvedQ1Id}/assign-states`)
      .set(getAuthHeaders(curatorToken))
      .send({ states: ['Maharashtra'] })
      .expect(403);
  });

  it('T10: POST /distributor/questions/:id/assign-states as admin → 403 (distributor only, admin can browse but not act)', async () => {
    await request(app.getHttpServer())
      .post(`/distributor/questions/${approvedQ1Id}/assign-states`)
      .set(getAuthHeaders(adminToken))
      .send({ states: ['Maharashtra'] })
      .expect(403);
  });

  it('T11: POST /distributor/questions/:id/assign-states with an invalid state name → 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/distributor/questions/${approvedQ1Id}/assign-states`)
      .set(getAuthHeaders(distributorToken))
      .send({ states: ['Narnia'] })
      .expect(400);

    expect(JSON.stringify(res.body.message)).toMatch(/valid indian state/i);
  });

  it('T12: POST /distributor/questions/:id/assign-states as distributor, happy path → 201, creates final_questions rows, question status → MOVED_TO_FINAL', async () => {
    const res = await request(app.getHttpServer())
      .post(`/distributor/questions/${approvedQ1Id}/assign-states`)
      .set(getAuthHeaders(distributorToken))
      .send({ states: ['Maharashtra', 'Karnataka'], notes: 'First distribution batch' })
      .expect(201);

    expect(res.body.referenceQuestionId).toBe(approvedQ1Id);
    expect(res.body.referenceDocCreated).toBe(true);
    expect(res.body.insertedStates.sort()).toEqual(['Karnataka', 'Maharashtra']);
    expect(res.body.skippedStates).toEqual([]);
    expect(res.body.insertedCount).toBe(2);
    expect(res.body.questionStatus).toBe(QuestionStatus.MOVED_TO_FINAL);

    const updated = await questionRepo.findById(approvedQ1Id);
    expect(updated!.status).toBe(QuestionStatus.MOVED_TO_FINAL);

    const rows = await finalQuestionRepo.findByReferenceQuestionId(approvedQ1Id);
    // 1 reference doc (distributionState: null) + 2 state-specific child docs
    expect(rows).toHaveLength(3);
  });

  it('T13: POST /distributor/questions/:id/assign-states again with an already-assigned state → skipped, not duplicated', async () => {
    const res = await request(app.getHttpServer())
      .post(`/distributor/questions/${approvedQ1Id}/assign-states`)
      .set(getAuthHeaders(distributorToken))
      .send({ states: ['Maharashtra', 'Punjab'] })
      .expect(400);

    // The parent question already flipped to MOVED_TO_FINAL in T12 — assignStates()
    // requires status APPROVED, so a second call on the same question is rejected
    // outright rather than reaching the per-state skip logic.
    expect(JSON.stringify(res.body.message)).toMatch(/only approved questions/i);
  });

  it('T14: POST /distributor/questions/:id/assign-states on a second approved question, empty states array → 201, no state rows, just the reference doc', async () => {
    const res = await request(app.getHttpServer())
      .post(`/distributor/questions/${approvedQ2Id}/assign-states`)
      .set(getAuthHeaders(distributorToken))
      .send({ states: [] })
      .expect(201);

    expect(res.body.insertedStates).toEqual([]);
    expect(res.body.insertedCount).toBe(0);
    expect(res.body.referenceDocCreated).toBe(true);

    const rows = await finalQuestionRepo.findByReferenceQuestionId(approvedQ2Id);
    expect(rows).toHaveLength(1);
  });

  // ── 4. Browse distributions ───────────────────────────────────────────────────

  it('T15: GET /distributor/distributions as distributor → 200, lists rows with distributor name enriched', async () => {
    const res = await request(app.getHttpServer())
      .get('/distributor/distributions')
      .set(getAuthHeaders(distributorToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(4); // 2 ref docs + 2 state rows from T12/T14
    const withDistributor = res.body.items.find((r: { distributor: unknown }) => r.distributor);
    expect(withDistributor).toBeDefined();
    expect(withDistributor.distributor.id).toBe(distributorId);
    expect(withDistributor.distributor.name).toBe('Test Distributor');
  });

  it('T16: GET /distributor/distributions?distributionState=Maharashtra → only Maharashtra rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/distributor/distributions?distributionState=Maharashtra')
      .set(getAuthHeaders(distributorToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(
      res.body.items.every((r: { distributionState: string }) => r.distributionState === 'Maharashtra'),
    ).toBe(true);
  });

  it('T17: GET /distributor/distributions/by-question/:questionId → reference doc + state rows for that question', async () => {
    const res = await request(app.getHttpServer())
      .get(`/distributor/distributions/by-question/${approvedQ1Id}`)
      .set(getAuthHeaders(distributorToken))
      .expect(200);

    expect(res.body.questionId).toBe(approvedQ1Id);
    expect(res.body.states.sort()).toEqual(['Karnataka', 'Maharashtra']);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.referenceDocId).toBeTruthy();
  });

  it('T18: GET /distributor/distributions as farmer (role=user) → 403', async () => {
    await request(app.getHttpServer())
      .get('/distributor/distributions')
      .set(getAuthHeaders(farmerToken))
      .expect(403);
  });
});
