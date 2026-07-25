import mongoose, { connect } from 'mongoose';
import { User, UserSchema } from '../src/shared/database/mongodb/schemas/user.schema.js';

const MONGO_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/question_collection_staging';

async function main() {
  try {
    await connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected. DB:', mongoose.connection.name, 'readyState:', mongoose.connection.readyState);

    // Direct insert
    const { Types } = mongoose;
    const doc = { mobileNumber: '9999999999', name: 'test', role: 'user' };
    const result = await mongoose.connection.collection('users_test').insertOne(doc as any);
    console.log('insertOne result.acknowledged:', result.acknowledged, 'insertedId:', result.insertedId);

    // Check if it's there
    const found = await mongoose.connection.collection('users_test').findOne({ mobileNumber: '9999999999' });
    console.log('findOne result:', found);

    // Cleanup
    await mongoose.connection.collection('users_test').deleteOne({ mobileNumber: '9999999999' });
    console.log('Done');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e: any) {
    console.error('Error:', e.message, e.code);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();