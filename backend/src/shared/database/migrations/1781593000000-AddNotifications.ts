import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1781593000000 implements MigrationInterface {
  name = 'AddNotifications1781593000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     uuid NOT NULL,
        "type"        varchar(50) NOT NULL,
        "title"       varchar(255) NOT NULL,
        "body"        varchar(500) NOT NULL,
        "data"        jsonb,
        "is_read"     boolean NOT NULL DEFAULT false,
        "created_at"  timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notifications_user_id"  ON "notifications" ("user_id");
      CREATE INDEX "idx_notifications_type"     ON "notifications" ("type");
      CREATE INDEX "idx_notifications_is_read"  ON "notifications" ("is_read");
    `);

    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD CONSTRAINT "fk_notifications_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
  }
}