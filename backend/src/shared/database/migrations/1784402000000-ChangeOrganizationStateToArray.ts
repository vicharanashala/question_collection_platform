import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convert `users.organization_state` from a single varchar(100) to a text[].
 *
 * Motivation: an organisation (FPO / NGO / volunteer) can have offices in
 * multiple Indian states, so the field needs to hold an array of state names.
 *
 * - Up:   ALTER COLUMN to text[], wrapping any existing non-null scalar into a
 *         single-element array via ARRAY[...] so data is preserved.
 * - Down: ALTER COLUMN back to varchar(100), taking the first element of the
 *         array (or NULL if empty) so data is preserved.
 */
export class ChangeOrganizationStateToArray1784402000000
  implements MigrationInterface
{
  name = 'ChangeOrganizationStateToArray1784402000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Wrap any existing scalar value into a single-element text[].
    // NULL stays NULL.
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "organization_state" TYPE text[]
        USING CASE
          WHEN "organization_state" IS NULL THEN NULL
          WHEN "organization_state" = ''    THEN NULL
          ELSE ARRAY["organization_state"]::text[]
        END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Collapse arrays back to a single scalar (first element). NULL stays NULL.
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "organization_state" TYPE varchar(100)
        USING CASE
          WHEN "organization_state" IS NULL       THEN NULL
          WHEN array_length("organization_state", 1) IS NULL THEN NULL
          WHEN array_length("organization_state", 1) = 0    THEN NULL
          ELSE ("organization_state")[1]
        END
    `);
  }
}