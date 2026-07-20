import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AdminConfig,
  AuditLog,
  Question,
  Transaction,
  User,
  Wallet,
  WithdrawalRequest,
} from '../../../src/database/entities';
import {
  ActorType,
  AuditAction,
  MediaType,
  PayoutMethod,
  QuestionStatus,
  Season,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '../../../src/common/enums';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('AdminAnalyticsAudit (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let adminToken: string;
  let superAdminToken: string;
  let curatorToken: string;
  let farmerToken: string;

  let farmerId: string;
  let studentId: string;
  let curatorId: string;
  let financeId: string;
  let adminId: string;

  let farmerWalletId: string;

  let approvedQ1Id: string;
  let approvedQ2Id: string;

  const questionBase = {
    language: 'mr',
    domains: ['Insect - Pest Management'],
    mediaType: MediaType.NONE,
    duplicateFlag: false,
    submittedAt: new Date(),
  };

  async function seedQuestion(
    userId: string,
    status: QuestionStatus,
    extra: Partial<Question>,
  ): Promise<string> {
    const repo = dataSource.getRepository(Question);
    const q = await repo.save(
      repo.create({
        ...questionBase,
        userId,
        questionText: `Analytics test question [${status}] ${Date.now()}-${Math.random()}?`,
        status,
        ...extra,
      } as Partial<Question>),
    );
    return q.id;
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    dataSource = app.get(DataSource);

    await seedTestUsers(dataSource);

    const users = await dataSource.getRepository(User).find({
      where: [
        { mobileNumber: '9000000001' },
        { mobileNumber: '9000000002' },
        { mobileNumber: '9000000003' },
        { mobileNumber: '9000000004' },
        { mobileNumber: '9000000005' },
      ],
      order: { mobileNumber: 'ASC' },
    });
    farmerId = users[0].id;
    studentId = users[1].id;
    curatorId = users[2].id;
    financeId = users[3].id;
    adminId = users[4].id;

    // Logging in sets lastLoginAt = now for every user tokened here — deliberately used
    // to make MAU/DAU deterministic for the analytics/users assertions below.
    [farmerToken, curatorToken, adminToken, superAdminToken] = await Promise.all([
      getAuthToken(app, '9000000001'),
      getAuthToken(app, '9000000003'),
      getAuthToken(app, '9000000005'),
      getAuthToken(app, '9000000006'),
    ]);
    await Promise.all([getAuthToken(app, '9000000002'), getAuthToken(app, '9000000004')]);

    const farmerWallet = await dataSource
      .getRepository(Wallet)
      .findOneOrFail({ where: { userId: farmerId } });
    farmerWalletId = farmerWallet.id;

    // Questions — farmer: 2 approved + 1 rejected (Maharashtra/Soybean, Soybean, Cotton).
    // student: 1 human_review (Karnataka/Wheat) — counts toward the *global*, date-unfiltered
    // "pending" bucket in getQuestionAnalytics.
    [approvedQ1Id, approvedQ2Id] = await Promise.all([
      seedQuestion(farmerId, QuestionStatus.APPROVED, {
        state: 'Maharashtra',
        district: 'Pune',
        cropType: 'Soybean',
        season: Season.KHARIF,
      }),
      seedQuestion(farmerId, QuestionStatus.APPROVED, {
        state: 'Maharashtra',
        district: 'Pune',
        cropType: 'Soybean',
        season: Season.KHARIF,
      }),
    ]);
    await seedQuestion(farmerId, QuestionStatus.REJECTED, {
      state: 'Maharashtra',
      district: 'Pune',
      cropType: 'Cotton',
      season: Season.KHARIF,
    });
    await seedQuestion(studentId, QuestionStatus.HUMAN_REVIEW, {
      state: 'Karnataka',
      district: 'Bengaluru',
      cropType: 'Wheat',
      season: Season.RABI,
    });

    // Reward transactions on the farmer's wallet: ₹2 + ₹3 = ₹5 total, count 2.
    const txRepo = dataSource.getRepository(Transaction);
    await txRepo.save([
      txRepo.create({
        walletId: farmerWalletId,
        type: TransactionType.CREDIT,
        source: TransactionSource.REWARD,
        amount: 2,
        balanceAfter: 2,
        status: TransactionStatus.COMPLETED,
      } as Partial<Transaction>),
      txRepo.create({
        walletId: farmerWalletId,
        type: TransactionType.CREDIT,
        source: TransactionSource.REWARD,
        amount: 3,
        balanceAfter: 5,
        status: TransactionStatus.COMPLETED,
      } as Partial<Transaction>),
    ]);

    // One pending withdrawal request for the farmer.
    await dataSource.getRepository(WithdrawalRequest).save(
      dataSource.getRepository(WithdrawalRequest).create({
        userId: farmerId,
        walletId: farmerWalletId,
        amount: 10,
        payoutMethod: PayoutMethod.UPI,
        payoutDetails: { upiId: 'farmer@upi' },
        status: WithdrawalStatus.PENDING,
      } as Partial<WithdrawalRequest>),
    );

    // Audit log rows — seeded directly rather than driven through /admin/questions/:id/review
    // so this suite doesn't depend on AdminOps's review flow being correct.
    const auditRepo = dataSource.getRepository(AuditLog);
    const minWithdrawalConfig = await dataSource
      .getRepository(AdminConfig)
      .findOneByOrFail({ key: 'min_withdrawal_amount' });

    await auditRepo.save([
      auditRepo.create({
        actorType: ActorType.ADMIN,
        actorId: adminId,
        action: AuditAction.QUESTION_APPROVED,
        entityType: 'question',
        entityId: approvedQ1Id,
        oldValue: { status: 'human_review' },
        newValue: { status: 'approved' },
      } as Partial<AuditLog>),
      auditRepo.create({
        actorType: ActorType.ADMIN,
        actorId: adminId,
        action: AuditAction.QUESTION_APPROVED,
        entityType: 'question',
        entityId: approvedQ2Id,
        oldValue: { status: 'human_review' },
        newValue: { status: 'approved' },
      } as Partial<AuditLog>),
      auditRepo.create({
        actorType: ActorType.CURATOR,
        actorId: curatorId,
        // Deliberately not in the AuditAction enum — admin.service.ts logs this as a raw
        // string literal ('question_held') rather than through the enum. See T12 for what
        // that means for getSummary()'s bucketing.
        action: 'question_held',
        entityType: 'question',
        entityId: approvedQ2Id,
      } as Partial<AuditLog>),
      auditRepo.create({
        actorType: ActorType.FINANCE,
        actorId: financeId,
        action: AuditAction.ADMIN_CONFIG_UPDATED,
        entityType: 'admin_config',
        entityId: minWithdrawalConfig.id,
        oldValue: { key: 'min_withdrawal_amount', value: '50' },
        newValue: { key: 'min_withdrawal_amount', value: '75' },
      } as Partial<AuditLog>),
    ]);
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
    await app.close();
  });

  // ── 1. Analytics dashboard ────────────────────────────────────────────────────

  it('T1: GET /analytics/dashboard as admin → 200, aggregate counts reflect seeded data', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/dashboard')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.totalRegisteredUsers).toBe(6);
    expect(res.body.monthlyActiveUsers).toBe(6); // all 6 seeded users logged in during beforeAll
    expect(res.body.totalApprovedQuestions).toBe(2);
    expect(res.body.totalRewarded).toBe(5);
  });

  // ── 2. User analytics ──────────────────────────────────────────────────────────

  it('T2: GET /analytics/users as admin → 200, role/state breakdowns match seeded users', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/users')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.totalUsers).toBe(6);
    expect(res.body.mau).toBe(6);

    const roleCount = (role: string) =>
      res.body.roleDistribution.find((r: { role: string }) => r.role === role)?.count ?? 0;
    expect(roleCount('user')).toBe(2);
    expect(roleCount('curator')).toBe(1);
    expect(roleCount('finance')).toBe(1);
    expect(roleCount('admin')).toBe(1);
    expect(roleCount('super_admin')).toBe(1);

    const stateCount = (state: string) =>
      res.body.stateBreakdown.find((s: { state: string }) => s.state === state)?.count ?? 0;
    expect(stateCount('Maharashtra')).toBe(5);
    expect(stateCount('Karnataka')).toBe(1);
  });

  // ── 3. Question analytics ─────────────────────────────────────────────────────

  it('T3: GET /analytics/questions as admin → 200, status/state/crop breakdowns match seeded questions', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/questions')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.summary).toMatchObject({
      total: 4,
      approved: 2,
      rejected: 1,
      approvalRate: 50,
    });
    // "pending" is a global count (PENDING/AI_REVIEW/HUMAN_REVIEW) with no date filter at
    // all — see admin.service.ts's getQuestionAnalytics. Only the student's human_review
    // question counts here.
    expect(res.body.summary.pending).toBe(1);

    const state = (name: string) =>
      res.body.stateBreakdown.find((s: { state: string }) => s.state === name);
    expect(state('Maharashtra')).toMatchObject({ count: 3, approved: 2 });
    expect(state('Karnataka')).toMatchObject({ count: 1, approved: 0 });

    const crop = (name: string) =>
      res.body.cropBreakdown.find((c: { cropType: string }) => c.cropType === name);
    expect(crop('Soybean')).toMatchObject({ count: 2, approved: 2 });
    expect(crop('Cotton')).toMatchObject({ count: 1, approved: 0 });
  });

  // ── 4. Reward analytics ────────────────────────────────────────────────────────

  it('T4: GET /analytics/rewards as admin → 200, totals match seeded transactions + withdrawal', async () => {
    const res = await request(app.getHttpServer())
      .get('/analytics/rewards')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.totalRewarded).toBe(5);
    expect(res.body.rewardCount).toBe(2);
    expect(res.body.avgReward).toBe(2.5);
    expect(res.body.withdrawals).toMatchObject({
      totalWithdrawn: 10,
      withdrawalCount: 1,
      pending: 1,
      completed: 0,
      failed: 0,
    });
  });

  it('T5: GET /analytics/rewards as curator → 403 (rewards restricted to admin/super_admin only)', async () => {
    await request(app.getHttpServer())
      .get('/analytics/rewards')
      .set(getAuthHeaders(curatorToken))
      .expect(403);
  });

  // ── 5. Export ──────────────────────────────────────────────────────────────────

  it('T6: GET /export/csv?dataType=questions as admin → 200, CSV rows match seeded questions', async () => {
    const res = await request(app.getHttpServer())
      .get('/export/csv?dataType=questions')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = (res.text as string).trim().split('\n');
    expect(lines[0]).toBe(
      'id,mobileNumber,name,questionText,language,domains,cropType,season,state,district,mediaType,status,submittedAt,reviewedAt,rejectionReason,heldReason,approvalReason',
    );
    // header + 4 seeded questions
    expect(lines).toHaveLength(5);
  });

  it('T7: GET /export/excel?dataType=users as admin → 200, xlsx content-type', async () => {
    const res = await request(app.getHttpServer())
      .get('/export/excel?dataType=users')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
    expect(res.text.length).toBeGreaterThan(0);
  });

  it('T8: GET /export/csv as curator → 403 (export restricted to admin/super_admin only)', async () => {
    await request(app.getHttpServer())
      .get('/export/csv')
      .set(getAuthHeaders(curatorToken))
      .expect(403);
  });

  // ── 6. Audit logs ──────────────────────────────────────────────────────────────

  it(
    'T9: GET /admin/audit-logs, unfiltered, as super_admin → 200, returns literally every ' +
      'audit_log row — no actor_type restriction at all when no ?role= is given',
    async () => {
      // buildRoleFilters() only restricts anything when authRole===SUPER_ADMIN AND a role
      // param is supplied. With neither, actorTypes/roles come back null and queryAuditLogs()
      // skips both `andWhere` calls entirely — so this "admin audit log" endpoint also surfaces
      // plain-user audit noise (otp_requested/otp_verified from every getAuthToken() call this
      // suite's own beforeAll made). Asserted against a live DB count rather than a hardcoded
      // number so this test doesn't silently drift if beforeAll's login count changes.
      const expectedTotal = await dataSource.getRepository(AuditLog).count();

      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .set(getAuthHeaders(superAdminToken))
        .expect(200);

      expect(res.body.total).toBe(expectedTotal);
      const actions = res.body.items.map((i: { action: string }) => i.action);
      expect(actions).toContain(AuditAction.OTP_VERIFIED); // login noise, not admin activity
      expect(actions).toContain(AuditAction.ADMIN_CONFIG_UPDATED); // one of ours
    },
  );

  it(
    'T10: GET /admin/audit-logs?role=admin as super_admin → 200, both admin entries ' +
      "(role=admin happens to work — see T12's actorTypeForRole finding for why 'happens to')",
    async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs?role=admin')
        .set(getAuthHeaders(superAdminToken))
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(res.body.items.every((i: { action: string }) => i.action === AuditAction.QUESTION_APPROVED)).toBe(true);
    },
  );

  it('T11: GET /admin/audit-logs?role=finance as super_admin → 200, the one finance entry', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/audit-logs?role=finance')
      .set(getAuthHeaders(superAdminToken))
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].action).toBe(AuditAction.ADMIN_CONFIG_UPDATED);
  });

  it(
    'T12: GET /admin/audit-logs?role=curator as super_admin → 200 but EMPTY — real bug, not a ' +
      "test-plan misassumption: actorTypeForRole() only special-cases 'finance', so role=curator " +
      "resolves to actor_type='admin' (wrong) while still requiring the joined user's role to be " +
      "'curator' — an intersection real curator-authored logs (actor_type='curator') can never satisfy",
    async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs?role=curator')
        .set(getAuthHeaders(superAdminToken))
        .expect(200);

      // Documents the bug: the curator's 'question_held' entry exists (see T13, which finds it
      // via the actorType param directly) but this role-based filter can never surface it.
      expect(res.body.total).toBe(0);
    },
  );

  it(
    "T13: GET /admin/audit-logs?actorType=curator as super_admin → 200, finds the curator's " +
      'entry — proves the underlying data is fine; only the role= convenience filter (T12) is broken. ' +
      "Also documents a separate bug: actorName/actorRole are always null in the response",
    async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs?actorType=curator')
        .set(getAuthHeaders(superAdminToken))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].action).toBe('question_held');
      expect(res.body.items[0].actorId).toBe(curatorId);
      // Bug: queryAuditLogs() does `.leftJoin('users', 'u', ...)` (not leftJoinAndSelect/
      // leftJoinAndMapOne) then manually appends 'u.name'/'u.role' to .select([...]). Since
      // `u` isn't a declared relation on the AuditLog entity, getManyAndCount()'s entity
      // hydration silently drops those extra joined columns instead of attaching them as
      // `item.u` — so the mapping code's `(item as unknown as {u?}).u?.role` always reads
      // undefined, and actorName/actorRole come back null for every single row, for every
      // caller. The actor's own id/type are unaffected (real AuditLog columns), only the
      // joined display fields are silently blank.
      expect(res.body.items[0].actorName).toBeNull();
      expect(res.body.items[0].actorRole).toBeNull();
    },
  );

  it('T14: GET /admin/audit-logs/stats as super_admin → per-actor breakdown matches seeded logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/audit-logs/stats')
      .set(getAuthHeaders(superAdminToken))
      .expect(200);

    expect(res.body.summary).toMatchObject({
      totalActions: 4,
      uniqueActors: 3,
      mostActiveActor: adminId,
    });

    const adminStats = res.body.actors.find((a: { actorId: string }) => a.actorId === adminId);
    expect(adminStats.questionApproved).toBe(2);
    expect(adminStats.totalActions).toBe(2);

    const curatorStats = res.body.actors.find((a: { actorId: string }) => a.actorId === curatorId);
    expect(curatorStats.questionHeld).toBe(1);

    const financeStats = res.body.actors.find((a: { actorId: string }) => a.actorId === financeId);
    expect(financeStats.configUpdated).toBe(1);
  });

  it(
    'T15: GET /admin/audit-logs/summary as super_admin — no actor_type restriction at all ' +
      "(unlike getActorStats' fallback default), so it picks up the same login noise as T9, " +
      "AND 'question_held' inflates the daily total without landing in any named bucket",
    async () => {
      // Same "no dto.role → no restriction" gap as T9, but getSummary's SQL builds its WHERE
      // clause from a plain string (`typeCondition`) with no fallback default, whereas
      // getActorStats (T14) falls back to `['admin','curator','finance']` when actorTypes is
      // null. So this endpoint — unlike /stats — includes the OTP login-noise rows too.
      const expectedTotal = await dataSource.getRepository(AuditLog).count();

      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs/summary')
        .set(getAuthHeaders(superAdminToken))
        .expect(200);

      expect(res.body.granularity).toBe('day');
      expect(res.body.series).toHaveLength(1); // everything created "now", same day bucket

      const today = res.body.series[0];
      expect(today.total).toBe(expectedTotal);
      expect(today.questionReviews).toBe(2); // only the two AuditAction.QUESTION_APPROVED entries
      expect(today.configChanges).toBe(1);
      expect(today.userActions).toBe(0);
      expect(today.withdrawals).toBe(0);
      // ACTION_CATEGORY has no entry for the literal 'question_held' string (only the
      // AuditAction enum's QUESTION_* keys), and OTP_* actions are explicitly mapped to 'auth' —
      // getSummary's switch doesn't add either category to any of the four named buckets, so
      // named buckets always undercount `total` by exactly the number of 'auth'-category rows.
      const namedBucketSum = today.withdrawals + today.userActions + today.questionReviews + today.configChanges;
      expect(namedBucketSum).toBe(3); // 2 questionReviews + 1 configChanges; 'question_held' excluded
      expect(today.total - namedBucketSum).toBe(expectedTotal - 3);
    },
  );

  it('T16: GET /admin/audit-logs/entity/question/:id as super_admin → scoped to that one entity', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/audit-logs/entity/question/${approvedQ1Id}`)
      .set(getAuthHeaders(superAdminToken))
      .expect(200);

    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].action).toBe(AuditAction.QUESTION_APPROVED);
    expect(res.body.entries[0].actorId).toBe(adminId);
  });

  it(
    'T17: GET /admin/audit-logs/users-by-role?role=curator as admin → 500, not 200 — real bug: ' +
      "getUsersByRole() calls dataSource.getRepository('user') (lowercase string), which doesn't " +
      "match the registered entity name ('User'), so this endpoint crashes for every role/caller " +
      'that passes the permission check (see T18 for the one case that short-circuits before it)',
    async () => {
      await request(app.getHttpServer())
        .get('/admin/audit-logs/users-by-role?role=curator')
        .set(getAuthHeaders(adminToken))
        .expect(500);
    },
  );

  it('T18: GET /admin/audit-logs/users-by-role?role=admin as admin (not super_admin) → empty, no crash (permission check short-circuits before the buggy repo lookup)', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/audit-logs/users-by-role?role=admin')
      .set(getAuthHeaders(adminToken))
      .expect(200);

    expect(res.body.users).toEqual([]);
  });

  // ── 7. Guard comparison: analytics is role-guarded, audit-logs is not ──────────

  it('T19: GET /analytics/dashboard as a plain user (farmer) → 403 (RolesGuard enforced)', async () => {
    await request(app.getHttpServer())
      .get('/analytics/dashboard')
      .set(getAuthHeaders(farmerToken))
      .expect(403);
  });

  it(
    'T20: GET /admin/audit-logs as a plain user (farmer) → 200, NOT 403 — documented access-control ' +
      'gap, not a guard (AuditController has no RolesGuard/@Roles at all)',
    async () => {
      // AuditController is decorated with only @UseGuards(JwtAuthGuard) — no RolesGuard, no
      // @Roles(). Its own service-level buildRoleFilters() branches on authRole, but the only
      // branch that actually restricts anything is SUPER_ADMIN-with-a-role-filter and
      // ADMIN-with-a-disallowed-role-filter; every other authRole (including a plain farmer
      // 'user') falls through to the unguarded default meant to mean "curator+finance combined".
      // Net effect: any authenticated user, regardless of role, can read finance-tier audit
      // history via this endpoint — no guard stops them. Contrast with T19 above, where the
      // sibling analytics controller's RolesGuard correctly returns 403 for the same farmer token.
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .set(getAuthHeaders(farmerToken))
        .expect(200);

      // The default branch *intends* curator+finance, but actorTypeForRole's bug (see T12) maps
      // curator to actor_type='admin' — so the actor_type filter becomes ['admin','finance'],
      // and the curator's own 'question_held' entry (actor_type='curator') is excluded by that
      // filter before the role check even runs. Only the finance entry survives both bugs.
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].action).toBe(AuditAction.ADMIN_CONFIG_UPDATED);
    },
  );
});
