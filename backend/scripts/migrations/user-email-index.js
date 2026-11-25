/*
 * One-off migration for email linking.
 * Creates the partial unique email index that the User schema declares, after
 * checking that no two active users already share an email address.
 *
 * Usage: MONGODB_URL="mongodb+srv://..." node scripts/migrations/user-email-index.js
 * Run it once before deploying the email verification release. Safe to run again.
 */
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URL;
  if (!uri) throw new Error('MONGODB_URL is required');
  await mongoose.connect(uri);
  const users = mongoose.connection.db.collection('users');

  await assertNoActiveDuplicateEmails(users);
  await users.createIndex(
    { email: 1 },
    {
      unique: true,
      partialFilterExpression: { isDeleted: false, email: { $type: 'string' } },
    },
  );
  console.log('users: partial unique email index is in place');
}

// Stops the migration when two active users share an email that is about to become unique.
async function assertNoActiveDuplicateEmails(users) {
  const duplicates = await users
    .aggregate([
      { $match: { isDeleted: false, email: { $type: 'string' } } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  if (duplicates.length > 0) {
    throw new Error(
      `Active users share an email, resolve these first: ${duplicates
        .map((d) => d._id)
        .join(', ')}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
