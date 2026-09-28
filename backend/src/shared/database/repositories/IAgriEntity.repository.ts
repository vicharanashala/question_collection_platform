import { BaseRepository } from '../abstractions/base.repository';
import { AgriEntity } from '../entities';
import { AgriEntityType } from '../../classes/enums';

/** Number of submissions of one type by one user. */
export interface UserAgriEntityTypeCount {
  userId: string;
  type: AgriEntityType;
  count: number;
}

export interface IAgriEntityRepository extends BaseRepository<AgriEntity> {
  /** Submission counts per user and type for the given users (zero counts are omitted). */
  countByUsersAndType(userIds: string[]): Promise<UserAgriEntityTypeCount[]>;
}
