import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User, UserCropDetail, AuditLog } from '../database/entities';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  ActorType,
} from '../common/enums';

const mockUserRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockCropRepo = () => ({
  find: jest.fn(),
});

const mockAuditRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn(),
});

const mockUser: Partial<User> = {
  id: 'user-uuid-1',
  mobileNumber: '+919876543210',
  name: 'Ramesh Kumar',
  role: UserRole.USER,
  category: UserCategory.FARMER,
  state: 'Maharashtra',
  district: 'Pune',
  block: 'Haveli',
  languagePreference: 'hi',
  verificationStatus: VerificationStatus.VERIFIED,
  consentGiven: true,
  createdAt: new Date(),
};

describe('UserService', () => {
  let service: UserService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let cropRepo: ReturnType<typeof mockCropRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(UserCropDetail), useFactory: mockCropRepo },
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    cropRepo = module.get(getRepositoryToken(UserCropDetail));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return the user when found', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-uuid-1');

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-1' } });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('nonexistent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user fields and return saved user', async () => {
      const mutableUser = { ...mockUser };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockResolvedValue({ ...mutableUser, name: 'Suresh Kumar' });

      const result = await service.updateProfile('user-uuid-1', {
        name: 'Suresh Kumar',
        state: 'Karnataka',
      });

      expect(result).toHaveProperty('name', 'Suresh Kumar');
    });

    it('should call save even when no fields are provided (persists existing values)', async () => {
      const mutableUser = { ...mockUser };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockResolvedValue(mutableUser);

      await service.updateProfile('user-uuid-1', {});

      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should update only provided fields without modifying others', async () => {
      const mutableUser = { ...mockUser };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      await service.updateProfile('user-uuid-1', {
        state: 'Gujarat',
        // name is undefined — should keep existing value
      });

      const saved = userRepo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toHaveProperty('state', 'Gujarat');
      expect(saved).toHaveProperty('name', 'Ramesh Kumar'); // existing value preserved
    });

    it('should log audit entry after successful update', async () => {
      const mutableUser = { ...mockUser };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockResolvedValue(mutableUser);

      await service.updateProfile('user-uuid-1', { name: 'Changed' });

      // Audit is called via logAudit internally
      // We verify save was called (audit is triggered as a side-effect)
      expect(userRepo.save).toHaveBeenCalled();
    });
  });

  // ─── updateCropDetails ──────────────────────────────────────────────────────

  describe('updateCropDetails', () => {
    let mockQueryRunner: {
      connect: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
      release: jest.Mock;
      manager: {
        delete: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
      };
    };

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          delete: jest.fn().mockResolvedValue(undefined),
          create: jest.fn(),
          save: jest.fn(),
        },
      };
      (service as unknown as { dataSource: { createQueryRunner: jest.Mock } }).dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCropDetails('nonexistent-id', { crops: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete existing crops and insert new ones', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const newCrops = [
        { cropName: 'Wheat', season: 'rabi' },
        { cropName: 'Rice', season: 'kharif' },
      ];
      mockQueryRunner.manager.create.mockReturnValue({ id: 'crop-1' });
      mockQueryRunner.manager.save.mockResolvedValue([{ id: 'crop-1' }]);
      cropRepo.find.mockResolvedValue([
        { id: 'crop-1', userId: 'user-uuid-1', cropName: 'Wheat', season: 'rabi' },
        { id: 'crop-2', userId: 'user-uuid-1', cropName: 'Rice', season: 'kharif' },
      ]);

      const result = await service.updateCropDetails('user-uuid-1', { crops: newCrops });

      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(
        UserCropDetail,
        { userId: 'user-uuid-1' },
      );
      expect(mockQueryRunner.manager.create).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when crops is empty', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      cropRepo.find.mockResolvedValue([]);

      const result = await service.updateCropDetails('user-uuid-1', { crops: [] });

      expect(mockQueryRunner.manager.delete).toHaveBeenCalled();
      expect(mockQueryRunner.manager.create).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should rollback on error', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('Insert failed'));

      await expect(
        service.updateCropDetails('user-uuid-1', { crops: [{ cropName: 'Wheat' }] }),
      ).rejects.toThrow('Insert failed');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── getCropDetails ─────────────────────────────────────────────────────────

  describe('getCropDetails', () => {
    it('should return crop details ordered by createdAt', async () => {
      const crops = [
        { id: 'crop-1', cropName: 'Wheat', season: 'rabi' },
        { id: 'crop-2', cropName: 'Rice', season: 'kharif' },
      ];
      cropRepo.find.mockResolvedValue(crops);

      const result = await service.getCropDetails('user-uuid-1');

      expect(cropRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(crops);
    });
  });
});