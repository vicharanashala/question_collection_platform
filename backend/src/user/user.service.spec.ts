import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User, AuditLog } from '../database/entities';
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
  crops: [] as string[],
};

describe('UserService', () => {
  let service: UserService;
  let userRepo: ReturnType<typeof mockUserRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
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
      userRepo.save.mockImplementation((u) => u);

      const result = await service.updateProfile('user-uuid-1', {
        name: 'Suresh Kumar',
        state: 'Karnataka',
      });

      expect(result).toHaveProperty('name', 'Suresh Kumar');
      expect(result).toHaveProperty('state', 'Karnataka');
    });

    it('should store crops directly on the user record', async () => {
      const mutableUser = { ...mockUser, crops: [] as string[] };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      const result = await service.updateProfile('user-uuid-1', {
        crops: ['Wheat', 'Rice'],
      });

      expect(userRepo.save).toHaveBeenCalled();
      const saved = userRepo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved['crops']).toEqual(['Wheat', 'Rice']);
    });

    it('should call save even when no fields are provided', async () => {
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
      });

      const saved = userRepo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toHaveProperty('state', 'Gujarat');
      expect(saved).toHaveProperty('name', 'Ramesh Kumar');
    });
  });

  // ─── updateCropDetails ──────────────────────────────────────────────────────

  describe('updateCropDetails', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCropDetails('nonexistent-id', { crops: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set crops on user record and save', async () => {
      const mutableUser = { ...mockUser, crops: [] as string[] };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      const result = await service.updateCropDetails('user-uuid-1', {
        crops: ['Soybean', 'Cotton'],
      });

      const saved = userRepo.save.mock.calls[0][0] as Record<string, unknown>;
      expect(saved['crops']).toEqual(['Soybean', 'Cotton']);
      expect(result).toEqual(['Soybean', 'Cotton']);
    });

    it('should return empty array when crops is empty', async () => {
      const mutableUser = { ...mockUser, crops: [] as string[] };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      const result = await service.updateCropDetails('user-uuid-1', { crops: [] });

      expect(result).toEqual([]);
    });
  });
});