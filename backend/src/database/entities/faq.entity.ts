import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type FaqCategory = 'account' | 'payment' | 'question' | 'general';

@Entity('faqs')
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'varchar', length: 50, default: 'general' })
  @Index('idx_faqs_category')
  category: FaqCategory;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  @Index('idx_faqs_is_visible')
  isVisible: boolean;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  @Index('idx_faqs_display_order')
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}