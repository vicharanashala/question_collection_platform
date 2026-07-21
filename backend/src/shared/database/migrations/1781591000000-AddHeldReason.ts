import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHeldReason1781591000000 implements MigrationInterface {
  name = 'AddHeldReason1781591000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions"
      ADD COLUMN "held_reason" VARCHAR(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions" DROP COLUMN "held_reason"
    `);
  }
}