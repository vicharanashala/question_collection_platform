import * as request from 'supertest';
import { HealthController } from '../../src/modules/health/controllers/health.controller';
import { RedisService } from '../../src/shared/database/cache/redis.service';
import { createTestApp, TestApp } from '../helpers/test-app';

describe('Health (e2e)', () => {
  const redis = { isEnabled: jest.fn(), ping: jest.fn(), infoMemory: jest.fn() };
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: [HealthController], providers: [{ provide: RedisService, useValue: redis }] });
  });
  afterAll(() => testApp.close());

  it('GET /api/v1 responds without authentication', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/api/v1').expect(200);

    expect(res.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });

  it('echoes a valid x-request-id and generates one otherwise', async () => {
    const server = testApp.app.getHttpServer();

    const echoed = await request(server).get('/api/v1').set('x-request-id', 'trace-12345678');
    const generated = await request(server).get('/api/v1');

    expect(echoed.headers['x-request-id']).toBe('trace-12345678');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('GET /api/v1/health reports redis as disabled', async () => {
    redis.isEnabled.mockReturnValue(false);

    const res = await request(testApp.app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body.redis).toEqual({ status: 'disabled', enabled: false });
  });

  it('GET /api/v1/health reports redis memory when connected', async () => {
    redis.isEnabled.mockReturnValue(true);
    redis.ping.mockResolvedValue('PONG');
    redis.infoMemory.mockResolvedValue({ used_memory_human: '1.2M', used_memory_peak_human: '2.0M' });

    const res = await request(testApp.app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body.redis).toEqual({ status: 'connected', enabled: true, usedMemory: '1.2M', peakMemory: '2.0M' });
  });

  it('GET /api/v1/health stays up and reports the error when redis fails', async () => {
    redis.isEnabled.mockReturnValue(true);
    redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(testApp.app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.redis.status).toBe('error');
  });

  it('returns 404 for unknown routes', async () => {
    await request(testApp.app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
  });
});
