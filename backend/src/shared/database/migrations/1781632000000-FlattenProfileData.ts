import { MigrationInterface, QueryRunner } from 'typeorm';

export class FlattenProfileData1743256200000 implements MigrationInterface {
  name = 'FlattenProfileData1743256200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add top-level scalar columns (all nullable since existing rows may not have them)
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "age"                  integer,
        ADD COLUMN IF NOT EXISTS "gender"               varchar(50),
        ADD COLUMN IF NOT EXISTS "farm_size"            varchar(100),
        ADD COLUMN IF NOT EXISTS "season"               varchar(50),
        ADD COLUMN IF NOT EXISTS "crop_type"            varchar(200),
        ADD COLUMN IF NOT EXISTS "course_name"          varchar(255),
        ADD COLUMN IF NOT EXISTS "college_name"         varchar(255),
        ADD COLUMN IF NOT EXISTS "university_name"      varchar(255),
        ADD COLUMN IF NOT EXISTS "organization_name"    varchar(255),
        ADD COLUMN IF NOT EXISTS "organization_role"    varchar(255)
    `);

    // 2. Migrate existing profile_data values into the new columns
    // farmer
    await queryRunner.query(`
      UPDATE "users"
      SET
        "farm_size"   = (profile_data->>'farmSize')::varchar,
        "season"      = profile_data->>'season',
        "crop_type"   = profile_data->>'cropType',
        "age"         = NULLIF(profile_data->>'age', '')::integer,
        "gender"      = profile_data->>'gender'
      WHERE profile_data IS NOT NULL
        AND category   = 'farmer'
    `);

    // student
    await queryRunner.query(`
      UPDATE "users"
      SET
        "course_name"     = COALESCE(profile_data->>'courseName',    profile_data->>'courseName'),
        "college_name"    = profile_data->>'collegeName',
        "university_name" = profile_data->>'universityName',
        "age"             = NULLIF(profile_data->>'age', '')::integer,
        "gender"          = profile_data->>'gender',
        "season"          = profile_data->>'season',
        "crop_type"       = profile_data->>'cropType'
      WHERE profile_data IS NOT NULL
        AND category = 'student'
    `);

    // fpo / ngo
    await queryRunner.query(`
      UPDATE "users"
      SET
        "organization_name" = COALESCE(profile_data->>'organizationName', profile_data->>'organisationName'),
        "organization_role" = COALESCE(profile_data->>'role', profile_data->>'memberRole'),
        "age"               = NULLIF(profile_data->>'age', '')::integer,
        "gender"            = profile_data->>'gender'
      WHERE profile_data IS NOT NULL
        AND category IN ('fpo', 'ngo')
    `);

    // volunteer (also has organisationName vs organizationName issue)
    await queryRunner.query(`
      UPDATE "users"
      SET
        "organization_name" = COALESCE(profile_data->>'organizationName', profile_data->>'organisationName'),
        "organization_role" = COALESCE(profile_data->>'role', profile_data->>'memberRole'),
        "age"               = NULLIF(profile_data->>'age', '')::integer,
        "gender"            = profile_data->>'gender',
        "season"            = profile_data->>'season',
        "crop_type"         = profile_data->>'cropType'
      WHERE profile_data IS NOT NULL
        AND category = 'volunteer'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rebuild profile_data from the flat columns
    await queryRunner.query(`
      UPDATE "users" SET profile_data = to_jsonb(strip)::jsonb
      FROM (
        SELECT id,
          jsonb_build_object(
            'farmSize',         farm_size,
            'season',           season,
            'cropType',         crop_type,
            'courseName',       course_name,
            'collegeName',      college_name,
            'universityName',   university_name,
            'organizationName', organization_name,
            'memberRole',       organization_role,
            'age',              age::text,
            'gender',           gender
          ) AS strip
        FROM users
      ) AS migrated
      WHERE users.id = migrated.id
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "age";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "gender";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "farm_size";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "season";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "crop_type";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "course_name";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "college_name";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "university_name";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_name";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "organization_role";
    `);
  }
}