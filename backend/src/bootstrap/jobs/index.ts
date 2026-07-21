// Background job registry — scheduled tasks run via setInterval or cron.
// TODO: install @nestjs/schedule for @Cron decorator support.
// Job implementations go under src/workers/.

import { Logger, Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ScheduledJobs implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobs.name);

  onModuleInit() {
    this.logger.log('ScheduledJobs ready');
  }

  /**
   * Daily cleanup — purge expired sessions, stale cache, old audit snapshots.
   * TODO: wire to a cron schedule or setInterval in main.ts.
   */
  async handleDailyCleanup(): Promise<void> {
    this.logger.log('[Job] Daily cleanup started');
    try {
      // TODO: implement
      this.logger.log('[Job] Daily cleanup completed');
    } catch (err) {
      this.logger.error('[Job] Daily cleanup failed', err);
    }
  }

  /**
   * Hourly question review — escalates AI-reviewed questions stuck too long.
   */
  async handleHourlyQuestionReview(): Promise<void> {
    this.logger.log('[Job] Hourly question review started');
    try {
      // TODO: implement
      this.logger.log('[Job] Hourly question review completed');
    } catch (err) {
      this.logger.error('[Job] Hourly question review failed', err);
    }
  }
}

// Dynamic job registry — workers/ can register ad-hoc jobs at runtime.
type JobFn = () => Promise<void>;
export const dynamicJobs: Array<{ name: string; fn: JobFn }> = [];

export function registerDynamicJob(name: string, fn: JobFn): void {
  dynamicJobs.push({ name, fn });
}