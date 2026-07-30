import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import { AppModule } from './app.module';
import { EndpointLoggerService } from './shared/services/endpoint-logger/endpoint-logger.service';

// Validate required env vars before attempting to start.
// These are eagerly evaluated during ConfigModule.forRoot() and would throw
// opaque errors if missing. Surface a clear message instead.
function validateRequiredEnv(): void {
  console.log('[Bootstrap] Validating env vars...');
  const required = ['MONGODB_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'REDIS_HOST', 'REDIS_PORT'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[Bootstrap] Missing required env var: ${key}`);
      throw new Error(`Missing required env var: ${key}`);
    }
  }
  // LLM/VM services are non-blocking — they use safe fallbacks in configuration.ts
  // when the env vars are absent (e.g. in staging where VM services may not be pre-configured).
  console.log('[Bootstrap] All required env vars present');
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  validateRequiredEnv();

  console.log('[Bootstrap] Calling NestFactory.create()...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Raw body needed for some webhooks
    rawBody: true,
  });
  console.log('[Bootstrap] NestFactory.create() returned');

  // Serve uploaded audio files statically so external services (e.g. Sarvam) can fetch them
  app.useStaticAssets(join(__dirname, '..'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*'); 
    },
  });

  // Expose app reference globally so class-validator constraints
  // (which are instantiated outside DI) can access NestJS services
  globalThis.nestApp = app;

  // Global validation pipe — transforms and validates all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip non-decorated fields
      forbidNonWhitelisted: true, // Reject extra fields with an error
      transform: true,            // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS — allow mobile app connections
  app.enableCors({
    origin: '*', // Restrict to your mobile app origin in production
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);
  // Cloud Run injects PORT=8080; read it first so the container listens on the port the orchestrator expects.
  const portFromEnv = parseInt(process.env.PORT ?? '', 10);
  const port = portFromEnv || (configService.get<number>('app.port') ?? 3000);
  const environment = configService.get<string>('app.environment') ?? 'development';

  console.log('[Bootstrap] About to call app.listen()...');
  await app.listen(port);
  console.log('[Bootstrap] app.listen() resolved');
  logger.log(`🚀 Server running on http://localhost:${port}/api/v1 [${environment}]`);

  // Print the endpoint table — explicitly after listen() so the router is fully wired
  const endpointLogger = app.get(EndpointLoggerService);
  await endpointLogger.logEndpoints();
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});