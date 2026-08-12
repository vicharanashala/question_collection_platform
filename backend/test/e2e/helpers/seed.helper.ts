import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { REPOSITORY_TOKENS, IUserRepository, IWalletRepository, IAdminConfigRepository } from '../../../src/shared/database/repositories';
import { User } from '../../../src/shared/database/entities';

const testUsers = [
  {
    mobileNumber: '9000000001',
    name: 'Test Farmer',
    username: 'test_farmer_seed1',
    category: 'farmer',
    state: 'Maharashtra',
    district: 'Pune',
    role: 'user',
    verificationStatus: 'verified',
    consentGiven: true,
    languagePreference: 'mr',
    tokenVersion: 0,
  },
  {
    mobileNumber: '9000000002',
    name: 'Test Student',
    username: 'test_student_seed2',
    category: 'student',
    state: 'Karnataka',
    district: 'Bengaluru',
    role: 'user',
    verificationStatus: 'verified',
    consentGiven: true,
    languagePreference: 'kn',
    tokenVersion: 0,
  },
  {
    mobileNumber: '9000000003',
    name: 'Test Curator',
    username: 'test_curator_seed3',
    category: 'volunteer',
    state: 'Maharashtra',
    district: 'Pune',
    role: 'curator',
    verificationStatus: 'verified',
    consentGiven: true,
    languagePreference: 'en',
    tokenVersion: 0,
  },
  {
    mobileNumber: '9000000004',
    name: 'Test Finance',
    username: 'test_finance_seed4',
    category: 'volunteer',
    state: 'Maharashtra',
    district: 'Pune',
    role: 'finance',
    verificationStatus: 'verified',
    consentGiven: true,
    languagePreference: 'en',
    tokenVersion: 0,
  },
  {
    mobileNumber: '9000000005',
    name: 'Test Admin',
    username: 'test_admin_seed5',
    category: 'volunteer',
    state: 'Maharashtra',
    district: 'Pune',
    role: 'admin',
    verificationStatus: 'verified',
    consentGiven: true,
    languagePreference: 'en',
    tokenVersion: 0,
  },
  {
    mobileNumber: '9000000006',
    name: 'Test SuperAdmin',
    username: 'test_superadmin_seed6',
    category: 'volunteer',
    state: 'Maharashtra',
    district: 'Pune',
    role: 'super_admin',
    verificationStatus: 'verified',
    consentGiven: true,
    languagePreference: 'en',
    tokenVersion: 0,
  },
];

// Values are numbers to match how the app actually writes config rows in real usage
// (AdminService.DEFAULT_CONFIG and CreateConfigDto/UpdateConfigDto both use/coerce to
// numbers) — seeding strings here was a test-fixture bug, not a product one.
const adminConfig = {
  daily_question_limit: 20,
  question_edit_window_seconds: 30,
  duplicate_similarity_threshold: 0.9,
  max_question_chars: 1000,
  min_withdrawal_amount: 50,
  max_image_size_mb: 5,
  video_max_size_mb: 10,
  video_max_duration_seconds: 10,
};

export async function seedTestUsers(app: INestApplication): Promise<User[]> {
  const userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
  const walletRepo = app.get<IWalletRepository>(REPOSITORY_TOKENS.Wallet);
  const configRepo = app.get<IAdminConfigRepository>(REPOSITORY_TOKENS.AdminConfig);

  const users: User[] = [];
  for (const userData of testUsers) {
    const user = await userRepo.create(userData as Partial<User>);
    users.push(user);
  }

  for (const user of users) {
    await walletRepo.create({ userId: user.id, balance: 0 } as never);
  }

  for (const [key, value] of Object.entries(adminConfig)) {
    await configRepo.create({ key, value } as never);
  }

  return users;
}

export async function getTestUsers(app: INestApplication): Promise<User[]> {
  const userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
  const users: User[] = [];
  for (const { mobileNumber } of testUsers) {
    const user = await userRepo.findByMobile(mobileNumber);
    if (user) users.push(user);
  }
  return users.sort((a, b) => (a.mobileNumber ?? '').localeCompare(b.mobileNumber ?? ''));
}

export async function cleanTestData(app: INestApplication): Promise<void> {
  const connection = app.get<Connection>(getConnectionToken());
  const collections = await connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
