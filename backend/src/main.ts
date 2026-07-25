import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import { AppModule } from './app.module';
import { EndpointLoggerService } from './shared/services/endpoint-logger/endpoint-logger.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

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
  const port = configService.get<number>('app.port') ?? 3000;
  const environment = configService.get<string>('app.environment') ?? 'development';

  console.log('[Bootstrap] About to call app.listen()...');
  const listenPromise = app.listen(port);
  const timeout = new Promise<any>((_, reject) =>
    setTimeout(() => reject(new Error('app.listen() timed out after 10s')), 10_000),
  );
  try {
    await Promise.race([listenPromise, timeout]);
  } catch (err) {
    console.error('[Bootstrap] listen failed:', err.message);
    throw err;
  }
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