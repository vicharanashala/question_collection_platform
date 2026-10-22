import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
// import { User, AuditLog } from '../../shared/database/entities';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { User } from '@/shared/database/mongodb/schemas/user.schema';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  ActorType,
} from '../../shared/classes/enums';

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

const userId = '507f1f77bcf86cd799439011' as unknown as User['_id'];
const nonexistentUserId = '507f1f77bcf86cd799439012' as unknown as User['_id'];

const mockUser: Partial<User> = {
  _id: userId,
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
        { provide: REPOSITORY_TOKENS.User, useFactory: mockUserRepo },
        { provide: REPOSITORY_TOKENS.AuditLog, useFactory: mockAuditRepo },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(REPOSITORY_TOKENS.User);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return the user when found', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getProfile(userId);

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: userId } });
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile(nonexistentUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile(nonexistentUserId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user fields and return saved user', async () => {
      const mutableUser = { ...mockUser };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      const result = await service.updateProfile(userId, {
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

      const result = await service.updateProfile(userId, {
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

      await service.updateProfile(userId, {});

      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should update only provided fields without modifying others', async () => {
      const mutableUser = { ...mockUser };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      await service.updateProfile(userId, {
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
        service.updateCropDetails(nonexistentUserId, { crops: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set crops on user record and save', async () => {
      const mutableUser = { ...mockUser, crops: [] as string[] };
      userRepo.findOne.mockResolvedValue(mutableUser);
      userRepo.save.mockImplementation((u) => u);

      const result = await service.updateCropDetails(userId, {
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

      const result = await service.updateCropDetails(userId, { crops: [] });

      expect(result).toEqual([]);
    });
  });
});