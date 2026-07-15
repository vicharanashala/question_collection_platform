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

  /** Admin: return all FAQs, optionally filtered */
  async findAll(query: ListFaqsQueryDto): Promise<Faq[]> {
    const qb = this.faqRepo.createQueryBuilder('faq');

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