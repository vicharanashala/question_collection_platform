import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

describe('UserService.refreshFromAnveshan', () => {
  let service: UserService;
  const userRepo = { findOne: jest.fn(), update: jest.fn() };
  const candidateRepo = { findByPhone: jest.fn() };
  const anveshanUser = {
    id: 'user-1',
    mobileNumber: '9876543210',
    isAnveshanUser: true,
    name: 'Old Name',
    state: 'Karnataka',
    district: 'Mysuru',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
        { provide: REPOSITORY_TOKENS.AuditLog, useValue: {} },
        { provide: REPOSITORY_TOKENS.Notification, useValue: {} },
        { provide: REPOSITORY_TOKENS.Question, useValue: {} },
        { provide: REPOSITORY_TOKENS.Transaction, useValue: {} },
        { provide: REPOSITORY_TOKENS.AgriEntity, useValue: {} },
        { provide: REPOSITORY_TOKENS.Candidate, useValue: candidateRepo },
      ],
    }).compile();
    service = module.get(UserService);
  });

  it('updates only the fields that differ', async () => {
    userRepo.findOne.mockResolvedValue({ ...anveshanUser });
    candidateRepo.findByPhone.mockResolvedValue({ full_name: 'New Name', state: 'Karnataka', district: 'Hassan' });

    const result = await service.refreshFromAnveshan('user-1');

    expect(userRepo.update).toHaveBeenCalledWith('user-1', { name: 'New Name', district: 'Hassan' });
    expect(result.updatedFields).toEqual(['name', 'district']);
  });

  it('does not write when nothing changed or incoming values are empty', async () => {
    userRepo.findOne.mockResolvedValue({ ...anveshanUser });
    candidateRepo.findByPhone.mockResolvedValue({ full_name: 'Old Name', state: null, district: ' ' });

    const result = await service.refreshFromAnveshan('user-1');

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(result.updatedFields).toEqual([]);
  });

  it('rejects users who are not Anveshan users', async () => {
    userRepo.findOne.mockResolvedValue({ ...anveshanUser, isAnveshanUser: false });

    await expect(service.refreshFromAnveshan('user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports not found when the candidate is missing or deleted', async () => {
    userRepo.findOne.mockResolvedValue({ ...anveshanUser });
    candidateRepo.findByPhone.mockResolvedValue(null);

    await expect(service.refreshFromAnveshan('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
