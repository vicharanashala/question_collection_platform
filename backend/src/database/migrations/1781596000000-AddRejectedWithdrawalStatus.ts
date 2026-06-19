import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectedWithdrawalStatus1781596000000 implements MigrationInterface {
  name = 'AddRejectedWithdrawalStatus1781596000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL enum alteration: add new value to existing type
    await queryRunner.query(`
      ALTER TYPE "withdrawal_status_enum"
      ADD VALUE IF NOT EXISTS 'rejected';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enum types,
    // so this is a one-way migration in practice.
    // As a best-effort approach, we leave the type as-is.
    await queryRunner.query(`
      ALTER TYPE "withdrawal_status_enum"
      DROP VALUE IF EXISTS 'rejected';
    `);
  }
}