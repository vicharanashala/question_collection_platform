import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectionReasonToTransactions1700000000001 implements MigrationInterface {
  name = 'AddRejectionReasonToTransactions1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN "rejection_reason" varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions" DROP COLUMN "rejection_reason"
    `);
  }
}