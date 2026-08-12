import { BaseRepository } from '../abstractions/base.repository';
import { Faq } from '../entities';
import { FaqCategory } from '../../classes/enums';

export interface IFaqRepository extends BaseRepository<Faq> {
  findByCategory(category: FaqCategory): Promise<Faq[]>;
  findVisible(category?: FaqCategory): Promise<Faq[]>;
  getStats(category?: FaqCategory): Promise<{ total: number; visible: number; hidden: number }>;
}