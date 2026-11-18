import { Logger } from '@nestjs/common';
import * as request from 'supertest';
import { Types } from 'mongoose';
import { ReportsController } from '../../src/modules/reports/controllers/reports.controller';
import { ReportsService } from '../../src/modules/reports/services/reports.service';
import { AuditService } from '../../src/modules/audit-logs/services/audit.service';
import { ReportCategory, ReportStatus, UserRole } from '../../src/shared/classes/enums';
import { buildUser, objectId } from '../helpers/factories';
import { createTestApp, TestApp } from '../helpers/test-app';

describe('Reports API (e2e)', () => {
  const reportsService = {
    createReport: jest.fn(),
    getMyReport: jest.fn(),
    getMyReports: jest.fn(),
    listReports: jest.fn(),
    getReport: jest.fn(),
    updateStatus: jest.fn(),
    updatePriority: jest.fn(),
    addReply: jest.fn(),
  };
  const auditService = { createAuditLog: jest.fn() };
  let testApp: TestApp;

  const farmer = buildUser({ role: UserRole.USER });
  const admin = buildUser({ role: UserRole.ADMIN, name: 'Admin' });

  beforeAll(async () => {
    testApp = await createTestApp({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reportsService }, { provide: AuditService, useValue: auditService }, Logger],
    });
  });
  afterAll(() => testApp.close());

  beforeEach(() => {
    testApp.userRepo.findById.mockImplementation(async (id: string) => [farmer, admin].find((u) => u._id.toHexString() === id) ?? null);
    testApp.sessionService.validateAccess.mockResolvedValue({});
  });

  const http = () => request(testApp.app.getHttpServer());
  const bearer = (user: typeof farmer) => `Bearer ${testApp.accessTokenFor(user)}`;
  const validReport = { title: 'Payout missing', description: 'My withdrawal never arrived.', category: ReportCategory.PAYOUT_ISSUE };

  describe('POST /api/v1/reports', () => {
    it('creates a report for the authenticated user', async () => {
      const id = new Types.ObjectId();
      reportsService.createReport.mockResolvedValue({ _id: id });

      const res = await http().post('/api/v1/reports').set('Authorization', bearer(farmer)).send(validReport).expect(201);

      expect(res.body).toEqual({ id: id.toHexString(), message: 'Report submitted successfully' });
      expect(reportsService.createReport).toHaveBeenCalledWith(farmer._id.toHexString(), validReport);
    });

    it('returns 400 with field messages for invalid input', async () => {
      const res = await http()
        .post('/api/v1/reports')
        .set('Authorization', bearer(farmer))
        .send({ title: 'Hi', description: 'short', category: 'complaint' })
        .expect(400);

      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('title'), expect.stringContaining('category')]));
      expect(reportsService.createReport).not.toHaveBeenCalled();
    });

    it('rejects unknown fields so clients cannot mass-assign status or owner', async () => {
      await http()
        .post('/api/v1/reports')
        .set('Authorization', bearer(farmer))
        .send({ ...validReport, status: ReportStatus.RESOLVED, userId: objectId() })
        .expect(400);
    });

    it('requires authentication', async () => {
      await http().post('/api/v1/reports').send(validReport).expect(401);
    });
  });

  describe('GET /api/v1/reports/my/:id', () => {
    it('returns 404 when the report is not the user’s', async () => {
      reportsService.getMyReport.mockResolvedValue(null);

      await http().get(`/api/v1/reports/my/${objectId()}`).set('Authorization', bearer(farmer)).expect(404);
    });

    it('returns the user’s report', async () => {
      reportsService.getMyReport.mockResolvedValue({ id: 'r1', title: 'Bug' });

      await http().get('/api/v1/reports/my/r1').set('Authorization', bearer(farmer)).expect(200, { id: 'r1', title: 'Bug' });
    });
  });

  describe('GET /api/v1/reports/my', () => {
    it('parses pagination from the query string', async () => {
      reportsService.getMyReports.mockResolvedValue({ items: [], total: 0, page: 2, limit: 5, pages: 0 });

      await http().get('/api/v1/reports/my?page=2&limit=5').set('Authorization', bearer(farmer)).expect(200);

      expect(reportsService.getMyReports).toHaveBeenCalledWith(farmer._id.toHexString(), 2, 5);
    });
  });

  describe('staff routes', () => {
    it('forbids public users from listing all reports', async () => {
      const res = await http().get('/api/v1/reports').set('Authorization', bearer(farmer)).expect(403);

      expect(res.body.message).toContain('Required role');
      expect(reportsService.listReports).not.toHaveBeenCalled();
    });

    it.each([UserRole.DISTRIBUTOR])('forbids %s from the staff report list', async (role) => {
      const staff = buildUser({ role });
      testApp.userRepo.findById.mockResolvedValue(staff);

      await http().get('/api/v1/reports').set('Authorization', bearer(staff)).expect(403);
    });

    it('lets admins list reports with converted query filters', async () => {
      reportsService.listReports.mockResolvedValue({ items: [], total: 0, page: 2, limit: 10, pages: 0 });

      await http().get('/api/v1/reports?status=open&page=2&limit=10').set('Authorization', bearer(admin)).expect(200);

      expect(reportsService.listReports).toHaveBeenCalledWith(expect.objectContaining({ status: 'open', page: 2, limit: 10 }));
    });

    it('rejects invalid list filters', async () => {
      await http().get('/api/v1/reports?status=archived').set('Authorization', bearer(admin)).expect(400);
      await http().get('/api/v1/reports?limit=1000').set('Authorization', bearer(admin)).expect(400);
    });

    it('lets admins reply and records an audit entry', async () => {
      const replyId = new Types.ObjectId();
      reportsService.getReport.mockResolvedValue({ id: 'r1', status: ReportStatus.OPEN, replies: [] });
      reportsService.addReply.mockResolvedValue({ _id: replyId, message: 'On it' });

      await http().post('/api/v1/reports/r1/replies').set('Authorization', bearer(admin)).send({ message: 'On it' }).expect(201);

      expect(reportsService.addReply).toHaveBeenCalledWith('r1', admin._id.toHexString(), { message: 'On it' });
      expect(auditService.createAuditLog).toHaveBeenCalled();
    });

    it('forbids public users from replying', async () => {
      await http().post('/api/v1/reports/r1/replies').set('Authorization', bearer(farmer)).send({ message: 'Hi' }).expect(403);
      expect(reportsService.addReply).not.toHaveBeenCalled();
    });
  });
});
