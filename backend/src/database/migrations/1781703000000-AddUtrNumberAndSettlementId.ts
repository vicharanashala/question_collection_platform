import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUtrNumberAndSettlementId1781703000000 implements MigrationInterface {
  name = 'AddUtrNumberAndSettlementId1781703000000';

  private async addColumnIfNotExists(
    queryRunner: QueryRunner,
    table: string,
    column: TableColumn,
  ): Promise<void> {
    const existing = await queryRunner.hasColumn(table, column.name);
    if (!existing) {
      await queryRunner.addColumn(table, column);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── withdrawal_requests ──────────────────────────────────────────────────
    await this.addColumnIfNotExists(
      queryRunner,
      'withdrawal_requests',
      new TableColumn({
        name: 'utr_number',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'UTR number from Razorpay — available once payout is processed/confirmed',
      }),
    );
    await this.addColumnIfNotExists(
      queryRunner,
      'withdrawal_requests',
      new TableColumn({
        name: 'settlement_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Razorpay settlement/batch ID the payout belongs to',
      }),
    );

    // ── payment_logs ─────────────────────────────────────────────────────────
    await this.addColumnIfNotExists(
      queryRunner,
      'payment_logs',
      new TableColumn({
        name: 'utr_number',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'UTR number returned by Razorpay once payout is processed',
      }),
    );
    await this.addColumnIfNotExists(
      queryRunner,
      'payment_logs',
      new TableColumn({
        name: 'settlement_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Razorpay settlement/batch ID the payout belongs to',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop only if column exists (idempotent)
    if (await queryRunner.hasColumn('payment_logs', 'settlement_id')) {
      await queryRunner.dropColumn('payment_logs', 'settlement_id');
    }
    if (await queryRunner.hasColumn('payment_logs', 'utr_number')) {
      await queryRunner.dropColumn('payment_logs', 'utr_number');
    }
    if (await queryRunner.hasColumn('withdrawal_requests', 'settlement_id')) {
      await queryRunner.dropColumn('withdrawal_requests', 'settlement_id');
    }
    if (await queryRunner.hasColumn('withdrawal_requests', 'utr_number')) {
      await queryRunner.dropColumn('withdrawal_requests', 'utr_number');
    }
  }
}