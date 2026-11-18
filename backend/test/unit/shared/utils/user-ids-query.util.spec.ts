import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserIdsQuery } from '../../../../src/shared/utils/user-ids-query.util';

class UserFilterQuery {
  @UserIdsQuery()
  userIds?: string[];
}

// Runs the same transform and validation steps as the global ValidationPipe.
async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(UserFilterQuery, query);
  return { dto, errors: await validate(dto) };
}

describe('UserIdsQuery', () => {
  it('is optional', async () => {
    const { errors } = await parse({});

    expect(errors).toHaveLength(0);
  });

  it('splits a comma separated value and trims blanks', async () => {
    const { dto, errors } = await parse({ userIds: ' a, b ,,c ' });

    expect(errors).toHaveLength(0);
    expect(dto.userIds).toEqual(['a', 'b', 'c']);
  });

  it('accepts a repeated query parameter', async () => {
    const { dto } = await parse({ userIds: ['a', ' b '] });

    expect(dto.userIds).toEqual(['a', 'b']);
  });

  it('rejects more than 200 ids', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `id${i}`).join(',');

    const { errors } = await parse({ userIds: ids });

    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });
});
