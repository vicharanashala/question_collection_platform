import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Raw body needed for some webhooks
    rawBody: true,
  });

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

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}/api/v1 [${environment}]`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});