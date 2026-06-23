import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { QuestionStatus, MediaType } from '../../common/enums';
import { User } from './user.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_questions_user_id')
  userId: string;

  @Column({ name: 'language', type: 'varchar', length: 50, default: 'en' })
  @Index('idx_questions_language')
  language: string;

  @Column({ type: 'text', array: true, default: '{}' })
  @Index('idx_questions_domains')
  domains: string[];

  @Column({ type: 'varchar', length: 50 })
  season: string;

  @Column({ name: 'crop_type', type: 'varchar', length: 255 })
  @Index('idx_questions_crop_type')
  cropType: string;

  @Column({ name: 'agro_climatic_zone', type: 'varchar', length: 255, nullable: true })
  agroClimaticZone: string | null;

  @Column({ type: 'varchar', length: 100 })
  @Index('idx_questions_state')
  state: string;

  @Column({ type: 'varchar', length: 100 })
  district: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  block: string | null;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({ name: 'media_type', type: 'varchar', length: 10, default: MediaType.NONE })
  mediaType: MediaType;

  @Column({ name: 'media_urls', type: 'jsonb', nullable: true })
  mediaUrls: string[] | null;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: QuestionStatus.PENDING })
  @Index('idx_questions_status')
  status: QuestionStatus;

  @Column({ name: 'duplicate_flag', type: 'boolean', default: false })
  duplicateFlag: boolean;

  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  @Index('idx_questions_duplicate_of')
  duplicateOfId: string | null;

  @Column({ name: 'edit_window_closes_at', type: 'timestamp', nullable: true })
  editWindowClosesAt: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamp' })
  @Index('idx_questions_submitted_at')
  submittedAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId: string | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'held_reason', type: 'varchar', length: 500, nullable: true })
  heldReason: string | null;

  @Column({ name: 'approval_reason', type: 'varchar', length: 500, nullable: true })
  approvalReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.questions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User | null;
}