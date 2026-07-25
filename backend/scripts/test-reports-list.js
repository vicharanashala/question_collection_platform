/**
 * Replicate exactly what listReports does after the fix.
 * Tests the MongoQueryBuilder path to see what data comes back.
 */
const mongoose = require('mongoose');

const MONGODB_URL =
  'mongodb+srv://lpulga167_db_user:AlYI819Ba8Md1ly7@chatbot.icehz1c.mongodb.net/question_collection_staging?appName=qcStaging';

async function main() {
  await mongoose.connect(MONGODB_URL);
  const db = mongoose.connection.db;
  const collection = db.collection('reports');

  const page = 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  // ── Exact replica of MongoQueryBuilder.buildQuery() with no filters ──
  const filter = {};

  // ── Exact replica of MongoQueryBuilder.buildOpts() ──
  const sort = { createdAt: -1 };
  const opts = { skip: offset, limit };

  console.log('filter:', filter);
  console.log('opts:', JSON.stringify(opts));

  // Call find with no projection (getManyAndCount calls find with undefined projection when no select)
  const docs = await collection.find(filter, undefined, opts).toArray();

  console.log('\nRaw docs from find():');
  console.log('Count:', docs.length);
  if (docs.length > 0) {
    console.log('Doc[0] keys:', Object.keys(docs[0]));
    console.log('Doc[0]:', JSON.stringify(docs[0], null, 2));
  }

  // Simulate docToEntity
  const items = docs.map((d) => {
    const obj = d._doc ?? d;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__v') continue;
      if (k === '_id') out['id'] = String(v);
      else out[k] = v;
    }
    return out;
  });

  console.log('\nAfter docToEntity:');
  console.log('items[0]:', JSON.stringify(items[0], null, 2));

  // Check what the front-end Report interface expects
  const fe = {
    id: items[0]?.id,
    userId: items[0]?.userId,
    title: items[0]?.title,
    description: items[0]?.description,
    category: items[0]?.category,
    status: items[0]?.status,
    priority: items[0]?.priority,
    relatedEntityId: items[0]?.relatedEntityId,
    relatedEntityType: items[0]?.relatedEntityType,
    createdAt: items[0]?.createdAt,
    updatedAt: items[0]?.updatedAt,
  };
  console.log('\nFront-end Report shape:', JSON.stringify(fe, null, 2));

  // Check for undefined/null values
  console.log('\nUndefined fields:');
  for (const [k, v] of Object.entries(fe)) {
    if (v === undefined) console.log(' ', k, ': undefined');
  }

  await mongoose.disconnect();
}

main().catch(console.error);