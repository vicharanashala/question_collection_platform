import { AppDataSource } from '../src/config/typeorm.config';
import { User, VerificationStatus } from '../src/database/entities/user.entity';

async function main() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const counts = await repo
    .createQueryBuilder('u')
    .select('u.verificationStatus', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('u.verificationStatus')
    .getRawMany();

  console.log('Counts by status:');
  counts.forEach((r: any) => console.log(' ', r.status, '->', r.count));

  const pending = await repo.find({
    where: { verificationStatus: VerificationStatus.PENDING },
    select: ['id', 'mobileNumber', 'name', 'category', 'state', 'createdAt'],
    order: { createdAt: 'ASC' },
    take: 20,
  });
  console.log('\nFirst 20 PENDING users:');
  pending.forEach(u =>
    console.log(' ', u.id, u.mobileNumber, u.name ?? '(no name)', u.category ?? 'null', u.state, u.createdAt),
  );

  const total = await repo.count({ where: { verificationStatus: VerificationStatus.PENDING } });
  console.log('\nTotal PENDING:', total);

  await AppDataSource.destroy();
}

main().catch(console.error);