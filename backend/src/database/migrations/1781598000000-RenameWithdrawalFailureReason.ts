import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameWithdrawalFailureReason1781598000000 implements MigrationInterface {
  name = 'RenameWithdrawalFailureReason1781598000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('withdrawal_requests', 'failure_reason', 'rejection_reason');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('withdrawal_requests', 'rejection_reason', 'failure_reason');
  }
}