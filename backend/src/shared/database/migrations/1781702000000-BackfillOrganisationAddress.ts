import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillOrganisationAddress1781702000000 implements MigrationInterface {
  name = 'BackfillOrganisationAddress1781702000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill org address fields from the user's personal address for existing records
    // where org address fields are null but personal address fields exist
    await queryRunner.query(`
      UPDATE "users"
      SET
        "organization_state"    = COALESCE("organization_state",    "state"),
        "organization_district" = COALESCE("organization_district", "district"),
        "organization_block"    = COALESCE("organization_block",    "block"),
        "organization_village"  = COALESCE("organization_village",  "village")
      WHERE "organization_state" IS NULL
        AND (
          "state" IS NOT NULL OR
          "district" IS NOT NULL OR
          "block" IS NOT NULL OR
          "village" IS NOT NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op — we don't want to lose data on rollback
  }
}