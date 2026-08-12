import { IsArray, IsIn, IsOptional, IsString, ArrayMaxSize, ArrayUnique, MaxLength } from 'class-validator';
import { INDIAN_STATES } from '../../../shared/constants/indian-states.constant';

/**
 * Body for POST /distributor/questions/:id/assign-states.
 *
 * Distributors send 0..N Indian states; for each state a new row is created
 * in the final_questions collection and the parent question's status flips
 * to QuestionStatus.MOVED_TO_FINAL. An empty `states` array is also valid —
 * it is used when a distributor wants to mark a question as moved-to-final
 * without assigning it to any specific state (e.g. questions that are not
 * state-specific).
 */
export class AssignStatesDto {
  @IsArray()
  @ArrayMaxSize(INDIAN_STATES.length, { message: 'Too many states in a single request.' })
  @ArrayUnique({ message: 'Duplicate state names are not allowed.' })
  @IsIn(INDIAN_STATES as unknown as string[], { each: true, message: 'Each state must be a valid Indian state name.' })
  states: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}