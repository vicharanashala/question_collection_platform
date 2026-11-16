import { BaseRepository } from '../abstractions/base.repository';
import { AgriEntity } from '../entities';
import { AgriEntityType } from '../../classes/enums';

/** Number of submissions of one type by one user. */
export interface UserAgriEntityTypeCount {
  userId: string;
  type: AgriEntityType;
  count: number;
}

/** Filter and paging for submission-date ordered queries. */
export interface SubmissionOrderQuery {
  filter: Record<string, unknown>;
  order: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface IAgriEntityRepository extends BaseRepository<AgriEntity> {
  /** Submission counts per user and type for the given users (zero counts are omitted). */
  countByUsersAndType(userIds: string[]): Promise<UserAgriEntityTypeCount[]>;

  /**
   * Entities matching the filter ordered by submission time (`submissionLocation.capturedAt`,
   * falling back to `createdAt`). Omit `limit` to return every match, e.g. for export.
   */
  findOrderedBySubmission(query: SubmissionOrderQuery): Promise<{ data: AgriEntity[]; total: number }>;
}
