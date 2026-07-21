import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRazorpayValidationId1781620000000 implements MigrationInterface {
  name = 'AddRazorpayValidationId1781620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // razorpay_validation_id: stores the fund account validation ID (fav_xxx)
    // received from POST /v1/fund_accounts/validations — used to correlate webhook events
    await queryRunner.addColumn(
      'user_payment_details',
      new TableColumn({
        name: 'razorpay_validation_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Razorpay fund account validation ID (fav_xxx)',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_payment_details', 'razorpay_validation_id');
  }
}