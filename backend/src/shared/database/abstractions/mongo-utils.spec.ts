import { hideDeleted, INCLUDE_DELETED } from './mongo-utils';

describe('hideDeleted', () => {
  it('adds the default filter when isDeleted is not set', () => {
    expect(hideDeleted({ userId: 'u1' })).toEqual({
      userId: 'u1',
      isDeleted: { $ne: true },
    });
  });

  it('keeps an explicit isDeleted condition', () => {
    expect(hideDeleted({ isDeleted: true })).toEqual({ isDeleted: true });
    expect(hideDeleted({ isDeleted: INCLUDE_DELETED })).toEqual({
      isDeleted: INCLUDE_DELETED,
    });
  });
});
