import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRazorpayPaymentLinkFields1700000000000 implements MigrationInterface {
  name = 'AddRazorpayPaymentLinkFields1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'user_payment_details',
      new TableColumn({
        name: 'razorpay_payment_link_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Razorpay payment link ID for ₹1 verification collection',
      }),
    );
    await queryRunner.addColumn(
      'user_payment_details',
      new TableColumn({
        name: 'razorpay_payment_link_url',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'Razorpay payment link short URL sent to user',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_payment_details', 'razorpay_payment_link_id');
    await queryRunner.dropColumn('user_payment_details', 'razorpay_payment_link_url');
  }
}