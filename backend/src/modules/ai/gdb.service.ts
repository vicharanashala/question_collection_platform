/**
 * GdbService — calls the Graph DB (GDB) similar-question endpoint before a new
 * question is submitted.
 *
 * The GDB service runs at GDB_BASE_URL and exposes:
 *   POST /v1/gdb/find-similar-questions   body: { question_text }
 *
 * The endpoint does three things in one pass:
 *   1. Safety pre-check — flags vulgar/abusive queries (`rejected: true`).
 *   2. Agriculture relevance pre-check — flags off-topic queries (`rejected: true`).
 *   3. Exact + vector duplicate search across all statuses (`is_present: true`),
 *      returning the matched question, its answer and its author.
 *
 * A rejected query is blocked before anything is persisted. A duplicate is
 * returned so the mobile app / web can show the existing question + answer.
 *
 * Note: this endpoint does not filter by crop/state and returns no similarity
 * score, so `similarityScore` is always null.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuestionRejectionCategory } from '../../shared/classes/enums';
import { IQuestionRepository } from '../../shared/database/repositories/IQuestion.repository';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { SarvamService } from '../speech/sarvam.service';

export interface SimilarQuestionResponse {
  query: string;
  is_present: boolean;
  present_status: string | null;
  present_question_id: string | null;
  present_question_text: string | null;
  present_answer_text: string | null;
  present_sources: unknown[];
  present_author: string | null;
  exact_match_found: boolean;
  total_candidates_found: number;
  rejected: boolean;
  rejection_reason: string | null;
}

/** Set when GDB blocked the query as abusive or non-agricultural. */
export interface QuestionRejection {
  category: QuestionRejectionCategory;
  /** Raw English reason from GDB — kept for audit logs, not for display. */
  reason: string;
}

export interface DuplicateCheckResult {
  /** true when GDB already has this question in its knowledge base */
  isDuplicate: boolean;
  /** DB id of the matched question (null when not found in our own DB) */
  matchedQuestionId: string | null;
  /** The text of the matched question */
  matchedQuestion: string | null;
  /** The answer text for the matched question */
  matchedAnswer: string | null;
  /** Always null — this endpoint does not return a similarity score */
  similarityScore: number | null;
  /**
   * Display name of the user who submitted the matched question.
   * Resolved from our own DB when possible, otherwise the GDB author.
   */
  matchedUserName: string | null;
  /** Non-null when the query was blocked as abusive or non-agricultural */
  rejection: QuestionRejection | null;
  /** Raw GDB response for auditing — always populated on a successful call */
  rawResponse: SimilarQuestionResponse | null;
}

@Injectable()
export class GdbService {
  private readonly logger = new Logger(GdbService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sarvamService: SarvamService,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Runs the GDB safety, relevance and duplicate checks for a question.
   *
   * Returns `rejection` when the query is abusive or off-topic (the caller must
   * block the submission), or `isDuplicate` when the question already exists.
   * Network and parse failures fail open so a GDB outage never blocks a farmer.
   */
  async checkDuplicate(payload: {
    questionText: string;
    languageCode?: string;
  }): Promise<DuplicateCheckResult> {
    const baseUrl = this.configService.get<string>('gdb.baseUrl')!;
    const apiKey = this.configService.get<string>('gdb.apiKey')!;

    const url = `${baseUrl}/v1/gdb/find-similar-questions`;
    this.logger.debug(`[GDB] find-similar-questions → ${url}`);

    const queryText = await this.toEnglish(payload.questionText, payload.languageCode);

    // ── Call GDB ──────────────────────────────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ question_text: queryText }),
      });
    } catch (err) {
      // Network failure — do not block the user; treat as non-duplicate
      this.logger.error(`[GDB] network error: ${err}`);
      return this.noDuplicate();
    }

    let raw: SimilarQuestionResponse;
    let responseText = '';
    try {
      responseText = await response.text();
      this.logger.debug(`[GDB] raw response (${response.status}): ${responseText.slice(0, 500)}`);
      raw = JSON.parse(responseText) as SimilarQuestionResponse;
    } catch {
      this.logger.error(`[GDB] non-JSON response body: ${responseText?.slice(0, 200)}`);
      return this.noDuplicate();
    }

    if (!response.ok) {
      this.logger.warn(`[GDB] HTTP ${response.status}`);
      return this.noDuplicate(raw);
    }

    // ── Safety / relevance gate ───────────────────────────────────────────────
    if (raw.rejected) {
      const category = this.classifyRejection(raw.rejection_reason);
      this.logger.debug(`[GDB] query rejected as ${category}: ${raw.rejection_reason}`);
      return {
        ...this.noDuplicate(raw),
        rejection: { category, reason: raw.rejection_reason ?? '' },
      };
    }

    if (!raw.is_present) {
      return this.noDuplicate(raw);
    }

    // ── Duplicate found ───────────────────────────────────────────────────────
    //    GDB's present_question_id is its own identifier, not our UUID, so the
    //    matching row is resolved by question text to get our id + submitter.
    const matchedQuestionEntity = raw.present_question_text
      ? await this.questionRepo.findOne({
          where: { questionText: raw.present_question_text },
          select: ['id', 'questionText'],
          relations: ['user'],
        })
      : null;

    this.logger.debug(
      `[GDB] duplicate found: status=${raw.present_status} exact=${raw.exact_match_found} candidates=${raw.total_candidates_found}`,
    );

    return {
      isDuplicate: true,
      matchedQuestionId: matchedQuestionEntity?.id ?? null,
      matchedQuestion: raw.present_question_text,
      matchedAnswer: raw.present_answer_text?.trim() || null,
      similarityScore: null,
      matchedUserName:
        this.resolveDisplayName(matchedQuestionEntity?.user ?? null) ??
        raw.present_author?.trim() ??
        null,
      rejection: null,
      rawResponse: raw,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Translates the question to English when needed, since the GDB knowledge base
   * is English-only. A translation failure falls back to the original text
   * rather than blocking the duplicate check.
   */
  private async toEnglish(questionText: string, languageCode?: string): Promise<string> {
    const sarvamLangCode = languageCode ? this.toSarvamLang(languageCode) : undefined;

    if (!sarvamLangCode || this.isEnglish(sarvamLangCode)) {
      return questionText;
    }

    try {
      const translation = await this.sarvamService.translateText(
        questionText,
        'en-IN',
        sarvamLangCode,
      );
      const translated = translation.translatedText?.trim() || questionText;
      this.logger.debug(`[GDB] translated ${sarvamLangCode} → en-IN: "${translated.slice(0, 100)}"`);
      return translated;
    } catch (err) {
      this.logger.warn(`[GDB] translation failed (${languageCode} → en-IN), using original text: ${err}`);
      return questionText;
    }
  }

  /**
   * Maps GDB's free-text rejection reason to a category the clients can render
   * as a translated message. The raw text is English-only and embeds a truncated
   * model fragment, so it is never shown to the user.
   */
  private classifyRejection(reason: string | null): QuestionRejectionCategory {
    const text = (reason ?? '').toLowerCase();
    if (/abusive|vulgar|inappropriate|offensive/.test(text)) {
      return QuestionRejectionCategory.ABUSIVE;
    }
    if (/agricultur|farming/.test(text)) {
      return QuestionRejectionCategory.NOT_AGRICULTURE;
    }
    return QuestionRejectionCategory.OTHER;
  }

  private noDuplicate(raw: SimilarQuestionResponse | null = null): DuplicateCheckResult {
    return {
      isDuplicate: false,
      matchedQuestionId: null,
      matchedQuestion: null,
      matchedAnswer: null,
      similarityScore: null,
      matchedUserName: null,
      rejection: null,
      rawResponse: raw,
    };
  }

  private isEnglish(languageCode?: string | null): boolean {
    if (!languageCode) return true;
    return languageCode.toLowerCase().startsWith('en');
  }

  /**
   * Maps a short (ISO 639) language code to Sarvam's qualified "xx-IN" form.
   * Accepts already-qualified codes (e.g. 'hi-IN') and returns them unchanged.
   *
   * Mirrors the frontend helper `toSarvamLang` in
   *   mobile/src/api/speech.ts
   *   web/src/api/speech.ts
   * so the backend never has to assume callers have normalized the code.
   */
  private toSarvamLang(code: string): string {
    if (!code) return code;
    if (code.includes('-')) return code;
    const map: Record<string, string> = {
      as: 'as-IN', bn: 'bn-IN', brx: 'brx-IN', doi: 'doi-IN',
      gu: 'gu-IN', hi: 'hi-IN', kn: 'kn-IN', ks: 'ks-IN',
      kok: 'kok-IN', mai: 'mai-IN', ml: 'ml-IN', mni: 'mni-IN',
      mr: 'mr-IN', ne: 'ne-IN', or: 'or-IN', pa: 'pa-IN',
      sa: 'sa-IN', sat: 'sat-IN', sd: 'sd-IN', ta: 'ta-IN',
      te: 'te-IN', ur: 'ur-IN', en: 'en-IN',
    };
    return map[code] ?? `${code}-IN`;
  }

  /**
   * Resolves the best display name from a User entity, using the same priority
   * as QuestionService.findExactDuplicate:
   *   1. username  2. name  3. masked mobile  4. null
   */
  private resolveDisplayName(user: { username?: string | null; name?: string | null; mobileNumber?: string | null } | null): string | null {
    if (!user) return null;
    if (user.username) return user.username;
    if (user.name?.trim()) return user.name.trim();
    if (user.mobileNumber) return this.maskMobile(user.mobileNumber);
    return null;
  }

  private maskMobile(mobile: string): string {
    const digits = mobile.replace(/\D/g, '');
    return digits.length >= 4
      ? `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`
      : mobile;
  }
}
