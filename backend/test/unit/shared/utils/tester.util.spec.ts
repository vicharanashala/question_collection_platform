import { Types } from 'mongoose';
import {
  findTesterUserIds,
  isTesterCondition,
  userIdTesterCondition,
} from '../../../../src/shared/utils/tester.util';
import type { IUserRepository } from '../../../../src/shared/database/repositories';

describe('tester.util', () => {
  describe('isTesterCondition', () => {
    it('matches only testers for "only"', () => {
      expect(isTesterCondition('only')).toEqual({ is_tester: true });
    });

    it('matches everyone except testers for "exclude", including users without the flag', () => {
      expect(isTesterCondition('exclude')).toEqual({ is_tester: { $ne: true } });
    });

    it('returns undefined when no filter is set', () => {
      expect(isTesterCondition(undefined)).toBeUndefined();
    });
  });

  describe('userIdTesterCondition', () => {
    const ids = ['a', 'b'];

    it('builds $in for "only"', () => {
      expect(userIdTesterCondition('only', ids)).toEqual({ $in: ids });
    });

    it('builds $nin for "exclude"', () => {
      expect(userIdTesterCondition('exclude', ids)).toEqual({ $nin: ids });
    });

    it('returns undefined without a filter', () => {
      expect(userIdTesterCondition(undefined, ids)).toBeUndefined();
    });
  });

  describe('findTesterUserIds', () => {
    it('queries tester users and returns their ids as strings', async () => {
      const first = new Types.ObjectId();
      const second = new Types.ObjectId();
      const userRepo = { findAll: jest.fn().mockResolvedValue([{ _id: first }, { _id: second }]) };

      const ids = await findTesterUserIds(userRepo as unknown as IUserRepository);

      expect(userRepo.findAll).toHaveBeenCalledWith({ is_tester: true });
      expect(ids).toEqual([first.toHexString(), second.toHexString()]);
    });
  });
});
