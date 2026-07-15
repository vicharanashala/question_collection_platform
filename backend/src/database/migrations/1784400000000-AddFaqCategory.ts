import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFaqCategory1784400000000 implements MigrationInterface {
  name = 'AddFaqCategory1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "faqs"
        ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL DEFAULT 'general'
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_faqs_category" ON "faqs" ("category")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_faqs_category"`);
    await queryRunner.query(`ALTER TABLE "faqs" DROP COLUMN IF EXISTS "category"`);
  }
}