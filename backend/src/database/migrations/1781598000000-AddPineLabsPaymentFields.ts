import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPineLabsPaymentFields1781598000000 implements MigrationInterface {
  name = 'AddPineLabsPaymentFields1781598000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add FAILED value to withdrawal_status_enum
    await queryRunner.query(`
      ALTER TYPE "withdrawal_status_enum"
      ADD VALUE IF NOT EXISTS 'failed';
    `);

    // 2. Add PineLabs columns to withdrawal_requests
    await queryRunner.query(`
      ALTER TABLE "withdrawal_requests"
      ADD COLUMN "pinelabs_transaction_id" VARCHAR(100) NULL,
      ADD COLUMN "order_id" VARCHAR(100) NULL UNIQUE;
    `);

    // 3. Create payment_logs table
    await queryRunner.query(`
      CREATE TABLE "payment_logs" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "withdrawal_request_id"  UUID NOT NULL,
        "admin_id"    UUID NULL,
        "order_id"    VARCHAR(100) NOT NULL,
        "pinelabs_transaction_id" VARCHAR(100) NULL,
        "status"      VARCHAR(20) NOT NULL DEFAULT 'pending',
        "error_code"  VARCHAR(50) NULL,
        "error_message" TEXT NULL,
        "raw_response" JSONB NULL,
        "attempted_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_payment_logs_withdrawal"
          FOREIGN KEY ("withdrawal_request_id")
          REFERENCES "withdrawal_requests"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_logs_withdrawal_id"
      ON "payment_logs" ("withdrawal_request_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_logs_admin_id"
      ON "payment_logs" ("admin_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_logs"`);
    await queryRunner.query(`
      ALTER TABLE "withdrawal_requests"
      DROP COLUMN IF EXISTS "pinelabs_transaction_id",
      DROP COLUMN IF EXISTS "order_id";
    `);
    // PostgreSQL does not support removing enum values, so FAILED remains.
  }
}