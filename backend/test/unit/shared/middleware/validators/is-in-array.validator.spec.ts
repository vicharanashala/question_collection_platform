import { validate } from 'class-validator';
import { IsInArray } from '../../../../../src/shared/middleware/validators/is-in-array.validator';

const SEASONS = ['Kharif', 'Rabi', 'Zaid'];

class SeasonDto {
  @IsInArray(SEASONS)
  season!: string;
}

// Builds a DTO and returns its validation errors.
async function errorsFor(season: unknown) {
  const dto = Object.assign(new SeasonDto(), { season });
  return validate(dto);
}

describe('IsInArray', () => {
  it.each(SEASONS)('accepts %p', async (season) => {
    expect(await errorsFor(season)).toHaveLength(0);
  });

  it.each(['kharif', 'Monsoon', '', null, 1])('rejects %p', async (season) => {
    const errors = await errorsFor(season);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isInArray).toBe('season must be one of: Kharif, Rabi, Zaid');
  });
});
