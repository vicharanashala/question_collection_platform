import mongoose from 'mongoose';
import { UserSchema } from '../src/shared/database/mongodb/schemas/user.schema.js';

const MONGO_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/question_collection_staging';
console.log('Connecting to:', MONGO_URI);

// Register model directly
const User = mongoose.model('UserTest', UserSchema, 'users_test');

async function main() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected. DB:', mongoose.connection.name, 'DB state:', mongoose.connection.readyState);

    // Try direct insert
    const doc = new User({ mobileNumber: '9999999999', name: 'test', role: 'user' });
    console.log('doc._id before save:', doc._id, 'typeof:', typeof doc._id);
    const saved = await doc.save();
    console.log('saved._id:', saved._id);

    // Try findByIdAndUpdate with upsert
    const { Types } = mongoose;
    const oid = saved._id;
    const result = await User.findByIdAndUpdate(
      oid,
      { name: 'test-updated' },
      { returnDocument: 'after', upsert: true }
    );
    console.log('findByIdAndUpdate result:', result ? `id=${result._id} name=${result.name}` : 'null');

    // Direct find
    const found = await User.findOne({ _id: oid });
    console.log('findOne result:', found ? `id=${found._id} name=${found.name}` : 'null');

    // Cleanup
    await User.deleteOne({ _id: oid });
    console.log('Cleaned up test doc');

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Connection state:', mongoose.connection.readyState);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();