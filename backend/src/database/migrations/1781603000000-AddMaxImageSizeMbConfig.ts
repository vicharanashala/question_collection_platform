import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxImageSizeMbConfig1781603000000 implements MigrationInterface {
  name = 'AddMaxImageSizeMbConfig1781603000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed the new config key with a default value.
    // Uses ON CONFLICT so this is safe to re-run if the key already exists.
    await queryRunner.query(`
      INSERT INTO "admin_config" ("id", "key", "value", "description")
      VALUES (
        gen_random_uuid(),
        'max_image_size_mb',
        5,
        'Maximum image file size per question (MB)'
      )
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "admin_config" WHERE "key" = 'max_image_size_mb'`);
  }
}