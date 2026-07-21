import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAiConfidenceConfig1781604000000 implements MigrationInterface {
  name = 'RemoveAiConfidenceConfig1781604000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove ai_confidence_threshold from admin_config (no longer used)
    await queryRunner.query(`
      DELETE FROM "admin_config" WHERE "key" = 'ai_confidence_threshold'
    `);

    // Drop ai_confidence_score column from questions table (if it exists)
    await queryRunner.query(`
      ALTER TABLE "questions" DROP COLUMN IF EXISTS "ai_confidence_score"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore ai_confidence_threshold seed (value stored as jsonb)
    await queryRunner.query(`
      INSERT INTO "admin_config" ("id", "key", "value", "description")
      VALUES (
        gen_random_uuid(),
        'ai_confidence_threshold',
        '90'::jsonb,
        'Minimum AI confidence score (%) to auto-approve a question'
      )
      ON CONFLICT ("key") DO NOTHING
    `);

    // Restore ai_confidence_score column
    await queryRunner.query(`
      ALTER TABLE "questions" ADD COLUMN "ai_confidence_score" decimal(5,2)
    `);
  }
}