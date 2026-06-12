/**
 * Seed script — populates default admin config values.
 * Run with: npm run seed
 */
import { AppDataSource } from '../../config/typeorm.config';

const DEFAULT_CONFIG = [
  {
    key: 'max_users_per_state',
    value: 100,
    description: 'Maximum registered users allowed per state',
  },
  {
    key: 'min_withdrawal_amount',
    value: 50.0,
    description: 'Minimum withdrawal threshold in INR',
  },
  {
    key: 'question_edit_window_seconds',
    value: 30,
    description: 'Edit window duration after question submission (seconds)',
  },
  {
    key: 'daily_question_limit',
    value: 20,
    description: 'Maximum questions a user can submit per day',
  },
  {
    key: 'ai_confidence_threshold',
    value: 90.0,
    description: 'Minimum AI confidence score (%) to auto-approve a question',
  },
  {
    key: 'duplicate_similarity_threshold',
    value: 0.9,
    description: 'Semantic similarity threshold (0-1) for duplicate detection',
  },
  {
    key: 'video_max_duration_seconds',
    value: 10,
    description: 'Maximum allowed video duration in seconds',
  },
  {
    key: 'video_max_size_mb',
    value: 10,
    description: 'Maximum allowed video file size in megabytes',
  },
];

async function seed() {
  console.log('🌱 Starting seed...');

  await AppDataSource.initialize();
  console.log('✅ Database connected');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  for (const config of DEFAULT_CONFIG) {
    // Upsert: insert or update on conflict
    await queryRunner.query(
      `
      INSERT INTO "admin_config" ("id", "key", "value", "description")
      VALUES (gen_random_uuid(), $1, $2, $3)
      ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value",
            "description" = EXCLUDED."description",
            "updated_at" = now()
      `,
      [config.key, JSON.stringify(config.value), config.description],
    );
    console.log(`  ✓ ${config.key}`);
  }

  await queryRunner.release();
  await AppDataSource.destroy();

  console.log('✅ Seed complete');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});