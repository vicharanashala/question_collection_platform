import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFaqsTable1709300000000 implements MigrationInterface {
  name = 'CreateFaqsTable1709300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "faqs" (
        "id"          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        "question"    VARCHAR(500)  NOT NULL,
        "answer"      TEXT          NOT NULL,
        "is_visible"  BOOLEAN       NOT NULL DEFAULT true,
        "display_order" INTEGER     NOT NULL DEFAULT 0,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_faqs_is_visible"     ON "faqs" ("is_visible")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_faqs_display_order" ON "faqs" ("display_order", "id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "faqs"`);
  }
}