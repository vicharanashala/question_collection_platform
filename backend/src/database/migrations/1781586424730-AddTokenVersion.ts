import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenVersion1781586424730 implements MigrationInterface {
    name = 'AddTokenVersion1781586424730'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
    }

}
