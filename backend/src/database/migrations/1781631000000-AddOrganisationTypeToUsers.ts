import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrganisationTypeToUsers1781631000000 implements MigrationInterface {
  name = 'AddOrganisationTypeToUsers1781631000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'organisation_type',
        type: 'varchar',
        length: '200',
        isNullable: true,
        comment: 'Type of organisation the volunteer/NGO/FPO user belongs to',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'organisation_type');
  }
}