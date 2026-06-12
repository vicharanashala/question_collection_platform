import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_crop_details')
export class UserCropDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_user_crops_user_id')
  userId: string;

  @Column({ name: 'crop_name', type: 'varchar', length: 255 })
  cropName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  season: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.cropDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}