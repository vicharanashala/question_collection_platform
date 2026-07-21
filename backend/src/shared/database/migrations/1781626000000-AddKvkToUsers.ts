import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddKvkToUsers1781626000000 implements MigrationInterface {
  name = 'AddKvkToUsers1781626000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'kvk',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'Nearest KVK — user-selected from list or free-text entry',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'kvk');
  }
}