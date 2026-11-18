import { INestApplication, ModuleMetadata, Provider, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../src/shared/middleware/guards/jwt-auth.guard';
import { JwtStrategy, JwtPayload } from '../../src/shared/middleware/guards/jwt.strategy';
import { RequestIdMiddleware } from '../../src/shared/middleware/request-id.middleware';
import { SessionService } from '../../src/modules/session/services/session.service';
import { REPOSITORY_TOKENS } from '../../src/shared/database/repositories';
import { createMockRepository, MockRepository } from './mock-repository';
import type { TestUser } from './factories';

export const TEST_JWT_SECRET = 'test-jwt-secret';
export const TEST_SESSION_ID = 'test-session-id';

export interface TestAppOptions {
  controllers: NonNullable<ModuleMetadata['controllers']>;
  providers?: Provider[];
  /** Values returned by ConfigService.get, keyed by config path. */
  config?: Record<string, unknown>;
}

export interface TestApp {
  app: INestApplication;
  userRepo: MockRepository;
  sessionService: { validateAccess: jest.Mock };
  /** Signs an access token for the user, the way AuthService does at login. */
  accessTokenFor: (user: TestUser, overrides?: Partial<JwtPayload>) => string;
  /** Signs an arbitrary payload with the test secret. */
  sign: (payload: Record<string, unknown>, secret?: string) => string;
  close: () => Promise<void>;
}

// Boots the given controllers behind the real JWT strategy, global auth guard and validation pipe used in production.
export async function createTestApp(options: TestAppOptions): Promise<TestApp> {
  const userRepo = createMockRepository();
  const sessionService = { validateAccess: jest.fn().mockResolvedValue({}) };
  const config: Record<string, unknown> = { 'jwt.secret': TEST_JWT_SECRET, ...options.config };

  const moduleRef = await Test.createTestingModule({
    imports: [PassportModule, JwtModule.register({ secret: TEST_JWT_SECRET })],
    controllers: options.controllers,
    providers: [
      JwtStrategy,
      { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
      { provide: SessionService, useValue: sessionService },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      ...(options.providers ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  const requestId = new RequestIdMiddleware();
  app.use(requestId.use.bind(requestId));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api/v1');
  await app.init();

  const jwtService = moduleRef.get(JwtService);

  return {
    app,
    userRepo,
    sessionService,
    accessTokenFor: (user, overrides = {}) =>
      jwtService.sign({
        sub: user._id.toHexString(),
        mobileNumber: user.mobileNumber,
        role: user.role,
        tokenVersion: user.tokenVersion,
        sid: TEST_SESSION_ID,
        type: 'access',
        ...overrides,
      }),
    sign: (payload, secret = TEST_JWT_SECRET) => jwtService.sign(payload, { secret }),
    close: () => app.close(),
  };
}
