import { DataSource } from 'typeorm';
import { AdminConfig, User, Wallet } from '../../../src/database/entities';

const testUsers = [
  {
    mobileNumber: '9000000001',
    name: 'Test Farmer',
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

const adminConfig = {
  daily_question_limit: '20',
  question_edit_window_seconds: '30',
  duplicate_similarity_threshold: '0.9',
  max_question_chars: '1000',
  min_withdrawal_amount: '50',
  max_image_size_mb: '5',
  video_max_size_mb: '10',
  video_max_duration_seconds: '10',
};

export async function seedTestUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const walletRepository = dataSource.getRepository(Wallet);
  const configRepository = dataSource.getRepository(AdminConfig);

  const users = await userRepository.save(testUsers.map((user) => userRepository.create(user as Partial<User>)));

  await walletRepository.save(
    users.map((user) =>
      walletRepository.create({
        user,
        balance: 0,
      } as Partial<Wallet>),
    ),
  );

  await configRepository.save(
    Object.entries(adminConfig).map(([key, value]) =>
      configRepository.create({
        key,
        value,
      } as Partial<AdminConfig>),
    ),
  );

  return users;
}

export async function getTestUsers(dataSource: DataSource) {
  return dataSource.getRepository(User).find({
    where: testUsers.map(({ mobileNumber }) => ({ mobileNumber })),
    order: { mobileNumber: 'ASC' },
  });
}

export async function cleanTestData(dataSource: DataSource) {
  const tables = [
    'notifications',
    'audit_logs',
    'questions',
    'transactions',
    'withdrawal_requests',
    'payment_logs',
    'user_payment_details',
    'wallets',
    'users',
    'admin_config',
  ];

  await dataSource.query(`TRUNCATE TABLE ${tables.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
}
