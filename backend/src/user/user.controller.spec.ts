import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  UserRole,
  VerificationStatus,
  UserCategory,
} from '../common/enums';

const mockUserService = () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  updateCropDetails: jest.fn(),
});

const mockUser = {
  id: 'user-1',
  mobileNumber: '9876543210',
  name: 'Ramesh Kumar',
  category: UserCategory.FARMER,
  state: 'Maharashtra',
  district: 'Pune',
  block: 'Haveli',
  languagePreference: 'hi',
  verificationStatus: VerificationStatus.VERIFIED,
  role: UserRole.USER,
  profileData: null,
  consentGiven: true,
  consentTimestamp: new Date(),
  createdAt: new Date(),
  lastLoginAt: null,
  crops: [] as string[],
};

describe('UserController', () => {
  let controller: UserController;
  let userService: ReturnType<typeof mockUserService>;

  const userReq = { user: { id: 'user-1', mobileNumber: '9876543210', role: UserRole.USER } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useFactory: mockUserService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── GET /users/me ──────────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('should return user profile with crops', async () => {
      userService.getProfile.mockResolvedValue({
        ...mockUser,
        crops: ['Wheat', 'Rice'],
      });

      const result = await controller.getProfile(userReq as any);

      expect(result.id).toBe('user-1');
      expect(result.crops).toEqual(['Wheat', 'Rice']);
    });

    it('should not expose internal fields', async () => {
      userService.getProfile.mockResolvedValue({ ...mockUser, crops: [] });

      const result = await controller.getProfile(userReq as any);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('tokenVersion');
    });

    it('should include all expected public fields', async () => {
      userService.getProfile.mockResolvedValue({ ...mockUser, crops: [] });

      const result = await controller.getProfile(userReq as any);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('mobileNumber');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('district');
      expect(result).toHaveProperty('block');
      expect(result).toHaveProperty('languagePreference');
      expect(result).toHaveProperty('verificationStatus');
      expect(result).toHaveProperty('role');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('consentGiven');
      expect(result).toHaveProperty('crops');
    });
  });

  // ─── PATCH /users/me ────────────────────────────────────────────────────────

  describe('PATCH /users/me', () => {
    it('should call updateProfile with user id and dto', async () => {
      const updatedUser = { ...mockUser, name: 'Suresh Kumar', crops: [] };
      userService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(
        userReq as any,
        { name: 'Suresh Kumar' } as any,
      );

      expect(result.user.name).toBe('Suresh Kumar');
      expect(userService.updateProfile).toHaveBeenCalledWith(
        'user-1',
        { name: 'Suresh Kumar' },
      );
    });

    it('should pass through service errors', async () => {
      userService.updateProfile.mockRejectedValue(new Error('Update failed'));

      await expect(
        controller.updateProfile(userReq as any, { name: 'Bad' } as any),
      ).rejects.toThrow('Update failed');
    });

    it('should update crops via updateProfile', async () => {
      const updated = { ...mockUser, crops: ['Cotton', 'Soybean'] };
      userService.updateProfile.mockResolvedValue(updated);

      await controller.updateProfile(userReq as any, {
        crops: ['Cotton', 'Soybean'],
      } as any);

      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', {
        crops: ['Cotton', 'Soybean'],
      });
    });
  });

  // ─── PATCH /users/me/crops ──────────────────────────────────────────────────

  describe('PATCH /users/me/crops', () => {
    it('should replace crop list and return updated crops', async () => {
      userService.updateCropDetails.mockResolvedValue(['Soybean', 'Cotton']);

      const result = await controller.updateCropDetails(
        userReq as any,
        { crops: ['Soybean', 'Cotton'] } as any,
      );

      expect(result.crops).toEqual(['Soybean', 'Cotton']);
      expect(userService.updateCropDetails).toHaveBeenCalledWith('user-1', {
        crops: ['Soybean', 'Cotton'],
      });
    });

    it('should pass through service errors', async () => {
      userService.updateCropDetails.mockRejectedValue(new Error('Crop update failed'));

      await expect(
        controller.updateCropDetails(userReq as any, { crops: [] } as any),
      ).rejects.toThrow('Crop update failed');
    });

    it('should allow clearing all crops by passing empty array', async () => {
      userService.updateCropDetails.mockResolvedValue([]);

      const result = await controller.updateCropDetails(userReq as any, { crops: [] } as any);

      expect(result.crops).toEqual([]);
    });
  });
});