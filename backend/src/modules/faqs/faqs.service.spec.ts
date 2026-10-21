import { Test } from '@nestjs/testing';
import { FaqsService } from './faqs.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

describe('FaqsService admin list search', () => {
  let service: FaqsService;
  const repo = { findAndCount: jest.fn() };

  beforeEach(async () => {
    repo.findAndCount.mockReset().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const module = await Test.createTestingModule({
      providers: [FaqsService, { provide: REPOSITORY_TOKENS.Faq, useValue: repo }],
    }).compile();
    service = module.get(FaqsService);
  });

  it('matches the search text against question and answer, ignoring case', async () => {
    await service.findAllPaginated({ search: 'refund (fees)', category: 'payment' });

    const [filter] = repo.findAndCount.mock.calls[0];
    expect(filter.category).toBe('payment');
    expect(filter.$or).toEqual([
      { question: { $regex: 'refund \\(fees\\)', $options: 'i' } },
      { answer: { $regex: 'refund \\(fees\\)', $options: 'i' } },
    ]);
  });

  it('adds no search condition when the search is empty', async () => {
    await service.findAllPaginated({});

    expect(repo.findAndCount.mock.calls[0][0].$or).toBeUndefined();
  });
});
