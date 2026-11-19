import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

describe('AdminService wallet listing and summary', () => {
  let service: AdminService;
  let walletRepo: { findAdminPage: jest.Mock; getAdminTotals: jest.Mock };

  beforeEach(async () => {
    walletRepo = { findAdminPage: jest.fn(), getAdminTotals: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: REPOSITORY_TOKENS.Wallet, useValue: walletRepo }],
    })
      .useMocker(() => ({}))
      .compile();
    service = module.get(AdminService);
  });

  describe('listAllWallets()', () => {
    it('returns the page with each owner as user and the total across all pages', async () => {
      const owner = { id: 'u-1', name: 'Ravi', isTester: false };
      walletRepo.findAdminPage.mockResolvedValue({
        items: [{ id: 'w-1', userId: 'u-1', balance: 5, totalEarned: 7, totalWithdrawn: 2, owner }],
        total: 55,
      });

      const result = await service.listAllWallets({ page: 2, limit: 30, search: '  ravi ', tester: 'exclude' });

      expect(walletRepo.findAdminPage).toHaveBeenCalledWith(
        { userId: undefined, search: 'ravi', state: undefined, tester: 'exclude', anveshanScope: undefined },
        { page: 2, limit: 30, sortBy: 'createdAt', sortOrder: 'DESC' },
      );
      expect(result).toEqual({
        items: [{ id: 'w-1', userId: 'u-1', balance: 5, totalEarned: 7, totalWithdrawn: 2, user: owner }],
        total: 55,
        page: 2,
        limit: 30,
        pages: 2,
      });
    });

    it('passes the requested sort through', async () => {
      walletRepo.findAdminPage.mockResolvedValue({ items: [], total: 0 });

      await service.listAllWallets({ sortBy: 'balance', sortOrder: 'ASC' });

      expect(walletRepo.findAdminPage).toHaveBeenCalledWith(
        expect.anything(),
        { page: 1, limit: 50, sortBy: 'balance', sortOrder: 'ASC' },
      );
    });
  });

  describe('getWalletsSummary()', () => {
    const totals = { totalWallets: 55, totalBalance: 2, totalDistributed: 2, totalWithdrawn: 0 };

    it('reports totals for every wallet when no filter is set', async () => {
      walletRepo.getAdminTotals.mockResolvedValue(totals);

      const result = await service.getWalletsSummary({});

      expect(result).toEqual({ ...totals, appliedFilters: {}, isFiltered: false });
    });

    it('applies the same filters as the list and echoes the ones in effect', async () => {
      walletRepo.getAdminTotals.mockResolvedValue({ ...totals, totalWallets: 3 });

      const result = await service.getWalletsSummary({ search: ' ravi ', tester: 'only', anveshanScope: 'exclude' });

      expect(walletRepo.getAdminTotals).toHaveBeenCalledWith({
        userId: undefined,
        search: 'ravi',
        state: undefined,
        tester: 'only',
        anveshanScope: 'exclude',
      });
      expect(result.appliedFilters).toEqual({ search: 'ravi', tester: 'only', anveshanScope: 'exclude' });
      expect(result.isFiltered).toBe(true);
      expect(result.totalWallets).toBe(3);
    });

    it('treats a blank search as no filter', async () => {
      walletRepo.getAdminTotals.mockResolvedValue(totals);

      const result = await service.getWalletsSummary({ search: '   ' });

      expect(result.appliedFilters).toEqual({});
      expect(result.isFiltered).toBe(false);
    });
  });
});
