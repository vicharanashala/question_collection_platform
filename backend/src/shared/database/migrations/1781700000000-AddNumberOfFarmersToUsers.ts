import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNumberOfFarmersToUsers1743300000000 implements MigrationInterface {
  name = 'AddNumberOfFarmersToUsers1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "number_of_farmers" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF NOT EXISTS "number_of_farmers"
    `);
  }
}