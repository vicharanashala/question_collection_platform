import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AgriEntitiesService } from './agri-entities.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { UserRole } from '../../shared/classes/enums';
import { UserService } from '../user/user.service';

const anveshan = [
  { id: 'u1', name: 'Asha', mobileNumber: '9000000001' },
  { id: 'u2', name: 'Bala', mobileNumber: '9000000002' },
];

describe('AgriEntitiesService staff listing and export', () => {
  let service: AgriEntitiesService;
  const repo = { findOrderedBySubmission: jest.fn() };
  const userRepo = { findAll: jest.fn(), findByIds: jest.fn() };

  beforeEach(async () => {
    repo.findOrderedBySubmission.mockReset().mockResolvedValue({ data: [], total: 0 });
    userRepo.findAll.mockReset().mockResolvedValue(anveshan);
    userRepo.findByIds.mockReset().mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        AgriEntitiesService,
        { provide: REPOSITORY_TOKENS.AgriEntity, useValue: repo },
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
        { provide: UserService, useValue: {} },
      ],
    }).compile();
    service = module.get(AgriEntitiesService);
  });

  it('filters by several Anveshan users and sorts newest first by default', async () => {
    await service.listAll({ userIds: ['u1', 'u2'], page: 2, limit: 10 }, UserRole.SUPER_ADMIN);

    expect(repo.findOrderedBySubmission).toHaveBeenCalledWith({
      filter: { userId: { $in: ['u1', 'u2'] } },
      order: 'desc',
      page: 2,
      limit: 10,
    });
  });

  it('honours ascending order and keeps type and status filters', async () => {
    await service.listAll({ userIds: ['u1'], type: 'crop', status: 'pending', sortOrder: 'asc' } as never, UserRole.SUPER_ADMIN);

    expect(repo.findOrderedBySubmission).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'asc', filter: { userId: { $in: ['u1'] }, type: 'crop', status: 'pending' } }),
    );
  });

  it('keeps only selected users that the tester scope allows', async () => {
    userRepo.findAll.mockImplementation((filter: Record<string, unknown>) =>
      Promise.resolve(filter.is_tester ? [anveshan[0]] : anveshan),
    );

    await service.listAll({ userIds: ['u1', 'u2'], tester: 'exclude' }, UserRole.SUPER_ADMIN);

    expect(repo.findOrderedBySubmission).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { userId: { $in: ['u2'] } } }),
    );
  });

  it('rejects the user filter for non Super Admins', async () => {
    await expect(service.listAll({ userIds: ['u1'] }, UserRole.ADMIN)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists entities without a submission location using the repository order', async () => {
    const entity = { id: 'e1', userId: 'u1', createdAt: new Date('2026-01-01'), submissionLocation: null };
    repo.findOrderedBySubmission.mockResolvedValue({ data: [entity], total: 1 });
    userRepo.findAll.mockResolvedValue([{ id: 'u1', name: 'Asha', username: null, mobileNumber: '9000000001' }]);

    const result = await service.listAll({}, UserRole.ADMIN);

    expect(result.items[0]).toMatchObject({ id: 'e1', submitter: { name: 'Asha', mobileNumber: '9000000001' } });
    const curator = await service.listAll({}, UserRole.CURATOR);
    expect(curator.items[0].submitter).not.toHaveProperty('mobileNumber');
    expect(result.total).toBe(1);
  });

  it('exports with the same filters, limited to Anveshan users, without paging', async () => {
    await service.exportAnveshanEntities({ userIds: ['u2'], sortOrder: 'asc' }, UserRole.SUPER_ADMIN);

    expect(repo.findOrderedBySubmission).toHaveBeenCalledWith({ filter: { userId: { $in: ['u2'] } }, order: 'asc' });
  });

  it('exports a valid workbook even when nothing matches, and rejects non Super Admins', async () => {
    const file = await service.exportAnveshanEntities({}, UserRole.SUPER_ADMIN);
    expect(file.length).toBeGreaterThan(0);
    await expect(service.exportAnveshanEntities({ userIds: ['u1'] }, UserRole.CURATOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('searches users by name or mobile number', async () => {
    userRepo.findAll.mockResolvedValue([anveshan[1]]);

    expect(await service.searchUsers({ search: 'bal' })).toEqual([anveshan[1]]);
    expect(userRepo.findAll).toHaveBeenCalledWith(
      { $or: [{ name: { $regex: 'bal', $options: 'i' } }, { mobileNumber: { $regex: 'bal', $options: 'i' } }] },
      expect.objectContaining({ pagination: expect.objectContaining({ limit: 100 }) }),
    );
  });

  it('restricts the listed users to the tester and Anveshan scopes', async () => {
    userRepo.findAll.mockImplementation((filter: Record<string, unknown>) =>
      Promise.resolve(filter.is_tester ? [anveshan[0]] : anveshan),
    );

    await service.searchUsers({ tester: 'exclude' });
    expect(userRepo.findAll).toHaveBeenLastCalledWith({ id: { $nin: ['u1'] } }, expect.anything());
    await service.searchUsers({ tester: 'only' });
    expect(userRepo.findAll).toHaveBeenLastCalledWith({ id: { $in: ['u1'] } }, expect.anything());
  });
});
