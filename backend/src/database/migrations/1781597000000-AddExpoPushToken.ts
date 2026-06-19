import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpoPushToken1781597000000 implements MigrationInterface {
  name = 'AddExpoPushToken1781597000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "expo_push_token" VARCHAR(255) NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_users_expo_push_token"
      ON "users" ("expo_push_token")
      WHERE "expo_push_token" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_expo_push_token"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "expo_push_token"`);
  }
}