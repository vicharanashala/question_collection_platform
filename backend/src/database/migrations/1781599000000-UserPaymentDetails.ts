import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class UserPaymentDetails1781599000000 implements MigrationInterface {
  name = 'UserPaymentDetails1781599000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_payment_details',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'payout_method',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'upi_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'account_number_last4',
            type: 'varchar',
            length: '4',
            isNullable: true,
          },
          {
            name: 'ifsc',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'account_holder_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'bank_name',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'account_number_encrypted',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
          },
          {
            name: 'verification_order_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'withdrawal_request_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'verification_failed_reason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'verified_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true, // wrapTransaction — already in transaction from previous migration context
    );

    await queryRunner.createIndex(
      'user_payment_details',
      new TableIndex({ name: 'idx_upd_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.createIndex(
      'user_payment_details',
      new TableIndex({ name: 'idx_upd_status', columnNames: ['status'] }),
    );

    // FK to users
    await queryRunner.query(`
      ALTER TABLE "user_payment_details"
      ADD CONSTRAINT "fk_upd_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // FK to withdrawal_requests (optional, for withdrawal-triggered verifications)
    await queryRunner.query(`
      ALTER TABLE "user_payment_details"
      ADD CONSTRAINT "fk_upd_withdrawal"
      FOREIGN KEY ("withdrawal_request_id") REFERENCES "withdrawal_requests"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_payment_details');
  }
}