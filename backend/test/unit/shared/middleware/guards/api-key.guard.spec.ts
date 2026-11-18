import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../../../../../src/shared/middleware/guards/api-key.guard';
import { createHttpContext } from '../../../../helpers/execution-context';

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard();
  const original = process.env.ANVESHAN_ANNADATHA_AUTH_KEY;

  beforeEach(() => {
    process.env.ANVESHAN_ANNADATHA_AUTH_KEY = 'expected-key';
  });
  afterAll(() => {
    process.env.ANVESHAN_ANNADATHA_AUTH_KEY = original;
  });

  const withKey = (key?: string) => createHttpContext({ request: { headers: key === undefined ? {} : { 'x-api-key': key } } });

  it('accepts the configured key', () => {
    expect(guard.canActivate(withKey('expected-key'))).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(() => guard.canActivate(withKey())).toThrow(new UnauthorizedException('Missing x-api-key header'));
  });

  it.each(['wrong-key-12', 'expected-ke', 'expected-key-and-more', ''])('rejects the wrong key %p', (key) => {
    expect(() => guard.canActivate(withKey(key))).toThrow(UnauthorizedException);
  });

  it('fails closed when no key is configured on the server', () => {
    delete process.env.ANVESHAN_ANNADATHA_AUTH_KEY;

    expect(() => guard.canActivate(withKey('anything'))).toThrow(
      new UnauthorizedException('API key authentication is not configured'),
    );
  });
});
