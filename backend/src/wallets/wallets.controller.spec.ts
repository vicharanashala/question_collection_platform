import { Test, TestingModule } from '@nestjs/testing';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PayoutMethod } from '../common/enums';

const mockWalletsService = () => ({
  getBalance: jest.fn(),
  getTransactions: jest.fn(),
  getRewardTier: jest.fn(),
  withdraw: jest.fn(),
});

describe('WalletsController', () => {
  let controller: WalletsController;
  let service: ReturnType<typeof mockWalletsService>;

  const userReq = { user: { id: 'user-1', mobileNumber: '9876543210', role: 'user' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        { provide: WalletsService, useFactory: mockWalletsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WalletsController>(WalletsController);
    service = module.get(WalletsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── GET /wallets/me ────────────────────────────────────────────────────────

  describe('GET /wallets/me', () => {
    it('should return balance and currency', async () => {
      service.getBalance.mockResolvedValue({ balance: 500, currency: 'INR' });

      const result = await controller.getBalance(userReq as any);

      expect(result).toEqual({ balance: 500, currency: 'INR' });
      expect(service.getBalance).toHaveBeenCalledWith('user-1');
    });

    it('should pass through service errors', async () => {
      service.getBalance.mockRejectedValue(new Error('Wallet not found'));

      await expect(controller.getBalance(userReq as any)).rejects.toThrow('Wallet not found');
    });
  });

  // ─── GET /wallets/me/transactions ───────────────────────────────────────────

  describe('GET /wallets/me/transactions', () => {
    it('should return paginated transactions', async () => {
      const txns = {
        transactions: [
          { id: 'tx-1', type: 'credit', amount: 100, balanceAfter: 500 },
        ],
        total: 1,
      };
      service.getTransactions.mockResolvedValue(txns);

      const result = await controller.getTransactions(userReq as any, '1', '20');

      expect(result.transactions).toHaveLength(1);
      expect(service.getTransactions).toHaveBeenCalledWith('user-1', { page: 1, limit: 20 });
    });

    it('should parse string query params to numbers', async () => {
      service.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

      await controller.getTransactions(userReq as any, '3', '50');

      expect(service.getTransactions).toHaveBeenCalledWith('user-1', { page: 3, limit: 50 });
    });

    it('should omit pagination params when not provided', async () => {
      service.getTransactions.mockResolvedValue({ transactions: [], total: 0 });

      await controller.getTransactions(userReq as any, undefined, undefined);

      expect(service.getTransactions).toHaveBeenCalledWith('user-1', {
        page: undefined,
        limit: undefined,
      });
    });

    it('should pass through service errors', async () => {
      service.getTransactions.mockRejectedValue(new Error('Wallet not found'));

      await expect(
        controller.getTransactions(userReq as any, '1', '20'),
      ).rejects.toThrow('Wallet not found');
    });
  });

  // ─── GET /wallets/me/tier ───────────────────────────────────────────────────

  describe('GET /wallets/me/tier', () => {
    it('should return tier info for the provided approvedCount', async () => {
      const tierInfo = {
        reward: 5,
        maxApproved: 250,
        nextTier: { reward: 10, maxApproved: 500 },
      };
      service.getRewardTier.mockReturnValue(tierInfo);

      const result = await controller.getRewardTier(userReq as any, '100');

      expect(result).toEqual(tierInfo);
      expect(service.getRewardTier).toHaveBeenCalledWith(100);
    });

    it('should use approvedCount=0 when query param is omitted', async () => {
      service.getRewardTier.mockReturnValue({ reward: 1, maxApproved: 25, nextTier: { reward: 5, maxApproved: 250 } });

      await controller.getRewardTier(userReq as any, undefined as unknown as string);

      expect(service.getRewardTier).toHaveBeenCalledWith(0);
    });

    it('should parse non-integer strings via parseInt', async () => {
      service.getRewardTier.mockReturnValue({ reward: 10, maxApproved: 500, nextTier: null });

      await controller.getRewardTier(userReq as any, '251');

      expect(service.getRewardTier).toHaveBeenCalledWith(251);
    });
  });

  // ─── POST /wallets/withdraw ─────────────────────────────────────────────────

  describe('POST /wallets/withdraw', () => {
    const withdrawDto = {
      amount: 100,
      payoutMethod: PayoutMethod.UPI,
      payoutDetails: { upiId: 'test@upi' },
    };

    it('should call withdraw on the service and return the request', async () => {
      const withdrawalRequest = {
        id: 'wd-1',
        amount: 100,
        status: 'pending',
        payoutMethod: PayoutMethod.UPI,
      };
      service.withdraw.mockResolvedValue(withdrawalRequest);

      const result = await controller.withdraw(userReq as any, withdrawDto as any);

      expect(result).toEqual(withdrawalRequest);
      expect(service.withdraw).toHaveBeenCalledWith('user-1', withdrawDto);
    });

    it('should pass through service errors', async () => {
      service.withdraw.mockRejectedValue(new Error('Insufficient balance'));

      await expect(controller.withdraw(userReq as any, withdrawDto as any)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('should forward all payout methods', async () => {
      service.withdraw.mockResolvedValue({ id: 'wd-bank', status: 'pending' });

      await controller.withdraw(
        userReq as any,
        { amount: 500, payoutMethod: PayoutMethod.BANK_TRANSFER, payoutDetails: { accountNumber: '123' } } as any,
      );

      expect(service.withdraw).toHaveBeenCalledWith('user-1', expect.objectContaining({
        payoutMethod: PayoutMethod.BANK_TRANSFER,
      }));
    });
  });
});