import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddRazorpayDisbursementFields1700000000000 implements MigrationInterface {
  name = 'AddRazorpayDisbursementFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // UserPaymentDetail: razorpay_fund_account_id, razorpay_payout_id
    await queryRunner.addColumn(
      'user_payment_details',
      new TableColumn({
        name: 'razorpay_fund_account_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'user_payment_details',
      new TableColumn({
        name: 'razorpay_payout_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    // WithdrawalRequest: razorpay_payout_id
    await queryRunner.addColumn(
      'withdrawal_requests',
      new TableColumn({
        name: 'razorpay_payout_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    // PaymentLog: razorpay_payout_id
    await queryRunner.addColumn(
      'payment_logs',
      new TableColumn({
        name: 'razorpay_payout_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_payment_details', 'razorpay_fund_account_id');
    await queryRunner.dropColumn('user_payment_details', 'razorpay_payout_id');
    await queryRunner.dropColumn('withdrawal_requests', 'razorpay_payout_id');
    await queryRunner.dropColumn('payment_logs', 'razorpay_payout_id');
  }
}