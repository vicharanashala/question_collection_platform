import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, relative, sep } from 'path';
import { existsSync } from 'fs';

import { AppModule } from './app.module';
import { EndpointLoggerService } from './shared/services/endpoint-logger/endpoint-logger.service';
import { installVmProxy } from './bootstrap/tailnetProxy.js';
import { spaFallback } from './shared/middleware/spa-fallback.middleware';

// Validate required env vars before attempting to start.
// These are eagerly evaluated during ConfigModule.forRoot() and would throw
// opaque errors if missing. Surface a clear message instead.
// Must run before any service issues a request: the AI / GDB / Gemma / Embed
// servers sit on the tailnet (100.x), which is only reachable through the
// local SOCKS/HTTP proxy.
installVmProxy();

function validateRequiredEnv(): void {
  const required = ['MONGODB_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'REDIS_HOST', 'REDIS_PORT'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
  // LLM config — VM server vars are required for llmConfig() to not throw
  const llmRequired = ['VM_SERVER_URL', 'GEMMA_PORT', 'GEMMA_API_KEY', 'GEMMA_VERSION', 'GEMMA_MODEL', 'GDB_PORT', 'GDB_API_KEY', 'EMBED_PORT'];
  for (const key of llmRequired) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
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

  // ─── Optional: serve the built Vite frontend (React admin dashboard) ─────────
  // The backend can host the web dashboard itself so a single port serves both
  // the API and the UI. If `web/dist/index.html` is missing (e.g. you only built
  // the backend, or you're running the Vite dev server separately on :5173),
  // we log a warning and continue — the API still works, only the UI is
  // unreachable on this port.
  //
  // `__dirname` resolves to different paths depending on how the backend is
  // launched:
  //   - ts-node dev (pnpm start:dev): backend/src/main.ts → backend/src/
  //   - nest build (dist/src/main.js): backend/dist/src/
  //   - Docker (node dist/main.js):   backend/dist/
  // We try a few candidate locations and use the first one that contains a
  // built `index.html`.
  const webDistCandidates = [
    process.env.WEB_DIST_PATH,
    join(__dirname, '..', '..', 'web', 'dist'),
    join(__dirname, '..', '..', '..', 'web', 'dist'),
  ].filter((p): p is string => Boolean(p));

  const webDistPath = webDistCandidates.find((p) =>
    existsSync(join(p, 'index.html')),
  );

  if (webDistPath) {
    logger.log(`Serving web frontend from ${webDistPath}`);

    // 1) Serve static assets hashed by Vite (/assets/*.js, /assets/*.css,
    //    /logo.png, etc.) directly. `useStaticAssets` wraps `serve-static`
    //    which uses `send` under the hood. The `send` library:
    //      a) emits the 'headers' event FIRST (calling our `setHeaders` cb)
    //      b) THEN calls `res.setHeader('Cache-Control', …)` BUT only if
    //         the header has not already been set.
    //    That means setting `Cache-Control` in `setHeaders` is honoured —
    //    `send` will not overwrite it. So we get to author a per-file
    //    policy: hashed assets get long-lived cache, everything else gets
    //    revalidate-every-time headers.
    //
    //    `maxAge` is in milliseconds; 1 year = 365 * 24 * 60 * 60 * 1000.
    //    Files that ARE NOT content-hashed (index.html, logo.png, favicon,
    //    robots.txt) get `maxAge: 0` so the browser always revalidates.
    app.useStaticAssets(webDistPath, {
      index: false, // never auto-serve index.html on directory requests
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year; safe because Vite hashes filenames
      setHeaders: (res, filePath) => {
        const rel = relative(webDistPath, filePath).split(sep).join('/');
        const isHashedAsset = rel.startsWith('assets/');
        if (!isHashedAsset) {
          // Non-hashed files (index.html, logo.png, favicon, robots.txt)
          // must always revalidate. We set Cache-Control here so `send`
          // skips its own header write (see order note above). Pragma +
          // Expires cover HTTP/1.0 caches and intermediaries that ignore
          // Cache-Control.
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    });

    // 2) SPA fallback for client-side routes (React Router). Any GET request
    //    that didn't match a file (above) and doesn't target an API or
    //    uploads path gets `index.html` so the React app can resolve the
    //    route on the client.
    app.use(
      spaFallback({
        webDistPath,
        excludePrefixes: [
          '/api/v1', // backend's global API prefix (set via setGlobalPrefix below)
          '/uploads', // server-side uploaded audio/images
          '/reference', // reserved for future reference/static content endpoints
        ],
      }),
    );
  } else if (process.env.SERVE_WEB !== 'false') {
    logger.warn(
      `Web dist not found. Looked in:\n  - ${webDistCandidates.join('\n  - ')}` +
        `\nThe API will still work, but the admin dashboard UI is only reachable via the Vite dev server (pnpm --filter web dev).` +
        `\nTo skip this warning, set SERVE_WEB=false.`,
    );
  }

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