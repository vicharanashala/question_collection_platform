import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VerificationStatus, UserCategory, UserRole } from '../../../classes/enums';

export type UserDocument = User & Document;

@Schema({ collection: 'users', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class User {
  _id: Types.ObjectId;

  @Prop({ name: 'mobileNumber', type: String, unique: true, index: true, default: null })
  mobileNumber: string | null;

  @Prop({ name: 'username', type: String, unique: true, sparse: true, index: true })
  username: string | null;

  @Prop({ default: '' })
  name: string;

  @Prop({ enum: UserRole, index: true, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: String, enum: UserCategory, index: true, default: null })
  category: UserCategory | null;

  @Prop({ name: 'organisationType', type: String, index: true, default: null })
  organisationType: string | null;

  @Prop({ default: '', index: true })
  state: string;

  @Prop({ default: '' })
  district: string;

  @Prop({ type: String, default: null })
  block: string | null;

  @Prop({ type: String, default: null })
  village: string | null;

  @Prop({ type: String, default: null })
  kvk: string | null;

  @Prop({ name: 'languagePreference', default: 'en' })
  languagePreference: string;

  @Prop({ name: 'tokenVersion', default: 0 })
  tokenVersion: number;

  @Prop({ name: 'otpHash', type: String, default: null })
  otpHash: string | null;

  @Prop({ name: 'otpExpiresAt', type: Date, default: null })
  otpExpiresAt: Date | null;

  @Prop({
    name: 'verificationStatus',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
    index: true,
  })
  verificationStatus: VerificationStatus;

  @Prop({ name: 'suspendedAt', type: Date, default: null })
  suspendedAt: Date | null;

  @Prop({ name: 'suspendedUntil', type: Date, default: null })
  suspendedUntil: Date | null;

  @Prop({ name: 'suspendedReason', type: String, default: null })
  suspendedReason: string | null;

  @Prop({ name: 'bannedAt', type: Date, default: null })
  bannedAt: Date | null;

  @Prop({ name: 'bannedReason', type: String, default: null })
  bannedReason: string | null;

  @Prop({ name: 'profileData', type: Object, default: null })
  profileData: Record<string, unknown> | null;

  @Prop({ type: Number, default: null })
  age: number | null;

  @Prop({ type: String, default: null })
  gender: string | null;

  @Prop({ name: 'farmSize', type: String, default: null })
  farmSize: string | null;

  @Prop({ type: String, default: null })
  season: string | null;

  @Prop({ name: 'cropType', type: String, default: null })
  cropType: string | null;

  @Prop({ name: 'courseName', type: String, default: null })
  courseName: string | null;

  @Prop({ name: 'collegeName', type: String, default: null })
  collegeName: string | null;

  @Prop({ name: 'universityName', type: String, default: null })
  universityName: string | null;

  @Prop({ name: 'organizationName', type: String, default: null })
  organizationName: string | null;

  @Prop({ name: 'organizationRole', type: String, default: null })
  organizationRole: string | null;

  @Prop({ name: 'numberOfFarmers', type: Number, default: null })
  numberOfFarmers: number | null;

  @Prop({ name: 'organizationState', type: String, default: null })
  organizationState: string | null;

  @Prop({ name: 'organizationDistrict', type: String, default: null })
  organizationDistrict: string | null;

  @Prop({ name: 'organizationBlock', type: String, default: null })
  organizationBlock: string | null;

  @Prop({ name: 'organizationVillage', type: String, default: null })
  organizationVillage: string | null;

  @Prop({ name: 'consentGiven', default: false })
  consentGiven: boolean;

  @Prop({ name: 'consentTimestamp', type: Date, default: null })
  consentTimestamp: Date | null;

  @Prop({ name: 'lastLoginAt', type: Date, default: null })
  lastLoginAt: Date | null;

  @Prop({ name: 'expoPushToken', type: String, default: null })
  expoPushToken: string | null;

  @Prop({ name: 'razorpayContactId', type: String, default: null })
  razorpayContactId: string | null;

  @Prop({ type: [String], default: [] })
  crops: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);