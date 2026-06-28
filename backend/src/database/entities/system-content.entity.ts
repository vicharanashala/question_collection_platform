import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SystemContentType {
  TERMS_OF_SERVICE = 'terms_of_service',
  PRIVACY_POLICY = 'privacy_policy',
}

@Entity('system_content')
@Index('idx_system_content_type', ['type'], { unique: true })
export class SystemContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SystemContentType,
    unique: true,
  })
  type: SystemContentType;

  /** Human-readable title, e.g. "Terms of Service" */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** Short description shown on the registration consent screen */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /**
   * Full markdown content.
   * Admin uploads a .md file; content is stored and rendered as-is on the mobile app.
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** When true, this content is active and shown to users */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}