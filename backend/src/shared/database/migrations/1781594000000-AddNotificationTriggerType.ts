import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationTriggerType1781594000000 implements MigrationInterface {
  name = 'AddNotificationTriggerType1781594000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN "trigger_type" varchar(20) NOT NULL DEFAULT 'question';
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notifications_trigger_type"
        ON "notifications" ("trigger_type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_notifications_trigger_type";
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN "trigger_type";
    `);
  }
}