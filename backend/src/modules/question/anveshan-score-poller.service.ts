import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AnveshanMilestoneService } from './anveshan-milestone.service';
import { ANVESHAN_SCORE_POLL_INTERVAL_MS } from '../../shared/constants/anveshan.constant';

// Answers checked per run. Each check is one request to the scoring service, so this bounds a run's length.
const ANSWERS_PER_RUN = 50;

/**
 * Background check for Anveshan answers whose scoring job is still processing.
 *
 * The scoring service can take several minutes to report a finished job, longer than the web app keeps
 * polling, so this saves results (and restarts lost or stale jobs) even when nobody has the page open.
 */
@Injectable()
export class AnveshanScorePollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnveshanScorePollerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(private readonly milestoneService: AnveshanMilestoneService) {}

  // Starts the periodic check.
  onModuleInit(): void {
    this.timer = setInterval(() => void this.checkProcessingScores(), ANVESHAN_SCORE_POLL_INTERVAL_MS);
    // Does not keep the process alive on its own, so shutdown and tests are not held up.
    this.timer.unref();
    this.logger.log(`Background score check every ${ANVESHAN_SCORE_POLL_INTERVAL_MS / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // Updates every processing score, oldest first. Skips a run while the previous one is still going,
  // and one failing answer never stops the others.
  async checkProcessingScores(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const answers = await this.milestoneService.findAnswersAwaitingScore(ANSWERS_PER_RUN);
      let finished = 0;
      for (const answer of answers) {
        try {
          const score = await this.milestoneService.syncAnswerScore(answer);
          if (score.status !== 'processing') finished += 1;
        } catch (error) {
          this.logger.warn(`[Scoring] background check failed for answer ${answer.id}: ${error}`);
        }
      }
      if (finished > 0) {
        this.logger.log(`[Scoring] background check saved ${finished} of ${answers.length} processing scores`);
      }
    } catch (error) {
      this.logger.error(`[Scoring] background check could not load processing scores: ${error}`);
    } finally {
      this.isRunning = false;
    }
  }
}
