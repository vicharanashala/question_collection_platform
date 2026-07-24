import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ReportReply } from './report-reply.entity';
import { ReportCategory, ReportPriority, ReportStatus } from '../../common/enums';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_reports_user_id')
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  category: ReportCategory;

  @Column({ type: 'varchar', length: 20, default: ReportStatus.OPEN })
  @Index('idx_reports_status')
  status: ReportStatus;

  @Column({ type: 'varchar', length: 20, default: ReportPriority.MEDIUM })
  priority: ReportPriority;

  /** Optional link to a related entity (e.g. question ID or withdrawal ID) */
  @Column({ name: 'related_entity_id', type: 'uuid', nullable: true })
  relatedEntityId: string | null;

  /** Type of related entity: 'question' | 'withdrawal' | 'wallet' */
  @Column({ name: 'related_entity_type', type: 'varchar', length: 50, nullable: true })
  relatedEntityType: string | null;

  @ManyToOne(() => User, (u) => u.reports)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => ReportReply, (r) => r.report)
  replies: ReportReply[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}