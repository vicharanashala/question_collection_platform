import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportAndReportReplyTables1781703200000 implements MigrationInterface {
  name = 'AddReportAndReportReplyTables1781703200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── reports ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id"          UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id"     UUID            NOT NULL,
        "title"       VARCHAR(100)    NOT NULL,
        "description" TEXT            NOT NULL,
        "category"    VARCHAR(50)     NOT NULL,
        "status"      VARCHAR(20)     NOT NULL DEFAULT 'open',
        "priority"    VARCHAR(20)     NOT NULL DEFAULT 'medium',
        "related_entity_id"   UUID    NULL,
        "related_entity_type" VARCHAR(50) NULL,
        "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_reports_user_id" ON "reports" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_reports_status" ON "reports" ("status")`);

    await queryRunner.query(`
      ALTER TABLE "reports"
        ADD CONSTRAINT "fk_reports_user_id"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
    `);

    // ─── report_replies ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "report_replies" (
        "id"         UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
        "report_id"  UUID           NOT NULL,
        "admin_id"   UUID           NOT NULL,
        "message"    TEXT           NOT NULL,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_report_replies_report_id" ON "report_replies" ("report_id")`);
    await queryRunner.query(`CREATE INDEX "idx_report_replies_admin_id" ON "report_replies" ("admin_id")`);

    await queryRunner.query(`
      ALTER TABLE "report_replies"
        ADD CONSTRAINT "fk_report_replies_report_id"
        FOREIGN KEY ("report_id")
        REFERENCES "reports"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "report_replies"
        ADD CONSTRAINT "fk_report_replies_admin_id"
        FOREIGN KEY ("admin_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_replies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
  }
}