import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalReason1781592000000 implements MigrationInterface {
  name = 'AddApprovalReason1781592000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions"
      ADD COLUMN "approval_reason" VARCHAR(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions" DROP COLUMN "approval_reason"
    `);
  }
}