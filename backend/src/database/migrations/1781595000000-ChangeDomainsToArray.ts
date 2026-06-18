import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ChangeDomainsToArray1781595000000 implements MigrationInterface {
  name = 'ChangeDomainsToArray1781595000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename domain_category column and change type to text[] (array)
    await queryRunner.changeColumn(
      'questions',
      'domain_category',
      new TableColumn({
        name: 'domains',
        type: 'text',
        isArray: true,
        default: "'{}'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'questions',
      'domains',
      new TableColumn({
        name: 'domain_category',
        type: 'varchar',
        length: '100',
        default: "'crop_protection'",
      }),
    );
  }
}