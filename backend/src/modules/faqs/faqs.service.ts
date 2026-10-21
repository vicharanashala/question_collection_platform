import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IFaqRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { CreateFaqDto, UpdateFaqDto, ToggleVisibilityDto, ListFaqsQueryDto, ReorderFaqsDto } from './dto';
import { escapeRegex } from '../../shared/database/abstractions/mongo-utils';
import { Faq } from '@/shared/database/mongodb/schemas/faq.schema';

@Injectable()
export class FaqsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.Faq)
    private readonly faqRepo: IFaqRepository,
  ) {}

  /** Returns visible FAQs for the given audience, ordered by display order. */
  async findAllVisible(
    query: ListFaqsQueryDto,
    user: { isAnveshanUser?: boolean },
  ): Promise<Faq[]> {
    return this.faqRepo.findVisible({
      category: query.category,
      search: query.search,
      isAnveshanUser: user.isAnveshanUser,
    });
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

  async create(dto: CreateFaqDto): Promise<Faq> {
    const data = await this.faqRepo.create(dto as never);
    return data;
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

  // Rearranges the given FAQs within the slots they already occupy and renumbers the whole list.
  async reorder(dto: ReorderFaqsDto): Promise<void> {
    const all = await this.faqRepo.findAllIdsOrdered();
    const known = new Set(all);
    if (dto.ids.some((id) => !known.has(id))) {
      throw new BadRequestException('One or more FAQs do not exist');
    }
    const moving = new Set(dto.ids);
    const queue = [...dto.ids];
    const next = all.map((id) => (moving.has(id) ? (queue.shift() as string) : id));
    await this.faqRepo.setDisplayOrder(next);
  }

  async findAllPaginated(query: ListFaqsQueryDto): Promise<unknown> {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.search) {
      const regex = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [{ question: regex }, { answer: regex }];
    }

    const sortBy = query.sortBy ?? 'displayOrder';
    const sortOrder: 1 | -1 = (query.sortOrder ?? 'ASC') === 'ASC' ? 1 : -1;
    if (query.userSort === 'anveshan' || query.userSort === 'user') filter.audience = query.userSort;

    const result = await this.faqRepo.findAndCount(filter, {
      pagination: { page: query.page ?? 1, limit: query.limit ?? 20, sort: this.buildSort(sortBy, sortOrder) },
    });

    return {
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.totalPages,
    };
  }

  // Uses creation date as a tie breaker when sorting by display order.
  private buildSort(sortBy: string, sortOrder: 1 | -1): Record<string, 1 | -1> {
    return sortBy === 'displayOrder' ? { displayOrder: sortOrder, createdAt: sortOrder } : { [sortBy]: sortOrder };
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