import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRetryCountToWithdrawalRequests1781602000000 implements MigrationInterface {
  name = 'AddRetryCountToWithdrawalRequests1781602000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "withdrawal_requests"
      ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "withdrawal_requests" DROP COLUMN "retry_count"
    `);
  }
}