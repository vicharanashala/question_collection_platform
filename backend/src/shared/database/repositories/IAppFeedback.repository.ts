import { BaseRepository } from '../abstractions/base.repository';
import { AppFeedback, AppFeedbackContext } from '../entities';

/** Count and average of ratings, plus how many feedbacks gave each star value. */
export interface FeedbackRatingSummary {
  total: number;
  averageRating: number | null;
  /** Keys 1 to 5, each with its count (0 when none). */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface IAppFeedbackRepository extends BaseRepository<AppFeedback> {
  /** Ratings summary for one feedback context across all users. */
  getRatingSummary(context: AppFeedbackContext): Promise<FeedbackRatingSummary>;
}
