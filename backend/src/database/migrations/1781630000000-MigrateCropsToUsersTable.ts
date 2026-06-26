import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateCropsToUsersTable1781630000000 implements MigrationInterface {
  name = 'MigrateCropsToUsersTable1781630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add crops text[] column to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "crops" text[]
      DEFAULT '{}'::text[]
    `);

    // Step 2: Migrate data from user_crop_details → users.crops
    // Collect crops per user (dropping season, keeping only crop_name)
    await queryRunner.query(`
      UPDATE "users" u
      SET "crops" = sub.crop_list
      FROM (
        SELECT "user_id", array_agg("crop_name" ORDER BY "created_at") AS crop_list
        FROM "user_crop_details"
        GROUP BY "user_id"
      ) sub
      WHERE u.id = sub."user_id"
    `);

    // Step 3: Drop the foreign key constraint referencing user_crop_details
    // (already handled by CASCADE delete of user_crop_details via FK, but let's be explicit)
    await queryRunner.query(`
      ALTER TABLE "user_crop_details"
      DROP CONSTRAINT IF EXISTS "FK_47c029ba2ca58f3e7b856ed3122"
    `);

    // Step 4: Drop the user_crop_details table
    await queryRunner.query(`DROP TABLE "user_crop_details"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the table
    await queryRunner.query(`
      CREATE TABLE "user_crop_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "crop_name" varchar(255) NOT NULL,
        "season" varchar(50),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_crop_details" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_user_crops_user_id" ON "user_crop_details" ("user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "user_crop_details"
      ADD CONSTRAINT "FK_47c029ba2ca58f3e7b856ed3122"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Migrate data back
    await queryRunner.query(`
      INSERT INTO "user_crop_details" ("user_id", "crop_name", "season", "created_at")
      SELECT u.id, crop, NULL, now()
      FROM "users" u,
           unnest(COALESCE(u."crops", '{}')) AS crop
    `);

    // Drop crops column
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "crops"
    `);
  }
}