import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IFaqRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { CreateFaqDto, UpdateFaqDto, ToggleVisibilityDto, ListFaqsQueryDto } from './dto';

@Injectable()
export class FaqsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.Faq)
    private readonly faqRepo: IFaqRepository,
  ) {}

  /** Public: return only visible FAQs ordered by display_order */
  async findAllVisible(query: ListFaqsQueryDto): Promise<unknown[]> {
    const qb = this.faqRepo.createQueryBuilder('faq');
    qb.where('faq.isVisible = :isVisible', { isVisible: true });

    if (query.category) {
      qb.andWhere('faq.category = :category', { category: query.category });
    }

    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        "(faq.question ILIKE :term OR faq.answer ILIKE :term)",
        { term },
      );
    }

    return qb
      .orderBy('faq.displayOrder', 'ASC')
      .addOrderBy('faq.createdAt', 'ASC')
      .getMany();
  }

  /** Admin: FAQ counts (used for stats row) */
  async getStats(category?: string): Promise<{ total: number; visible: number; hidden: number }> {
    return this.faqRepo.getStats(category as never);
  }

  /** Admin: list all (including hidden) */
  async findAll(query: ListFaqsQueryDto): Promise<unknown[]> {
    const qb = this.faqRepo.createQueryBuilder('faq');

    if (query.category) {
      qb.andWhere('faq.category = :category', { category: query.category });
    }

    return qb
      .orderBy('faq.displayOrder', 'ASC')
      .addOrderBy('faq.createdAt', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<unknown> {
    const faq = await this.faqRepo.findById(id);
    if (!faq) throw new NotFoundException('FAQ not found');
    return faq;
  }

  async create(dto: CreateFaqDto): Promise<unknown> {
    return this.faqRepo.create(dto as never);
  }

  async update(id: string, dto: UpdateFaqDto): Promise<unknown> {
    const updated = await this.faqRepo.update(id, dto as never);
    if (!updated) throw new NotFoundException('FAQ not found');
    return updated;
  }

  async toggleVisibility(id: string, dto: ToggleVisibilityDto): Promise<unknown> {
    const updated = await this.faqRepo.update(id, { isVisible: dto.isVisible } as never);
    if (!updated) throw new NotFoundException('FAQ not found');
    return updated;
  }

  async findAllPaginated(query: ListFaqsQueryDto): Promise<unknown> {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;

    const sortBy = query.sortBy ?? 'displayOrder';
    const sortOrder: 1 | -1 = (query.sortOrder ?? 'ASC') === 'ASC' ? 1 : -1;

    const result = await this.faqRepo.findAndCount(filter, {
      pagination: { page: query.page ?? 1, limit: query.limit ?? 20, sort: { [sortBy]: sortOrder } },
    });

    return {
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.totalPages,
    };
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.faqRepo.delete(id);
    if (!deleted) throw new NotFoundException('FAQ not found');
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.faqRepo.delete(id);
    if (!deleted) throw new NotFoundException('FAQ not found');
  }
}