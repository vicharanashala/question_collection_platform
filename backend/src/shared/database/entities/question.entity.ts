import { QuestionStatus, MediaType } from '../../classes/enums';
import { User } from './user.entity';

export interface SubmissionLocation {
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  block: string;
  village: string;
  capturedAt: Date;
}

export interface Question {
  id: string;

  userId: string;

  language: string;

  domains: string[];

  season: string;

  cropType: string;

  agroClimaticZone: string | null;

  state: string;

  district: string;

  block: string | null;

  questionText: string;

  /** Vector embedding of the question text, produced by the embedding service */
  embedding: number[] | null;

  mediaType: MediaType;

  mediaUrls: string[] | null;

  audioUrls: string[] | null;

  deviceInfo: Record<string, unknown> | null;

  /**
   * Precise location captured at submission time — populated for Anveshan
   * users (required on every submission), null/absent for everyone else.
   */
  submissionLocation: SubmissionLocation | null;

  status: QuestionStatus;

  duplicateFlag: boolean;

  duplicateOfId: string | null;

  submittedAt: Date;

  reviewedAt: Date | null;

  reviewerId: string | null;

  rejectionReason: string | null;

  heldReason: string | null;

  approvalReason: string | null;

  isAnveshan: boolean;

  /** True once the Anveshan user has answered this question; the answer lives in `anveshan_answers`. */
  isAnswerSubmitted: boolean;

  createdAt: Date;

  updatedAt: Date;

  user: User;

  reviewer: User | null;

  
}