import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEncryptedPaymentFields1782296742648 implements MigrationInterface {
    name = 'AddEncryptedPaymentFields1782296742648'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_payment_details" ADD "ifsc_encrypted" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" ADD "account_holder_name_encrypted" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" DROP COLUMN "ifsc"`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" ADD "ifsc" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" DROP COLUMN "account_holder_name"`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" ADD "account_holder_name" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_payment_details" DROP COLUMN "account_holder_name"`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" ADD "account_holder_name" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" DROP COLUMN "ifsc"`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" ADD "ifsc" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" DROP COLUMN "account_holder_name_encrypted"`);
        await queryRunner.query(`ALTER TABLE "user_payment_details" DROP COLUMN "ifsc_encrypted"`);
    }

}
