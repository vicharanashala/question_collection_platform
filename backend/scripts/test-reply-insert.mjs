/**
 * Verify reply was inserted and getReport returns it
 */
import mongoose from 'mongoose';

const MONGODB_URL =
  'mongodb+srv://lpulga167_db_user:AlYI819Ba8Md1ly7@chatbot.icehz1c.mongodb.net/question_collection_staging?appName=qcStaging';

async function main() {
  await mongoose.connect(MONGODB_URL);
  const db = mongoose.connection.db;
  const { Types } = mongoose;

  const reportId = '6a635d7a6315091052fef73f';

  // 1. Check report_replies collection
  const replies = await db.collection('report_replies').find({}).toArray();
  console.log('All report_replies:', JSON.stringify(replies, null, 2));

  // 2. Test getReport pipeline
  const pipeline = [
    { $match: { _id: new Types.ObjectId(reportId) } },
    { $addFields: { idStr: { $toString: '$_id' } } },
    {
      $lookup: {
        from: 'report_replies',
        localField: 'idStr',
        foreignField: 'reportId',
        as: 'repliesArr',
      },
    },
    {
      $project: {
        _id: 1,
        id: { $toString: '$_id' },
        title: 1,
        status: 1,
        replies: {
          $map: {
            input: '$repliesArr',
            as: 'r',
            in: { id: { $toString: '$$r._id' }, message: '$$r.message', createdAt: '$$r.createdAt' },
          },
        },
      },
    },
  ];

  const results = await db.collection('reports').aggregate(pipeline).toArray();
  console.log('\ngetReport result:', JSON.stringify(results, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });