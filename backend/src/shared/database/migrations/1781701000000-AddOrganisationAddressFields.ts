import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationAddressFields1781701000000 implements MigrationInterface {
  name = 'AddOrganisationAddressFields1781701000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "organization_state"     varchar(100),
        ADD COLUMN IF NOT EXISTS "organization_district"  varchar(100),
        ADD COLUMN IF NOT EXISTS "organization_block"     varchar(100),
        ADD COLUMN IF NOT EXISTS "organization_village"   varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_state";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_district";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_block";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_village";
    `);
  }
}