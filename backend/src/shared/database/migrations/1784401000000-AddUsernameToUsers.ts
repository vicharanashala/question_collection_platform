import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddUsernameToUsers1784401000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the username column to the existing users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'username',
        type: 'varchar',
        length: '50',
        isUnique: true,
        isNullable: true,
      }),
    );

    // Add index for fast lookups
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_users_username',
        columnNames: ['username'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'idx_users_username');
    await queryRunner.dropColumn('users', 'username');
  }
}