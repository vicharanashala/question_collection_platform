import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('admin_config')
export class AdminConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index('idx_admin_config_key')
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}