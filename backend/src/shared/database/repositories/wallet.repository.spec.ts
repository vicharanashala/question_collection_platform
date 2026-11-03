import { Types } from 'mongoose';
import { MongoWalletRepository, walletScopeStages } from './impl/mongo/MongoWallet.repository';

const ownerMatchOf = (stages: ReturnType<typeof walletScopeStages>) =>
  (stages[stages.length - 1] as { $match: Record<string, unknown> }).$match;

describe('walletScopeStages()', () => {
  it('without filters keeps non-deleted wallets whose owner exists and is not deleted', () => {
    const stages = walletScopeStages({});

    expect(stages[0]).toEqual({ $match: { isDeleted: { $ne: true } } });
    expect(stages).toContainEqual({ $unwind: '$owner' });
    expect(ownerMatchOf(stages)).toEqual({ 'owner.isDeleted': { $ne: true } });
  });

  it('joins owners on the users _id so the lookup can use the index', () => {
    const stages = walletScopeStages({});

    expect(stages).toContainEqual({
      $lookup: { from: 'users', localField: 'ownerObjectId', foreignField: '_id', as: 'owner' },
    });
  });

  it('applies every filter to the owner', () => {
    const stages = walletScopeStages({
      userId: 'u-1',
      search: 'ravi.k',
      state: 'Kerala',
      tester: 'only',
      anveshanScope: 'exclude',
    });

    expect(stages[0]).toEqual({ $match: { isDeleted: { $ne: true }, userId: 'u-1' } });
    expect(ownerMatchOf(stages)).toEqual({
      'owner.isDeleted': { $ne: true },
      'owner.state': 'Kerala',
      $or: [
        { 'owner.name': { $regex: 'ravi\\.k', $options: 'i' } },
        { 'owner.mobileNumber': { $regex: 'ravi\\.k', $options: 'i' } },
      ],
      'owner.is_tester': true,
      'owner.isAnveshanUser': { $ne: true },
    });
  });

  it('maps "exclude" testers and "only" Anveshan users to the right conditions', () => {
    const match = ownerMatchOf(walletScopeStages({ tester: 'exclude', anveshanScope: 'only' }));

    expect(match['owner.is_tester']).toEqual({ $ne: true });
    expect(match['owner.isAnveshanUser']).toBe(true);
  });
});

describe('MongoWalletRepository admin queries', () => {
  let aggregate: jest.Mock;
  let repo: MongoWalletRepository;

  beforeEach(() => {
    aggregate = jest.fn();
    repo = new MongoWalletRepository({ aggregate } as never);
  });

  describe('findAdminPage()', () => {
    const walletId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const createdAt = new Date('2026-10-01T00:00:00Z');

    it('sorts, pages and maps wallets with their owner and transaction totals', async () => {
      aggregate.mockResolvedValue([
        {
          total: [{ count: 55 }],
          items: [
            {
              _id: walletId,
              userId: ownerId.toString(),
              balance: 12,
              totalEarned: 20,
              totalWithdrawn: 8,
              owner: {
                _id: ownerId,
                name: 'Ravi',
                mobileNumber: '9999999999',
                state: 'Kerala',
                district: 'Kollam',
                category: 'farmer',
                role: 'user',
                verificationStatus: 'verified',
                createdAt,
                is_tester: true,
              },
            },
          ],
        },
      ]);

      const result = await repo.findAdminPage(
        { state: 'Kerala' },
        { page: 2, limit: 30, sortBy: 'balance', sortOrder: 'ASC' },
      );

      const pipeline = aggregate.mock.calls[0][0];
      const { $facet } = pipeline[pipeline.length - 1];
      expect(pipeline.slice(0, -1)).toEqual(walletScopeStages({ state: 'Kerala' }));
      expect($facet.total).toEqual([{ $count: 'count' }]);
      expect($facet.items.slice(0, 3)).toEqual([
        { $sort: { balance: 1, _id: 1 } },
        { $skip: 30 },
        { $limit: 30 },
      ]);
      expect(result).toEqual({
        total: 55,
        items: [
          {
            id: walletId.toString(),
            userId: ownerId.toString(),
            balance: 12,
            totalEarned: 20,
            totalWithdrawn: 8,
            owner: {
              id: ownerId.toString(),
              name: 'Ravi',
              mobileNumber: '9999999999',
              state: 'Kerala',
              district: 'Kollam',
              category: 'farmer',
              role: 'user',
              verificationStatus: 'verified',
              createdAt,
              isTester: true,
            },
          },
        ],
      });
    });

    it('returns an empty page when nothing matches', async () => {
      aggregate.mockResolvedValue([{ total: [], items: [] }]);

      const result = await repo.findAdminPage({}, { page: 1, limit: 30, sortBy: 'createdAt', sortOrder: 'DESC' });

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('getAdminTotals()', () => {
    it('sums count, balance, rewards and withdrawals across the scope', async () => {
      aggregate.mockResolvedValue([
        { _id: null, totalWallets: 55, totalBalance: 120, totalDistributed: 200, totalWithdrawn: 80 },
      ]);

      const result = await repo.getAdminTotals({ tester: 'exclude' });

      const pipeline = aggregate.mock.calls[0][0];
      expect(pipeline.slice(0, walletScopeStages({}).length)).toEqual(walletScopeStages({ tester: 'exclude' }));
      expect(pipeline[pipeline.length - 1]).toEqual({
        $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
          totalDistributed: { $sum: '$totalEarned' },
          totalWithdrawn: { $sum: '$totalWithdrawn' },
        },
      });
      expect(result).toEqual({ totalWallets: 55, totalBalance: 120, totalDistributed: 200, totalWithdrawn: 80 });
    });

    it('returns zeros when no wallet is in scope', async () => {
      aggregate.mockResolvedValue([]);

      await expect(repo.getAdminTotals({ search: 'nobody' })).resolves.toEqual({
        totalWallets: 0,
        totalBalance: 0,
        totalDistributed: 0,
        totalWithdrawn: 0,
      });
    });
  });
});
