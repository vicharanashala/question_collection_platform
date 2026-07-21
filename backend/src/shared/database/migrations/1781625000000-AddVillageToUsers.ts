import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVillageToUsers1781625000000 implements MigrationInterface {
  name = 'AddVillageToUsers1781625000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'village',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'User village — made mandatory in registration from v1781625000000',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'village');
  }
}