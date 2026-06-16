import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuspendedUntil1781590000000 implements MigrationInterface {
  name = 'AddSuspendedUntil1781590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "suspended_until" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "suspended_until"
    `);
  }
}