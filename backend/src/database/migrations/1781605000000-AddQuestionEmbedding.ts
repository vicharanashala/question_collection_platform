import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuestionEmbedding1781605000000 implements MigrationInterface {
  name = 'AddQuestionEmbedding1781605000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions"
      ADD COLUMN "embedding" float8[]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questions" DROP COLUMN "embedding"
    `);
  }
}