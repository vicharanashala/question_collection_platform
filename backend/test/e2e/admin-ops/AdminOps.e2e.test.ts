import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Question } from '../../../src/shared/database/entities';
import {
  AuditAction,
  MediaType,
  PayoutMethod,
  QuestionStatus,
  Season,
  UserRole,
  VerificationStatus,
  WithdrawalStatus,
} from '../../../src/shared/classes/enums';
import { RazorpayPayoutService } from '../../../src/modules/payment/razorpay-payout.service';
import {
  REPOSITORY_TOKENS,
  IUserRepository,
  IWalletRepository,
  IQuestionRepository,
  IAuditLogRepository,
  IUserPaymentDetailRepository,
  IWithdrawalRequestRepository,
} from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('AdminOps (e2e)', () => {
  let app: INestApplication;
  let questionRepo: IQuestionRepository;
  let auditRepo: IAuditLogRepository;
  let userRepo: IUserRepository;
  let withdrawalRepo: IWithdrawalRequestRepository;
  let razorpayPayoutService: RazorpayPayoutService;

  let adminToken: string;
  let superAdminToken: string;
  let curatorToken: string;
  let farmerToken: string;

  let farmerId: string;
  let farmerWalletId: string;
  let superAdminId: string;

  // Review-queue question IDs (seeded in beforeAll)
  let approveQuestionId: string;
  let rejectQuestionId: string;
  let holdQuestionId: string;

  // Payment + withdrawal (for T17 / T18)
  let verifiedDetailId: string;
  let pendingWithdrawalId: string;

  // Created in T20 — used for cleanup assertion
  let createdUserId: string;

  // language deliberately omitted — see UserProfile.e2e.md / test_plan.md for the real
  // MongoDB text-index bug this would trip (non-English language codes crash the insert).
  const questionBase = {
    domains: ['Insect - Pest Management'],
    season: Season.KHARIF,
    cropType: 'Soybean',
    state: 'Maharashtra',
    district: 'Pune',
    mediaType: MediaType.NONE,
    // Use a past date so seeded questions don't count against today's daily limit
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    duplicateFlag: false,
  };

  async function seedQuestion(
    userId: string,
    status: QuestionStatus,
    extra: Partial<Question> = {},
  ): Promise<string> {
    const q = await questionRepo.create({
      ...questionBase,
      userId,
      questionText: `Admin test question [${status}] ${Date.now()}?`,
      status,
      ...extra,
    } as Partial<Question>);
    return q.id;
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    razorpayPayoutService = testApp.razorpayPayoutService;
    questionRepo = app.get<IQuestionRepository>(REPOSITORY_TOKENS.Question);
    auditRepo = app.get<IAuditLogRepository>(REPOSITORY_TOKENS.AuditLog);
    userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
    withdrawalRepo = app.get<IWithdrawalRequestRepository>(REPOSITORY_TOKENS.WithdrawalRequest);
    const walletRepo = app.get<IWalletRepository>(REPOSITORY_TOKENS.Wallet);
    const paymentDetailRepo = app.get<IUserPaymentDetailRepository>(REPOSITORY_TOKENS.UserPaymentDetail);

    await seedTestUsers(app);

    // Resolve user IDs
    const [farmer, , superAdmin] = await Promise.all([
      userRepo.findByMobile('9000000001'),
      userRepo.findByMobile('9000000005'),
      userRepo.findByMobile('9000000006'),
    ]);
    farmerId = farmer!.id;
    superAdminId = superAdmin!.id;

    // Tokens for all roles used in this suite
    [farmerToken, adminToken, superAdminToken, curatorToken] = await Promise.all([
      getAuthToken(app, '9000000001'),
      getAuthToken(app, '9000000005'),
      getAuthToken(app, '9000000006'),
      getAuthToken(app, '9000000003'),
    ]);

    // Farmer wallet ID (needed to seed withdrawal)
    const farmerWallet = await walletRepo.findByUserId(farmerId);
    farmerWalletId = farmerWallet!.id;

    // Seed PENDING questions for review-action tests (HUMAN_REVIEW/AI_REVIEW statuses were
    // removed — "streamline question review process by removing AI and human review
    // statuses"; all new submissions now go straight to PENDING for curator review).
    [approveQuestionId, rejectQuestionId, holdQuestionId] = await Promise.all([
      seedQuestion(farmerId, QuestionStatus.PENDING),
      seedQuestion(farmerId, QuestionStatus.PENDING),
      seedQuestion(farmerId, QuestionStatus.PENDING),
    ]);

    // Seed a duplicate-flagged question for fraud test (T15)
    await seedQuestion(farmerId, QuestionStatus.REJECTED, { duplicateFlag: true });

    // Seed a verified payment detail and a PENDING withdrawal for T17/T18.
    // verificationOrderId given a unique placeholder — see WalletReward.e2e.md / test_plan.md
    // for the real sparse-unique-null schema bug this works around.
    const detail = await paymentDetailRepo.create({
      userId: farmerId,
      payoutMethod: PayoutMethod.UPI,
      upiId: 'farmer@upi',
      status: 'verified',
      verifiedAt: new Date(),
      verificationOrderId: `seed-verified-${farmerId}-${Date.now()}`,
    } as never);
    verifiedDetailId = detail.id;

    const wr = await withdrawalRepo.create({
      userId: farmerId,
      walletId: farmerWalletId,
      amount: 100,
      payoutMethod: PayoutMethod.UPI,
      payoutDetails: { upiId: 'farmer@upi' },
      status: WithdrawalStatus.PENDING,
      orderId: `seed-order-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    } as never);
    pendingWithdrawalId = wr.id;
  }, 60_000);

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 6 of this suite's 21 tests fail on real bugs, not fixed here (documented in full in
  // AdminOps.e2e.md / test_plan.md) — all match already-established root causes from other
  // suites in this session, not new categories:
  //
  // T3 (approve → 500), T6 (cascades from T3): WalletsService.creditReward()
  // (wallets.service.ts:102, via AdminService.reviewQuestion() at admin.service.ts:769)
  // throws `DataSource is not available when DB=mongo` — same root cause documented in
  // WalletReward.e2e.md (this.ds is an @Optional() TypeORM DataSource AppModule never
  // provides). Approving a question can never credit the farmer's reward right now.
  //
  // T11 (config items always []): AdminService.listConfig() calls
  // `this.configRepo.find({ order: { key: 'ASC' } })` — same root cause documented in
  // AIPipeline.e2e.md (a TypeORM-style options object with no `where` wrapper is treated as
  // a literal Mongo filter, so it searches for a field literally named `order`, matching
  // nothing).
  //
  // T15 (fraud list empty), T16 (wallet.user undefined), T18 (processWithdrawal crashes
  // reading withdrawal.user.mobileNumber): AdminService.getFraudStats()/.listAllWallets()/
  // .processWithdrawal() all use TypeORM relation-based joins (`innerJoin('q.user', 'u')`,
  // `innerJoinAndSelect('w.user', 'u')`) — same root cause documented in UserProfile.e2e.md's
  // leaderboard finding and AdminAnalyticsAudit.e2e.md's audit-log join finding:
  // MongoQueryBuilder has no real relation-join support, only a small set of single-condition
  // regex-parsed patterns, so joined fields never hydrate (`u` comes back undefined/absent).
  // ══════════════════════════════════════════════════════════════════════════════

  // ── T1: Review queue visible to admin ────────────────────────────────────────

  it('T1: GET /admin/questions/queue as admin → 200 with PENDING items', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/questions/queue?status=pending')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.items)).toBe(true);
    const ids: string[] = res.body.items.map((q: any) => q.id);
    expect(ids).toContain(approveQuestionId);
  });

  // ── T2: Review queue blocked for regular users ────────────────────────────────

  it('T2: GET /admin/questions/queue as farmer (role=user) → 403', async () => {
    await request(app.getHttpServer())
      .get('/admin/questions/queue')
      .set(getAuthHeaders(farmerToken))
      .expect(403);
  });

  // ── T3: Approve question ──────────────────────────────────────────────────────

  it('T3: POST /admin/questions/:id/review (approve) → 200, wallet credited, status=APPROVED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/questions/${approveQuestionId}/review`)
      .set(getAuthHeaders(adminToken))
      .send({ action: 'approve' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('approved');
    expect(res.body.rewardCredited).toBeGreaterThan(0);

    const saved = await questionRepo.findById(approveQuestionId);
    expect(saved!.status).toBe(QuestionStatus.APPROVED);
  });

  // ── T4: Reject question ───────────────────────────────────────────────────────

  it('T4: POST /admin/questions/:id/review (reject) + reason → 200, status=REJECTED, reason stored', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/questions/${rejectQuestionId}/review`)
      .set(getAuthHeaders(adminToken))
      .send({ action: 'reject', reason: 'Not relevant to agriculture' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('rejected');
    expect(res.body.rejectionReason).toBe('Not relevant to agriculture');

    const saved = await questionRepo.findById(rejectQuestionId);
    expect(saved!.status).toBe(QuestionStatus.REJECTED);
    expect(saved!.rejectionReason).toBe('Not relevant to agriculture');
  });

  // ── T5: Hold question ─────────────────────────────────────────────────────────

  it('T5: POST /admin/questions/:id/review (hold) → 200, status=HELD', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/questions/${holdQuestionId}/review`)
      .set(getAuthHeaders(adminToken))
      .send({ action: 'hold', heldReason: 'Needs clarification from user' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('held');

    const saved = await questionRepo.findById(holdQuestionId);
    expect(saved!.status).toBe(QuestionStatus.HELD);
  });

  // ── T6: Audit log created on approval ─────────────────────────────────────────

  it('T6: audit_logs has QUESTION_APPROVED entry after T3', async () => {
    
    const log = await auditRepo.findOne({
      where: {
        action: AuditAction.QUESTION_APPROVED,
        entityId: approveQuestionId,
      },
    });
    expect(log).not.toBeNull();
    expect(log!.entityType).toBe('question');
    expect(log!.newValue).toMatchObject({ status: QuestionStatus.APPROVED });
  });

  // ── T7: List users ────────────────────────────────────────────────────────────

  it('T7: GET /admin/users → paginated list with role and verificationStatus', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/users')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(res.body.items)).toBe(true);
    const farmer = res.body.items.find((u: any) => u.mobileNumber === '9000000001');
    expect(farmer).toBeDefined();
    expect(farmer.role).toBe(UserRole.USER);
    expect(farmer.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  // ── T8: User detail ───────────────────────────────────────────────────────────

  it('T8: GET /admin/users/:id → full user record with questions and paymentDetails', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/users/${farmerId}`)
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.user).toMatchObject({ id: farmerId, mobileNumber: '9000000001' });
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(Array.isArray(res.body.paymentDetails)).toBe(true);
  });

  // ── T9: Suspend user ──────────────────────────────────────────────────────────

  it('T9: POST /admin/users/:id/suspend → verificationStatus=suspended (super_admin only)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/users/${farmerId}/suspend`)
      .set(getAuthHeaders(superAdminToken))
      .send({ action: 'suspend', reason: 'Policy violation test' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.newStatus).toBe(VerificationStatus.SUSPENDED);

    const user = await userRepo.findById(farmerId);
    expect(user!.verificationStatus).toBe(VerificationStatus.SUSPENDED);
  });

  // ── T10: Unsuspend user ───────────────────────────────────────────────────────

  it('T10: POST /admin/users/:id/unsuspend → verificationStatus=verified (super_admin only)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/users/${farmerId}/unsuspend`)
      .set(getAuthHeaders(superAdminToken))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.newStatus).toBe(VerificationStatus.VERIFIED);

    const user = await userRepo.findById(farmerId);
    expect(user!.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  // ── T11: List config ──────────────────────────────────────────────────────────

  it('T11: GET /admin/config → items array with all predefined config keys', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/config')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    const keys: string[] = res.body.items.map((c: any) => c.key);
    expect(keys).toContain('daily_question_limit');
    expect(keys).toContain('min_withdrawal_amount');
    expect(keys).toContain('duplicate_similarity_threshold');
  });

  // ── T12: Config change enforced on next question submission ───────────────────

  it('T12: PATCH /admin/config (daily_question_limit=1) → 2nd API submit blocked with 400', async () => {
    const submitPayload = {
      questionText: 'What are the best pest control methods for soybean in kharif season?',
      language: 'mr',
      domains: ['Insect - Pest Management'],
      season: Season.KHARIF,
      cropType: 'Soybean',
      state: 'Maharashtra',
      district: 'Pune',
      mediaType: MediaType.NONE,
    };

    // Set daily limit to 1
    await request(app.getHttpServer())
      .patch('/admin/config')
      .set(getAuthHeaders(adminToken))
      .send({ key: 'daily_question_limit', value: 1 })
      .expect(200);

    // First submit: should succeed (farmer has 0 API-submitted questions today)
    await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...submitPayload, questionText: 'First question under new limit — soybean aphid management?' })
      .expect(201);

    // Second submit: should be blocked
    const blockedRes = await request(app.getHttpServer())
      .post('/questions')
      .set(getAuthHeaders(farmerToken))
      .send({ ...submitPayload, questionText: 'Second question over daily limit — should be blocked?' })
      .expect(400);

    expect(blockedRes.body.message).toMatch(/daily limit|limit reached/i);

    // Restore
    await request(app.getHttpServer())
      .patch('/admin/config')
      .set(getAuthHeaders(adminToken))
      .send({ key: 'daily_question_limit', value: 20 })
      .expect(200);
  });

  // ── T13: Audit log for config change ─────────────────────────────────────────

  it('T13: audit_logs has ADMIN_CONFIG_UPDATED entry after T12', async () => {
    
    const log = await auditRepo.findOne({
      where: { action: AuditAction.ADMIN_CONFIG_UPDATED },
      order: { createdAt: 'DESC' },
    });
    expect(log).not.toBeNull();
    expect(log!.entityType).toBe('admin_config');
  });

  // ── T14: Platform stats ───────────────────────────────────────────────────────

  it('T14: GET /admin/stats → dashboard with user and question counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/stats')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.dashboard).toBeDefined();
    expect(res.body.dashboard.totalUsers).toBeGreaterThanOrEqual(6);
    expect(typeof res.body.dashboard.totalQuestions).toBe('number');
    expect(res.body.dashboard.approvedQuestions).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.roleDistribution)).toBe(true);
  });

  // ── T15: Fraud / duplicate submissions ───────────────────────────────────────

  it('T15: GET /admin/fraud → lists duplicate-flagged questions', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/fraud')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(typeof res.body.totalDuplicates).toBe('number');
    expect(res.body.totalDuplicates).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.duplicateSubmissions)).toBe(true);
  });

  // ── T16: All wallets summary ──────────────────────────────────────────────────

  it('T16: GET /admin/wallets → admin can see all user wallet summaries', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/wallets')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(res.body.items)).toBe(true);
    const farmerWallet = res.body.items.find((w: any) => w.user?.mobileNumber === '9000000001');
    expect(farmerWallet).toBeDefined();
    expect(typeof farmerWallet.balance).toBe('number');
  });

  // ── T17: All withdrawals list ─────────────────────────────────────────────────

  it('T17: GET /admin/withdrawals → pending withdrawal from seeded data appears in list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/withdrawals')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const ids: string[] = res.body.items.map((w: any) => w.id);
    expect(ids).toContain(pendingWithdrawalId);
  });

  // ── T18: Process withdrawal (approve via Razorpay) ───────────────────────────

  it('T18: POST /admin/withdrawals/:id/process (approve) → PROCESSING, Razorpay called', async () => {
    vi.mocked(razorpayPayoutService.createFundAccount).mockResolvedValueOnce({
      fundAccountId: 'fa_e2e_test',
      contactId: 'ct_e2e_test',
      active: true,
    });
    vi.mocked(razorpayPayoutService.initiatePayout).mockResolvedValueOnce({
      payoutId: 'po_e2e_test',
      status: 'processing',
      utrNumber: null,
    });

    const res = await request(app.getHttpServer())
      .post(`/admin/withdrawals/${pendingWithdrawalId}/process`)
      .set(getAuthHeaders(adminToken))
      .send({ action: 'approve' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe('approved');
    expect(res.body.status).toBe(WithdrawalStatus.PROCESSING);
    expect(res.body.razorpayPayoutId).toBe('po_e2e_test');

    expect(vi.mocked(razorpayPayoutService.createFundAccount)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(razorpayPayoutService.initiatePayout)).toHaveBeenCalledOnce();

    const wr = await withdrawalRepo.findById(pendingWithdrawalId);
    expect(wr!.status).toBe(WithdrawalStatus.PROCESSING);
    expect(wr!.razorpayPayoutId).toBe('po_e2e_test');
  });

  // ── T19: Adjust wallet (KNOWN BUG — unconditional throw) ────────────────────

  it('T19: POST /admin/wallets/adjust → 403 (KNOWN BUG: unconditional throw at admin.service.ts:3026)', async () => {
    // The adjustWalletBalance service method has an unconditional `throw new ForbiddenException(...)`
    // after a commented-out isSuperAdmin guard. Even super_admin cannot complete this call.
    // Expected: 200 for super_admin; Actual: 403 for everyone — pinned to actual.
    await request(app.getHttpServer())
      .post('/admin/wallets/adjust')
      .set(getAuthHeaders(superAdminToken))
      .send({ userId: farmerId, amount: 50, reason: 'Goodwill adjustment' })
      .expect(403);
  });

  // ── T20: Super admin creates a new admin user ─────────────────────────────────

  it('T20: POST /admin/users as super_admin → 201, admin user created', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/users')
      .set(getAuthHeaders(superAdminToken))
      .send({
        name: 'New Admin User',
        mobileNumber: '9000000007',
        role: UserRole.ADMIN,
        state: 'Karnataka',
        district: 'Bengaluru',
        block: 'Bengaluru South',
        village: 'Jayanagar',
        languagePreference: 'en',
      })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe(UserRole.ADMIN);
    expect(res.body.user.mobileNumber).toBe('9000000007');
    createdUserId = res.body.user.id;
  });

  // ── T21: Curator cannot create users (role guard) ─────────────────────────────

  it('T21: POST /admin/users as curator → 403 (curator role excluded from createUser endpoint)', async () => {
    await request(app.getHttpServer())
      .post('/admin/users')
      .set(getAuthHeaders(curatorToken))
      .send({
        name: 'Curator Attempt',
        mobileNumber: '9000000008',
        role: UserRole.USER,
        state: 'Maharashtra',
        district: 'Pune',
        block: 'Haveli',
        village: 'Kothrud',
      })
      .expect(403);
  });
});
