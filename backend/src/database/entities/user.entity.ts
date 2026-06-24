import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { VerificationStatus, UserCategory, UserRole } from '../../common/enums';
import { Wallet } from './wallet.entity';
import { Question } from './question.entity';
import { UserCropDetail } from './user-crop-detail.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { Notification } from './notification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mobile_number', type: 'varchar', length: 15, unique: true })
  @Index('idx_users_mobile')
  mobileNumber: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  @Index('idx_users_role')
  role: UserRole;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index('idx_users_category')
  category: UserCategory | null;

  @Column({ type: 'varchar', length: 100 })
  @Index('idx_users_state')
  state: string;

  @Column({ type: 'varchar', length: 100 })
  district: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  block: string | null;

  @Column({ name: 'language_preference', type: 'varchar', length: 50 })
  languagePreference: string;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  @Column({ name: 'otp_hash', type: 'varchar', length: 255, nullable: true })
  otpHash: string | null;

  @Column({ name: 'otp_expires_at', type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 30,
    default: VerificationStatus.PENDING,
  })
  @Index('idx_users_verification_status')
  verificationStatus: VerificationStatus;

  @Column({ name: 'suspended_at', type: 'timestamp', nullable: true })
  suspendedAt: Date | null;

  @Column({ name: 'suspended_until', type: 'timestamp', nullable: true })
  suspendedUntil: Date | null;

  @Column({ name: 'suspended_reason', type: 'varchar', length: 500, nullable: true })
  suspendedReason: string | null;

  @Column({ name: 'banned_at', type: 'timestamp', nullable: true })
  bannedAt: Date | null;

  @Column({ name: 'banned_reason', type: 'varchar', length: 500, nullable: true })
  bannedReason: string | null;

  @Column({ name: 'profile_data', type: 'jsonb', nullable: true })
  profileData: Record<string, unknown> | null;

  @Column({ name: 'consent_given', type: 'boolean', default: false })
  consentGiven: boolean;

  @Column({ name: 'consent_timestamp', type: 'timestamp', nullable: true })
  consentTimestamp: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'expo_push_token', type: 'varchar', length: 255, nullable: true })
  expoPushToken: string | null;

  /** RazorpayX Contact ID — created once per user, reused for all fund accounts and payouts */
  @Column({ name: 'razorpay_contact_id', type: 'varchar', length: 100, nullable: true })
  razorpayContactId: string | null;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Question, (question) => question.user)
  questions: Question[];

  @OneToMany(() => UserCropDetail, (crop) => crop.user)
  cropDetails: UserCropDetail[];

  @OneToMany(() => WithdrawalRequest, (wr) => wr.user)
  withdrawalRequests: WithdrawalRequest[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];
}