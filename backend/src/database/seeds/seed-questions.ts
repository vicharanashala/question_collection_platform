/**
 * Seed 100 sample questions for user 9111111111
 * Run with: npx ts-node src/database/seeds/seed-questions.ts
 */
import { AppDataSource } from '../../config/typeorm.config';
import { User } from '../entities/user.entity';
import { Question } from '../entities/question.entity';
import { QuestionStatus, Season, MediaType } from '../../common/enums';

async function main() {
  await AppDataSource.initialize();

  const user = await AppDataSource.getRepository(User).findOne({
    where: { mobileNumber: '9111111111' },
  });

  if (!user) {
    console.error('User with mobile 9111111111 not found');
    await AppDataSource.destroy();
    process.exit(1);
  }

  console.log('Found user:', user.id, user.name);

  const districts = ['Pune', 'Nagpur', 'Nashik', 'Mumbai', 'Aurangabad'];
  const domainSets = [
    ['Crop Insurance'],
    ['Weather Information', 'Climate, Weather & Stress Management'],
    ['Insect–Pest Management', 'Disease Management'],
    ['Soil Health Card', 'Soil Testing'],
    ['Market Prices, MSP & Marketing'],
  ];
  const crops = ['Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Soybean'];
  const topics = ['irrigation', 'fertilizer application', 'pest control', 'harvesting', 'storage'];
  const seasons: Season[] = [Season.RABI, Season.KHARIF];

  const questions = [];

  for (let i = 1; i <= 100; i++) {
    const district = districts[i % 5];
    const crop = crops[i % 5];
    const domains = domainSets[i % 5];
    const topic = topics[i % 5];
    const season = seasons[i % 2];

    questions.push({
      userId: user.id,
      state: 'Maharashtra',
      district,
      block: `Block-${(i % 3) + 1}`,
      domains,
      season,
      cropType: crop,
      questionText: `Question ${i}: What is the best practice for ${topic} for ${crop} in ${district} district during ${season} season? Please provide detailed guidance.`,
      mediaType: MediaType.NONE,
      mediaUrls: [],
      agroClimaticZone: 'Western Ghats',
      suggestedDistricts: ['Pune', 'Satara', 'Solapur'],
      suggestedBlocks: ['Block-1', 'Block-2', 'Block-3'],
      remainingToday: 19,
      status: QuestionStatus.PENDING,
      submittedAt: new Date(),
    });
  }

  await AppDataSource.getRepository(Question).save(questions);
  console.log(`Inserted 100 questions for user ${user.id} (${user.mobileNumber})`);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});