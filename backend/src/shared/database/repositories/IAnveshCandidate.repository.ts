import { Types } from 'mongoose';
import { Candidate } from '../mongodb/schemas/anveshan.schema';
import { BaseRepository } from '../abstractions/base.repository';
/**
 * Read-only repository contract for the Anveshan `candidates` collection.
 * This DB is owned by another service — no create/update/delete methods
 * are exposed here by design. Do not add write methods to this interface.
 */
export interface IAnveshanCandidateRepository extends BaseRepository<Candidate> {
  // findById(id: string | Types.ObjectId): Promise<Candidate | null>;

  // findByUserId(userId: string): Promise<Candidate | null>;

  findByPhone(phone: string): Promise<Candidate | null>;
  
  // findByIds(
  //   ids: ReadonlyArray<string | Types.ObjectId | null | undefined>,
  // ): Promise<Candidate[]>;

  // countByPhase(): Promise<Array<{ current_phase: string; count: number }>>;

  // countByState(): Promise<Array<{ state: string; count: number }>>;

  // getDailySignupsSince(from: Date): Promise<Array<{ date: string; signups: number }>>;
}