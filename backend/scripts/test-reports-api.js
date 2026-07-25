/**
 * Debug: call listReports and getReport directly via Mongoose
 * to see what data shape is returned.
 */
const mongoose = require('mongoose');

const MONGODB_URL =
  'mongodb+srv://lpulga167_db_user:AlYI819Ba8Md1ly7@chatbot.icehz1c.mongodb.net/question_collection_staging?appName=qcStaging';

async function main() {
  await mongoose.connect(MONGODB_URL);
  const db = mongoose.connection.db;

  console.log('=== listReports (admin view) ===');
  // Simulate what listReports does:
  // 1. reportRepo.findAndCount with no select (our fix)
  const offset = 0;
  const limit = 20;

  // Get raw docs from reports collection
  const [rawItems, total] = await Promise.all([
    db.collection('reports').find().sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    db.collection('reports').countDocuments(),
  ]);

  // Simulate docToEntity: _id → id
  const items = rawItems.map(doc => {
    const out = {};
    for (const [k, v] of Object.entries(doc)) {
      if (k === '__v') continue;
      if (k === '_id') out['id'] = String(v);
      else out[k] = v;
    }
    return out;
  });

  console.log('total:', total);
  console.log('items.length:', items.length);
  if (items.length > 0) {
    console.log('First item keys:', Object.keys(items[0]));
    console.log('First item:', JSON.stringify(items[0], null, 2));
  }

  console.log('\n=== What the frontend Report type expects ===');
  console.log('id, userId, title, description, category, status, priority,');
  console.log('relatedEntityId, relatedEntityType, createdAt, updatedAt, user?, replies?');

  console.log('\n=== What we get ===');
  console.log('Missing fields from frontend Report:', [
    'description', 'updatedAt',
    ...(items[0] && !items[0].description ? ['description'] : []),
  ]);

  await mongoose.disconnect();
}

main().catch(console.error);