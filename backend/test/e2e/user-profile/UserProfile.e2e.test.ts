import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Notification,
  Question,
  Transaction,
} from '../../../src/shared/database/entities';
import {
  MediaType,
  QuestionStatus,
  Season,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../../src/shared/classes/enums';
import { NotificationType } from '../../../src/shared/database/entities/notification.entity';
import {
  REPOSITORY_TOKENS,
  IUserRepository,
  IWalletRepository,
  IQuestionRepository,
  ITransactionRepository,
  INotificationRepository,
} from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('UserProfile (e2e)', () => {
  let app: INestApplication;
  let questionRepo: IQuestionRepository;
  let transactionRepo: ITransactionRepository;
  let notificationRepo: INotificationRepository;

  let farmerToken: string;
  let studentToken: string;

  let farmerId: string;
  let studentId: string;
  let farmerWalletId: string;
  let studentWalletId: string;

  // language deliberately omitted (defaults to 'en' on the schema) — see the real-bug note
  // below on why setting it to a non-MongoDB-recognized code like 'mr' isn't safe here.
  const questionBase = {
    domains: ['Insect - Pest Management'],
    season: Season.KHARIF,
    cropType: 'Soybean',
    state: 'Maharashtra',
    district: 'Pune',
    mediaType: MediaType.NONE,
    // Past date so seeded questions don't count against today's daily submit limit.
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    duplicateFlag: false,
  };

  async function seedApprovedQuestion(userId: string): Promise<string> {
    const q = await questionRepo.create({
      ...questionBase,
      userId,
      questionText: `Leaderboard test question ${Date.now()}-${Math.random()}?`,
      status: QuestionStatus.APPROVED,
    } as Partial<Question>);
    return q.id;
  }

  async function seedRewardTransaction(walletId: string, amount: number): Promise<void> {
    await transactionRepo.create({
      walletId,
      type: TransactionType.CREDIT,
      source: TransactionSource.REWARD,
      amount,
      balanceAfter: amount,
      status: TransactionStatus.COMPLETED,
    } as Partial<Transaction>);
  }

  async function seedNotification(userId: string, overrides: Partial<Notification> = {}): Promise<string> {
    const n = await notificationRepo.create({
      userId,
      type: NotificationType.GENERAL,
      title: 'Test notification',
      body: 'Test notification body',
      isRead: false,
      ...overrides,
    } as Partial<Notification>);
    return n.id;
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    questionRepo = app.get<IQuestionRepository>(REPOSITORY_TOKENS.Question);
    transactionRepo = app.get<ITransactionRepository>(REPOSITORY_TOKENS.Transaction);
    notificationRepo = app.get<INotificationRepository>(REPOSITORY_TOKENS.Notification);
    const userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
    const walletRepo = app.get<IWalletRepository>(REPOSITORY_TOKENS.Wallet);

    await seedTestUsers(app);

    const farmer = await userRepo.findByMobile('9000000001');
    const student = await userRepo.findByMobile('9000000002');
    farmerId = farmer!.id;
    studentId = student!.id;

    [farmerToken, studentToken] = await Promise.all([
      getAuthToken(app, '9000000001'),
      getAuthToken(app, '9000000002'),
    ]);

    const farmerWallet = await walletRepo.findByUserId(farmerId);
    const studentWallet = await walletRepo.findByUserId(studentId);
    farmerWalletId = farmerWallet!.id;
    studentWalletId = studentWallet!.id;
  });

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  // ── 1. Profile read ───────────────────────────────────────────────────────────

  it('T1: GET /users/me — returns own profile matching seeded fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.mobileNumber).toBe('9000000001');
    expect(res.body.name).toBe('Test Farmer');
    expect(res.body.category).toBe('farmer');
    expect(res.body.state).toBe('Maharashtra');
    expect(res.body.district).toBe('Pune');
    expect(res.body.role).toBe('user');
    expect(res.body.crops).toEqual([]);
  });

  it('T1b: GET /users/me — missing auth token → 401', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  // ── 2. Profile update ─────────────────────────────────────────────────────────

  it('T2: PATCH /users/me — updates fields, persisted on subsequent GET', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set(getAuthHeaders(farmerToken))
      .send({
        name: 'Updated Farmer Name',
        village: 'Wagholi',
        age: 42,
        farmSize: '5 acres',
        cropType: 'Cotton',
      })
      .expect(200);

    expect(res.body.user.name).toBe('Updated Farmer Name');

    const getRes = await request(app.getHttpServer())
      .get('/users/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(getRes.body.name).toBe('Updated Farmer Name');
    expect(getRes.body.age).toBe(42);
    expect(getRes.body.farmSize).toBe('5 acres');
    expect(getRes.body.cropType).toBe('Cotton');
  });

  // ── 3. Crop details ────────────────────────────────────────────────────────────

  it('T3: PATCH /users/me/crops — replaces crop list, persisted on subsequent GET', async () => {
    const res = await request(app.getHttpServer())
      .patch('/users/me/crops')
      .set(getAuthHeaders(farmerToken))
      .send({ crops: ['wheat', 'soybean'] })
      .expect(200);

    expect(res.body.crops).toEqual(['wheat', 'soybean']);

    const getRes = await request(app.getHttpServer())
      .get('/users/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(getRes.body.crops).toEqual(['wheat', 'soybean']);
  });

  // ── 4. Leaderboard ─────────────────────────────────────────────────────────────
  //
  // Real bug found while writing this suite, not fixed here (documented in
  // UserProfile.e2e.md / test_plan.md): `question.schema.ts:91` creates a MongoDB text
  // index (`QuestionSchema.index({ questionText: 'text' })`) with no `default_language:
  // 'none'` override. MongoDB automatically treats any field literally named `language` on
  // a document as a per-document text-search stemming directive unless that's disabled —
  // and it only recognizes a fixed set of language names (english, spanish, etc.), NOT ISO
  // codes like 'mr'/'hi'/'ta'. Inserting a Question with `language: 'mr'` throws
  // `MongoServerError: language override unsupported: mr` outright (reproduced directly;
  // see seedApprovedQuestion() above, which now omits `language` to avoid tripping this).
  // Currently masked in the real submit flow only because QuestionService.submit() never
  // actually reads `dto.language` at all (grepped — zero references), so real submissions
  // always fall through to the schema default ('en') regardless of what's sent — but this
  // is a second, separate gap (a documented DTO field with no effect), and the text-index
  // bug would immediately surface for real users the moment language persistence is wired
  // up on this 24-language platform.
  //
  // Second, larger real bug on this same test — GET /users/me/leaderboard always returns
  // empty in Mongo mode: UserService.getLeaderboard() (user.service.ts:117) still builds the
  // leaderboard entirely from hand-written raw PostgreSQL strings (`SELECT ... ::float ...
  // JOIN ... GROUP BY`) passed as the "relation" argument into
  // `this.userRepo.createQueryBuilder('u').leftJoin(sqlString, ...)`. MongoQueryBuilder (the
  // Mongo implementation of that same interface) only parses a small set of structured
  // TypeORM condition-string patterns — it has no SQL parser, so this whole method was never
  // ported and effectively no-ops. The repository layer already has a real Mongo-native
  // replacement sitting unused: `MongoUserRepository.getLeaderboard()` (an aggregation
  // pipeline: $match → $group → $sort) is fully implemented but UserService.getLeaderboard()
  // never calls it.

  it('T4: GET /users/me/leaderboard — ranked by approved questions, reflects real seeded data', async () => {
    // Farmer: 3 approved questions + reward transactions totalling 7.
    await Promise.all([
      seedApprovedQuestion(farmerId),
      seedApprovedQuestion(farmerId),
      seedApprovedQuestion(farmerId),
    ]);
    await Promise.all([
      seedRewardTransaction(farmerWalletId, 1),
      seedRewardTransaction(farmerWalletId, 1),
      seedRewardTransaction(farmerWalletId, 5),
    ]);

    // Student: 1 approved question + reward transaction of 1.
    await seedApprovedQuestion(studentId);
    await seedRewardTransaction(studentWalletId, 1);

    const res = await request(app.getHttpServer())
      .get('/users/me/leaderboard')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.entries).toHaveLength(2);

    const farmerEntry = res.body.entries.find((e: { userId: string }) => e.userId === farmerId);
    const studentEntry = res.body.entries.find((e: { userId: string }) => e.userId === studentId);

    expect(farmerEntry.rank).toBe(1);
    expect(farmerEntry.totalQuestions).toBe(3);
    expect(farmerEntry.totalEarned).toBe(7);
    expect(farmerEntry.medal).toBe('gold');
    expect(farmerEntry.isCurrentUser).toBe(true);

    expect(studentEntry.rank).toBe(2);
    expect(studentEntry.totalQuestions).toBe(1);
    expect(studentEntry.totalEarned).toBe(1);
    expect(studentEntry.medal).toBe('silver');
    expect(studentEntry.isCurrentUser).toBe(false);

    expect(res.body.userRank).toBe(1);
  });

  // ── 5. Notifications ──────────────────────────────────────────────────────────

  let farmerNotifId: string;
  let farmerNotifId2: string;
  let studentNotifId: string;

  it('T5: GET /users/me/notifications — paginated, own only', async () => {
    farmerNotifId = await seedNotification(farmerId, { title: 'Farmer notif 1' });
    farmerNotifId2 = await seedNotification(farmerId, { title: 'Farmer notif 2' });
    studentNotifId = await seedNotification(studentId, { title: 'Student notif 1' });

    const res = await request(app.getHttpServer())
      .get('/users/me/notifications')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.unread).toBe(2);
    expect(res.body.notifications).toHaveLength(2);
    const ids = res.body.notifications.map((n: { id: string }) => n.id);
    expect(ids).toContain(farmerNotifId);
    expect(ids).toContain(farmerNotifId2);
    expect(ids).not.toContain(studentNotifId);
  });

  it('T6: PATCH /users/me/notifications/:id/read — marks a single notification read', async () => {
    await request(app.getHttpServer())
      .patch(`/users/me/notifications/${farmerNotifId}/read`)
      .set(getAuthHeaders(farmerToken))
      .send({})
      .expect(200);

    const notif = await notificationRepo.findById(farmerNotifId);
    expect(notif!.isRead).toBe(true);

    // Sibling notification untouched.
    const sibling = await notificationRepo.findById(farmerNotifId2);
    expect(sibling!.isRead).toBe(false);
  });

  it('T7: PATCH /users/me/notifications/read-all — marks all of the caller\'s unread notifications read', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/notifications/read-all')
      .set(getAuthHeaders(farmerToken))
      .send({})
      .expect(200);

    const farmerNotifs = await notificationRepo.find({ userId: farmerId });
    expect(farmerNotifs.every((n) => n.isRead)).toBe(true);

    // Student's notification is untouched by the farmer's bulk mark-read.
    const studentNotif = await notificationRepo.findById(studentNotifId);
    expect(studentNotif!.isRead).toBe(false);
  });

  it(
    'T8: PATCH /users/me/notifications/:id/read for another user\'s notification — ' +
      'no ownership guard: returns 200 but leaves the row untouched (documented gap, not a guard)',
    async () => {
      // studentToken attempts to mark the (already-read-all) farmer notification as read.
      // UserService.markAsRead() scopes its UPDATE with { id, userId: caller }, so a
      // mismatched owner simply matches zero rows — no NotFoundException/ForbiddenException
      // is thrown, and the controller unconditionally returns { success: true }.
      const res = await request(app.getHttpServer())
        .patch(`/users/me/notifications/${farmerNotifId}/read`)
        .set(getAuthHeaders(studentToken))
        .send({})
        .expect(200);

      expect(res.body.success).toBe(true);

      // Confirm the farmer's notification row was not re-attributed or altered.
      const notif = await notificationRepo.findById(farmerNotifId);
      expect(notif!.userId).toBe(farmerId);
      expect(notif!.isRead).toBe(true); // already true from T6/T7, unchanged by student's call
    },
  );
});
