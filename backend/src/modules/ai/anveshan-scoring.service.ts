/**
 * AnveshanScoringService calls the answer scoring service on the VM.
 *
 *   POST /score          body: { answer_id, question, answer, crop, state, sources }
 *                        returns { job_id, status: "processing" }
 *   GET  /score/:jobId   returns the job, with the full score once status is "completed"
 *
 * Scoring is asynchronous, so callers start a job once and poll it until it completes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AnveshanAnswerScore,
  AnveshanAnswerScoreCheck,
  AnveshanAnswerSource,
} from '../../shared/database/entities';

const REQUEST_TIMEOUT_MS = 10_000;

export interface ScoreAnswerPayload {
  answerId: string;
  question: string;
  answer: string;
  crop: string;
  state: string;
  sources: AnveshanAnswerSource[];
}

/** Fields the scoring service returns for a job; only jobId and status are present until it completes. */
interface ScoringJobResponse {
  jobId?: string;
  job_id?: string;
  status?: string;
  systemScore?: number;
  maxScore?: number;
  percentage?: number;
  needsHumanReview?: boolean;
  reviewReasons?: unknown[];
  checks?: Partial<AnveshanAnswerScoreCheck>[];
  notApplicable?: unknown[];
  notEvaluated?: unknown[];
  checkedAt?: string;
}

/** Job state as the rest of the app needs it: still running, finished with a score, or failed. */
export type ScoringJobResult =
  | { status: 'processing' }
  | { status: 'failed'; response: Record<string, unknown> }
  | { status: 'completed'; score: Omit<AnveshanAnswerScore, 'jobId' | 'requestedAt'> };

@Injectable()
export class AnveshanScoringService {
  private readonly logger = new Logger(AnveshanScoringService.name);

  constructor(private readonly configService: ConfigService) {}

  // Starts a scoring job for an answer and returns its job id. Throws when the service cannot accept the job.
  async startJob(payload: ScoreAnswerPayload): Promise<string> {
    const body = {
      answer_id: payload.answerId,
      question: payload.question,
      answer: payload.answer,
      crop: payload.crop,
      state: payload.state,
      sources: payload.sources,
    };
    const response = await this.request('/score', { method: 'POST', body: JSON.stringify(body) });
    const jobId = response.job_id ?? response.jobId;
    if (!jobId) throw new Error('Scoring service returned no job id');
    return jobId;
  }

  // Reads the current state of a scoring job.
  async getJob(jobId: string): Promise<ScoringJobResult> {
    const response = await this.request(`/score/${encodeURIComponent(jobId)}`, { method: 'GET' });
    const status = response.status?.toLowerCase();
    if (status === 'completed') return { status: 'completed', score: toCompletedScore(response) };
    if (status === 'failed' || status === 'error') return { status: 'failed', response: { ...response } };
    return { status: 'processing' };
  }

  // Sends a JSON request to the scoring service; non 2xx responses and timeouts are thrown as errors.
  private async request(path: string, init: RequestInit): Promise<ScoringJobResponse> {
    const baseUrl = this.configService.get<string>('answerScoring.baseUrl')!;
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      // The body is logged for diagnosis only and never returned to the client.
      const text = await response.text().catch(() => '');
      this.logger.warn(`[Scoring] ${init.method} ${path} returned ${response.status}: ${text.slice(0, 500)}`);
      throw new Error(`Scoring service responded with ${response.status}`);
    }
    return (await response.json()) as ScoringJobResponse;
  }
}

// Maps a completed job into the stored score shape, tolerating missing or loosely typed fields.
function toCompletedScore(response: ScoringJobResponse): Omit<AnveshanAnswerScore, 'jobId' | 'requestedAt'> {
  const checkedAt = response.checkedAt ? new Date(response.checkedAt) : null;
  return {
    status: 'completed',
    systemScore: toNumberOrNull(response.systemScore),
    maxScore: toNumberOrNull(response.maxScore),
    percentage: toNumberOrNull(response.percentage),
    needsHumanReview: typeof response.needsHumanReview === 'boolean' ? response.needsHumanReview : null,
    reviewReasons: toStringList(response.reviewReasons),
    checks: (response.checks ?? []).map((check) => ({
      parameter: String(check.parameter ?? ''),
      category: String(check.category ?? ''),
      result: String(check.result ?? ''),
      mark: toNumberOrNull(check.mark) ?? 0,
      reason: String(check.reason ?? ''),
    })),
    notApplicable: toStringList(response.notApplicable),
    notEvaluated: toStringList(response.notEvaluated),
    checkedAt: checkedAt && !Number.isNaN(checkedAt.getTime()) ? checkedAt : new Date(),
    response: { ...response },
  };
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringList(values: unknown[] | undefined): string[] {
  return (values ?? []).map((value) => (typeof value === 'string' ? value : JSON.stringify(value)));
}
