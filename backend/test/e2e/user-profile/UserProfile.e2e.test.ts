import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Notification,
  Question,
  Transaction,
  User,
  Wallet,
} from '../../../src/database/entities';
import {
  MediaType,
  QuestionStatus,
  Season,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../../src/common/enums';
import { NotificationType } from '../../../src/database/entities/notification.entity';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('UserProfile (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let farmerToken: string;
  let studentToken: string;

  let farmerId: string;
  let studentId: string;
  let farmerWalletId: string;
  let studentWalletId: string;

  const questionBase = {
    language: 'mr',
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
    const repo = dataSource.getRepository(Question);
    const q = await repo.save(
      repo.create({
        ...questionBase,
        userId,
        questionText: `Leaderboard test question ${Date.now()}-${Math.random()}?`,
        status: QuestionStatus.APPROVED,
      } as Partial<Question>),
    );
    return q.id;
  }

  async function seedRewardTransaction(walletId: string, amount: number): Promise<void> {
    const repo = dataSource.getRepository(Transaction);
    await repo.save(
      repo.create({
        walletId,
        type: TransactionType.CREDIT,
        source: TransactionSource.REWARD,
        amount,
        balanceAfter: amount,
        status: TransactionStatus.COMPLETED,
      } as Partial<Transaction>),
    );
  }

  async function seedNotification(userId: string, overrides: Partial<Notification> = {}): Promise<string> {
    const repo = dataSource.getRepository(Notification);
    const n = await repo.save(
      repo.create({
        userId,
        type: NotificationType.GENERAL,
        title: 'Test notification',
        body: 'Test notification body',
        isRead: false,
        ...overrides,
      } as Partial<Notification>),
    );
    return n.id;
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    dataSource = app.get(DataSource);

    await seedTestUsers(dataSource);

    const users = await dataSource.getRepository(User).find({
      where: [{ mobileNumber: '9000000001' }, { mobileNumber: '9000000002' }],
      order: { mobileNumber: 'ASC' },
    });
    farmerId = users[0].id;
    studentId = users[1].id;

    [farmerToken, studentToken] = await Promise.all([
      getAuthToken(app, '9000000001'),
      getAuthToken(app, '9000000002'),
    ]);

    const wallets = await dataSource.getRepository(Wallet).find({
      where: [{ userId: farmerId }, { userId: studentId }],
    });
    farmerWalletId = wallets.find((w) => w.userId === farmerId)!.id;
    studentWalletId = wallets.find((w) => w.userId === studentId)!.id;
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
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

    const notif = await dataSource
      .getRepository(Notification)
      .findOneByOrFail({ id: farmerNotifId });
    expect(notif.isRead).toBe(true);

    // Sibling notification untouched.
    const sibling = await dataSource
      .getRepository(Notification)
      .findOneByOrFail({ id: farmerNotifId2 });
    expect(sibling.isRead).toBe(false);
  });

  it('T7: PATCH /users/me/notifications/read-all — marks all of the caller\'s unread notifications read', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/notifications/read-all')
      .set(getAuthHeaders(farmerToken))
      .send({})
      .expect(200);

    const farmerNotifs = await dataSource
      .getRepository(Notification)
      .find({ where: { userId: farmerId } });
    expect(farmerNotifs.every((n) => n.isRead)).toBe(true);

    // Student's notification is untouched by the farmer's bulk mark-read.
    const studentNotif = await dataSource
      .getRepository(Notification)
      .findOneByOrFail({ id: studentNotifId });
    expect(studentNotif.isRead).toBe(false);
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
      const notif = await dataSource
        .getRepository(Notification)
        .findOneByOrFail({ id: farmerNotifId });
      expect(notif.userId).toBe(farmerId);
      expect(notif.isRead).toBe(true); // already true from T6/T7, unchanged by student's call
    },
  );
});
