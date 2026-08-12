import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRazorpayContactId1781610000000 implements MigrationInterface {
  name = 'AddRazorpayContactId1781610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "razorpay_contact_id" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "razorpay_contact_id"
    `);
  }
}