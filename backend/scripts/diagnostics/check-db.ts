// Diagnostic script — counts documents across the main collections.
import 'dotenv/config';
import * as dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URL!);
  const db = mongoose.connection.db!;
  const collections = ['questions', 'users', 'wallets', 'transactions', 'final_questions'];
  for (const c of collections) {
    try {
      const count = await db.collection(c).countDocuments();
      console.log(`${c}: ${count}`);
      if (c === 'questions' && count > 0) {
        // Show a sample doc and per-status counts
        const sample = await db.collection(c).findOne();
        console.log('  sample fields:', Object.keys(sample ?? {}).join(', '));
        const statusAgg = await db.collection(c).aggregate([
          { $group: { _id: '$status', n: { $sum: 1 } } },
        ]).toArray();
        console.log('  status breakdown:', JSON.stringify(statusAgg));
        const dateAgg = await db.collection(c).aggregate([
          { $group: { _id: { $dateToString: { date: '$submittedAt', format: '%Y-%m-%d' } }, n: { $sum: 1 } } },
          { $sort: { _id: -1 } },
          { $limit: 5 },
        ]).toArray();
        console.log('  last-5-day breakdown:', JSON.stringify(dateAgg));
      }
      if (c === 'users' && count > 0) {
        const roleAgg = await db.collection(c).aggregate([
          { $group: { _id: '$role', n: { $sum: 1 } } },
        ]).toArray();
        console.log('  role breakdown:', JSON.stringify(roleAgg));
        const sample = await db.collection(c).findOne({ role: 'curator' });
        console.log('  sample curator:', sample ? { id: sample._id, mobile: sample.mobileNumber, name: sample.name, status: sample.verificationStatus } : 'NONE');
      }
    } catch (e) {
      console.log(`${c}: ERROR ${(e as Error).message}`);
    }
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
