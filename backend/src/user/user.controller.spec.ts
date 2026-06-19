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
  getCropDetails: jest.fn(),
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
    it('should return user profile with crop details', async () => {
      const crops = [
        { id: 'crop-1', cropName: 'Wheat', season: 'Rabi' },
        { id: 'crop-2', cropName: 'Rice', season: 'Kharif' },
      ];
      userService.getProfile.mockResolvedValue(mockUser);
      userService.getCropDetails.mockResolvedValue(crops);

      const result = await controller.getProfile(userReq as any);

      expect(result.user.id).toBe('user-1');
      expect(result.user.mobileNumber).toBe('9876543210');
      expect(result.user.name).toBe('Ramesh Kumar');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.crops).toEqual(crops);
    });

    it('should not expose internal fields on the user object', async () => {
      userService.getProfile.mockResolvedValue(mockUser);
      userService.getCropDetails.mockResolvedValue([]);

      const result = await controller.getProfile(userReq as any);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('tokenVersion');
    });

    it('should include all expected public fields', async () => {
      userService.getProfile.mockResolvedValue(mockUser);
      userService.getCropDetails.mockResolvedValue([]);

      const result = await controller.getProfile(userReq as any);

      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('mobileNumber');
      expect(result.user).toHaveProperty('name');
      expect(result.user).toHaveProperty('category');
      expect(result.user).toHaveProperty('state');
      expect(result.user).toHaveProperty('district');
      expect(result.user).toHaveProperty('block');
      expect(result.user).toHaveProperty('languagePreference');
      expect(result.user).toHaveProperty('verificationStatus');
      expect(result.user).toHaveProperty('role');
      expect(result.user).toHaveProperty('createdAt');
      expect(result.user).toHaveProperty('consentGiven');
    });
  });

  // ─── PATCH /users/me ────────────────────────────────────────────────────────

  describe('PATCH /users/me', () => {
    it('should call updateProfile with user id and dto', async () => {
      const updatedUser = { ...mockUser, name: 'Suresh Kumar' };
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

    it('should update multiple fields in a single call', async () => {
      const updated = { ...mockUser, name: 'Changed', state: 'Karnataka' };
      userService.updateProfile.mockResolvedValue(updated);

      await controller.updateProfile(userReq as any, {
        name: 'Changed',
        state: 'Karnataka',
      } as any);

      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', {
        name: 'Changed',
        state: 'Karnataka',
      });
    });
  });

  // ─── PATCH /users/me/crops ──────────────────────────────────────────────────

  describe('PATCH /users/me/crops', () => {
    it('should replace crop list and return updated crops', async () => {
      const newCrops = [
        { cropName: 'Soybean', season: 'Rabi' },
        { cropName: 'Cotton', season: 'Kharif' },
      ];
      userService.updateCropDetails.mockResolvedValue(newCrops);

      const result = await controller.updateCropDetails(
        userReq as any,
        { crops: newCrops } as any,
      );

      expect(result.crops).toHaveLength(2);
      expect(userService.updateCropDetails).toHaveBeenCalledWith('user-1', { crops: newCrops });
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