import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSettlementIdColumns1781703100000 implements MigrationInterface {
  name = 'DropSettlementIdColumns1781703100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('payment_logs', 'settlement_id')) {
      await queryRunner.dropColumn('payment_logs', 'settlement_id');
    }
    if (await queryRunner.hasColumn('withdrawal_requests', 'settlement_id')) {
      await queryRunner.dropColumn('withdrawal_requests', 'settlement_id');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No down — this is a data correction migration; settlement_id was never populated
  }
}