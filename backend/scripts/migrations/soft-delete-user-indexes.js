/*
 * One-off migration for soft delete.
 * 1. Backfills isDeleted: false on documents created before the field existed.
 * 2. Replaces the old unique mobileNumber index with a partial unique index
 *    that only covers active users.
 *
 * Usage: MONGODB_URL="mongodb+srv://..." node scripts/migrations/soft-delete-user-indexes.js
 * Run it once before deploying the soft delete release. Safe to run again.
 */
const mongoose = require('mongoose');

const COLLECTIONS = [
  'users',
  'questions',
  'final_questions',
  'wallets',
  'transactions',
  'withdrawal_requests',
  'payment_logs',
  'user_payment_details',
  'notifications',
  'agri_entities',
  'reports',
  'app_feedbacks',
  'anveshan_answers',
];

async function main() {
  const uri = process.env.MONGODB_URL;
  if (!uri) throw new Error('MONGODB_URL is required');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const name of COLLECTIONS) {
    const result = await db
      .collection(name)
      .updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
    console.log(`${name}: backfilled ${result.modifiedCount} documents`);
  }

  const users = db.collection('users');
  const duplicates = await users
    .aggregate([
      { $match: { isDeleted: false, mobileNumber: { $type: 'string' } } },
      { $group: { _id: '$mobileNumber', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  if (duplicates.length > 0) {
    throw new Error(
      `Active users share a mobile number, resolve these first: ${duplicates
        .map((d) => d._id)
        .join(', ')}`,
    );
  }

  const indexes = await users.indexes();
  for (const index of indexes) {
    const isMobileOnly =
      Object.keys(index.key).length === 1 && index.key.mobileNumber === 1;
    if (isMobileOnly && !index.partialFilterExpression) {
      await users.dropIndex(index.name);
      console.log(`users: dropped old index ${index.name}`);
    }
  }

  await users.createIndex(
    { mobileNumber: 1 },
    {
      unique: true,
      partialFilterExpression: { isDeleted: false, mobileNumber: { $type: 'string' } },
    },
  );
  console.log('users: partial unique mobileNumber index is in place');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
