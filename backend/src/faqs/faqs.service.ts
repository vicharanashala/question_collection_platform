import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../database/entities/faq.entity';
import { CreateFaqDto, UpdateFaqDto, ToggleVisibilityDto, ListFaqsQueryDto } from './dto';

@Injectable()
export class FaqsService {
  constructor(
    @InjectRepository(Faq)
    private readonly faqRepo: Repository<Faq>,
  ) {}

  /** Public: return only visible FAQs ordered by display_order */
  async findAllVisible(query: ListFaqsQueryDto): Promise<Faq[]> {
    const qb = this.faqRepo
      .createQueryBuilder('faq')
      .where('faq.isVisible = :isVisible', { isVisible: true });

    if (query.category) {
      qb.andWhere('faq.category = :category', { category: query.category });
    }

    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(faq.question ILIKE :term OR faq.answer ILIKE :term)',
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
    const qb = this.faqRepo.createQueryBuilder('faq');
    if (category) qb.andWhere('faq.category = :category', { category });
    const all = await qb.getMany();
    return {
      total: all.length,
      visible: all.filter((f) => f.isVisible).length,
      hidden: all.filter((f) => !f.isVisible).length,
    };
  }

  /** Admin: return paginated FAQ list */
  async findAllPaginated(query: ListFaqsQueryDto): Promise<{
    items: Faq[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const { page = 1, limit = 20, category, search, sortBy = 'displayOrder', sortOrder = 'ASC' } = query;

    const qb = this.faqRepo.createQueryBuilder('faq');

    if (category) {
      qb.andWhere('faq.category = :category', { category });
    }

    if (search) {
      const term = `%${search}%`;
      qb.andWhere(
        '(faq.question ILIKE :term OR faq.answer ILIKE :term)',
        { term },
      );
    }

    const sortCol =
      sortBy === 'question' ? 'faq.question'
        : sortBy === 'createdAt' ? 'faq.createdAt'
        : sortBy === 'updatedAt' ? 'faq.updatedAt'
        : 'faq.displayOrder';
    qb.orderBy(sortCol, sortOrder ?? 'ASC');

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async create(dto: CreateFaqDto): Promise<Faq> {
    const faq = this.faqRepo.create({
      question: dto.question,
      answer: dto.answer,
      category: dto.category ?? 'general',
      isVisible: dto.isVisible ?? true,
    });
    return this.faqRepo.save(faq);
  }

  async update(id: string, dto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    if (dto.question !== undefined) faq.question = dto.question;
    if (dto.answer !== undefined) faq.answer = dto.answer;
    if (dto.category !== undefined) faq.category = dto.category;
    if (dto.isVisible !== undefined) faq.isVisible = dto.isVisible;
    return this.faqRepo.save(faq);
  }

  async toggleVisibility(id: string, dto: ToggleVisibilityDto): Promise<Faq> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    faq.isVisible = dto.isVisible;
    return this.faqRepo.save(faq);
  }

  async delete(id: string): Promise<void> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    await this.faqRepo.remove(faq);
  }
}