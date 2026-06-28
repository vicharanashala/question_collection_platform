import { AppDataSource } from './src/database/data-source.js';
import { User, VerificationStatus } from './src/database/entities/index.js';

const ds = await AppDataSource.initialize();
const repo = ds.getRepository(User);

const counts = await repo
  .createQueryBuilder('u')
  .select('u.verificationStatus', 'status')
  .addSelect('COUNT(*)', 'count')
  .groupBy('u.verificationStatus')
  .getRawMany();

console.log('Counts by status:');
counts.forEach(r => console.log(' ', r.status, '->', r.count));

const pending = await repo.find({
  where: { verificationStatus: VerificationStatus.PENDING },
  select: ['id', 'mobileNumber', 'name', 'category', 'state', 'createdAt'],
  order: { createdAt: 'ASC' },
  take: 20,
});
console.log('\nFirst 20 PENDING users:');
pending.forEach(u => console.log(' ', u.id, u.mobileNumber, u.name ?? '(no name)', u.category, u.state, u.createdAt));

const total = await repo.count({ where: { verificationStatus: VerificationStatus.PENDING } });
console.log('\nTotal PENDING:', total);

await ds.destroy();