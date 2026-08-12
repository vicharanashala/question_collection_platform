import { BaseRepository } from '../abstractions/base.repository';
import { Question } from '../entities';
import { QuestionStatus } from '../../classes/enums';

export interface QuestionFilter {
  id?: string;
  userId?: string;
  status?: QuestionStatus;
  questionText?: string;
  cropType?: string;
  season?: string;
  state?: string;
  district?: string;
  domains?: string[];
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
}

export interface IQuestionRepository extends BaseRepository<Question> {
  findByUserId(userId: string, status?: QuestionStatus, limit?: number): Promise<Question[]>;
  countByUserId(userId: string, status?: QuestionStatus): Promise<number>;
  searchByText(text: string, limit?: number): Promise<Question[]>;
  findExactDuplicate(userId: string, questionText: string, state: string, district: string): Promise<Question | null>;

  /**
   * Returns the top N users ranked by their count of APPROVED questions.
   * Used by the leaderboard warmup.
   * - Postgres: uses createQueryBuilder GROUP BY + COUNT
   * - MongoDB:  uses an aggregation pipeline ($match → $group → $sort → $limit)
   */
  getLeaderboard(limit: number): Promise<Array<{ userId: string; approvedCount: number }>>;
}