/**
 * GdbService — calls the Graph DB (GDB) semantic search endpoint to find
 * similar questions before a new question is submitted.
 *
 * The GDB service runs at GDB_BASE_URL and exposes:
 *   POST /v1/gdb/search
 *
 * It returns candidate questions with similarity_score per evaluation.
 * If any candidate has chosen_for_answer === true and
 * similarity >= similarityThreshold (admin config "duplicate_similarity_threshold",
 * default 0.9), the submission is blocked and the matching question + answer
 * is returned so the mobile app can show it to the user.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../database/entities';
import { AdminService } from '../admin/admin.service';

export interface GdbSearchResult {
  question_id: string;
  retrieved_question: string;
  similarity_score: number;
  relevance_decision: string;
  relevance_reason: string;
  classification: string;
  reason: string;
  chosen_for_answer: boolean;
}

export interface GdbSearchResponse {
  rephrased_query: string;
  crop: string;
  state: string;
  exact_match: Record<string, unknown>;
  selected_match: string | null;
  classification_audit: {
    status: string;
    model: string;
    relevance_filter_mode: string;
    evaluations: GdbSearchResult[];
    selected_question_id: string | null;
    chosen_for_answer: boolean;
  };
}

export interface DuplicateCheckResult {
  /** true when a matching question was found above the similarity threshold */
  isDuplicate: boolean;
  /** DB id of the matched question (null when not a duplicate) */
  matchedQuestionId: string | null;
  /** The text of the matched question */
  matchedQuestion: string | null;
  /** The answer text for the matched question (from our DB) */
  matchedAnswer: string | null;
  /** Similarity score of the top match (null when not a duplicate) */
  similarityScore: number | null;
  /** Raw GDB response for auditing — always populated even on non-duplicate */
  rawResponse: GdbSearchResponse | null;
}

@Injectable()
export class GdbService {
  private readonly logger = new Logger(GdbService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly adminService: AdminService,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Search for semantically similar questions and check if this submission
   * should be blocked as a near-duplicate.
   *
   * Uses `chosen_for_answer = true` from the GDB classification_audit as the
   * primary filter (LLM-selected best match) plus the similarity threshold.
   */
  async checkDuplicate(payload: {
    questionText: string;
    crop: string;
    state: string;
  }): Promise<DuplicateCheckResult> {
    const baseUrl = this.configService.get<string>('gdb.baseUrl')!;
    const apiKey = this.configService.get<string>('gdb.apiKey')!;

    const url = `${baseUrl}/v1/gdb/search`;
    this.logger.debug(`[GDB] search → ${url}`);

    // ── Call GDB ──────────────────────────────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          rephrased_query: payload.questionText,
          crop: payload.crop,
          state: payload.state,
        }),
      });
    } catch (err) {
      // Network failure — do not block the user; treat as non-duplicate
      this.logger.error(`[GDB] network error: ${err}`);
      return this.noDuplicate();
    }

    let raw: GdbSearchResponse;
    let responseText = '';
    try {
      responseText = await response.text();
      this.logger.debug(`[GDB] raw response (${response.status}): ${responseText.slice(0, 500)}`);
      raw = JSON.parse(responseText) as GdbSearchResponse;
    } catch {
      this.logger.error(`[GDB] non-JSON response body: ${responseText?.slice(0, 200)}`);
      return this.noDuplicate();
    }

    if (!response.ok) {
      this.logger.warn(`[GDB] HTTP ${response.status}`);
      return this.noDuplicate(raw);
    }

    // ── Resolve threshold from admin config (default 0.9) ─────────────────────
    const threshold = await this.adminService
      .getConfigValue('duplicate_similarity_threshold')
      .catch(() => 0.9);

    this.logger.debug(`[GDB] threshold=${threshold}, evaluations count=${raw.classification_audit?.evaluations?.length ?? 0}`);
    raw.classification_audit?.evaluations?.forEach((e, i) => {
      this.logger.debug(
        `[GDB] eval[${i}] chosen_for_answer=${e.chosen_for_answer} similarity_score=${e.similarity_score} question_id=${e.question_id} retrieved_question=${String(e.retrieved_question ?? '').slice(0, 80)}`,
      );
    });

    // ── Find the best match above threshold ─────────────────────────────────────
    //    Primary filter: chosen_for_answer=true (GDB's LLM-selected best match)
    //    AND similarity >= threshold.
    //    Fallback: if GDB returns no confident pick (status=empty / all
    //    chosen_for_answer=false), use the highest similarity_score candidate.
    const evaluations = raw.classification_audit?.evaluations ?? [];

    const chosenMatch = evaluations.find(
      (e) => e.chosen_for_answer === true && e.similarity_score >= threshold,
    );

    const bestMatch =
      chosenMatch ??
      evaluations
        .filter((e) => e.similarity_score >= threshold)
        .sort((a, b) => b.similarity_score - a.similarity_score)[0] ??
      null;

    if (!bestMatch) {
      return this.noDuplicate(raw);
    }

    const fallback = !evaluations.some((e) => e.chosen_for_answer === true);
    if (fallback) {
      this.logger.debug(
        `[GDB] no chosen_for_answer=true; using fallback highest similarity_score=${bestMatch.similarity_score} question_id=${bestMatch.question_id}`,
      );
    }

    // ── Fetch the matched question from our DB using the retrieved question text ──
    //    (GDB question_ids are short-format identifiers, not our UUIDs)
    const matchedQuestionEntity = await this.questionRepo.findOne({
      where: { questionText: bestMatch.retrieved_question },
      select: ['id', 'questionText'],
    });

    return {
      isDuplicate: true,
      // GDB's question_id is not our UUID — use the DB id if found, otherwise null
      matchedQuestionId: matchedQuestionEntity?.id ?? null,
      matchedQuestion: bestMatch.retrieved_question,
      // Use the stored question text as the "answer" the farmer can read
      matchedAnswer: matchedQuestionEntity?.questionText ?? bestMatch.retrieved_question,
      similarityScore: bestMatch.similarity_score,
      rawResponse: raw,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private noDuplicate(raw: GdbSearchResponse | null = null): DuplicateCheckResult {
    return {
      isDuplicate: false,
      matchedQuestionId: null,
      matchedQuestion: null,
      matchedAnswer: null,
      similarityScore: null,
      rawResponse: raw,
    };
  }
}