import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService, buildAuditScope } from '../../../../src/modules/audit-logs/services/audit.service';
import { ActorType, UserRole } from '../../../../src/shared/classes/enums';
import { REPOSITORY_TOKENS } from '../../../../src/shared/database/repositories';
import { createMockRepository } from '../../../helpers/mock-repository';
import type { QueryAuditLogsDto } from '../../../../src/modules/audit-logs/dto/query-audit-log.dto';

describe('buildAuditScope', () => {
  it('gives super admins unrestricted access', () => {
    expect(buildAuditScope({ id: 'sa', role: UserRole.SUPER_ADMIN })).toBeNull();
  });

  it('lets admins see their own actions and those of finance, curators and distributors', () => {
    expect(buildAuditScope({ id: 'admin-1', role: UserRole.ADMIN })).toEqual({
      $or: [
        { 'actor.id': 'admin-1' },
        { 'actor.actorType': { $in: [ActorType.FINANCE, ActorType.CURATOR, ActorType.DISTRIBUTOR] } },
      ],
    });
  });

  it('never lets admins see other admins or super admins', () => {
    const scope = buildAuditScope({ id: 'admin-1', role: UserRole.ADMIN }) as { $or: Array<Record<string, { $in?: string[] }>> };
    const visibleTypes = scope.$or[1]['actor.actorType'].$in;

    expect(visibleTypes).not.toContain(ActorType.ADMIN);
    expect(visibleTypes).not.toContain(ActorType.SUPER_ADMIN);
  });

  it.each([UserRole.CURATOR, UserRole.FINANCE, UserRole.DISTRIBUTOR])('restricts %s to their own actions', (role) => {
    expect(buildAuditScope({ id: 'staff-1', role })).toEqual({ 'actor.id': 'staff-1' });
  });

  it.each([UserRole.USER, 'unknown-role'])('denies role %p by default', (role) => {
    expect(() => buildAuditScope({ id: 'x', role })).toThrow(ForbiddenException);
  });
});

describe('AuditService', () => {
  const auditRepo = createMockRepository('findPage');
  let service: AuditService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: REPOSITORY_TOKENS.AuditLog, useValue: auditRepo },
        { provide: REPOSITORY_TOKENS.User, useValue: createMockRepository() },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('persists audit entries', async () => {
    auditRepo.create.mockResolvedValue({ id: 'log-1' });

    await expect(service.createAuditLog({ action: 'user_banned' } as never)).resolves.toEqual({ id: 'log-1' });
  });

  it('applies the role scope when listing', () => {
    const query = { page: 1 } as QueryAuditLogsDto;

    service.listAuditLogs(query, { id: 'c1', role: UserRole.CURATOR });

    expect(auditRepo.findPage).toHaveBeenCalledWith(query, { 'actor.id': 'c1' });
  });
});
