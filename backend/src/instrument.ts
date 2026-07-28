// Sentry instrumentation — initialise error tracking and performance monitoring.
// TODO: install @sentry/node and @sentry/profiling-node
//   npm install @sentry/node @sentry/profiling-node
// Then call setupSentry(configService) in bootstrap() before NestFactory.create().

import { ConfigService } from '@nestjs/config';

// TODO: uncomment once @sentry/node is installed
// import * as Sentry from '@sentry/node';
// import { nodeProfilingIntegration } from '@sentry/profiling-node';

const logger = { log: (msg: string) => console.log(`[Sentry] ${msg}`) };
 
/**
 * Initialises Sentry error tracking using the DSN from app config.
 * Call this before `await NestFactory.create()`.
 */
export function setupSentry(configService: ConfigService): void {
  const dsn = configService.get<string>('sentry.dsn');
  const environment = configService.get<string>('app.environment') ?? 'development';

  if (!dsn) {
    logger.log('DSN not configured — skipping');
    return;
  }

  // TODO: uncomment once @sentry/node is installed
  // Sentry.init({
  //   dsn,
  //   environment,
  //   integrations: [nodeProfilingIntegration()],
  //   tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  // });

  logger.log(`Initialised in ${environment}`);
}