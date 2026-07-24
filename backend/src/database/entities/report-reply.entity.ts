import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Report } from './report.entity';
import { User } from './user.entity';

@Entity('report_replies')
export class ReportReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  @Index('idx_report_replies_report_id')
  reportId: string;

  /** The admin/curator who sent this reply */
  @Column({ name: 'admin_id', type: 'uuid' })
  @Index('idx_report_replies_admin_id')
  adminId: string;

  @Column({ type: 'text' })
  message: string;

  @ManyToOne(() => Report, (r) => r.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}