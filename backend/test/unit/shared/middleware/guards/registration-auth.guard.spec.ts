import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegistrationAuthGuard } from '../../../../../src/shared/middleware/guards/registration-auth.guard';
import { createHttpContext } from '../../../../helpers/execution-context';

describe('RegistrationAuthGuard', () => {
  const jwtService = new JwtService({ secret: 'registration-secret' });
  const guard = new RegistrationAuthGuard(jwtService);

  const requestWith = (authorization?: string) => ({ headers: authorization ? { authorization } : {} } as {
    headers: Record<string, string>;
    user?: unknown;
  });

  const registrationToken = (claims: Record<string, unknown> = {}) =>
    jwtService.sign({ sub: 'user-1', mobileNumber: '+919876543210', type: 'registration', ...claims });

  it('accepts a registration token and sets request.user', () => {
    const request = requestWith(`Bearer ${registrationToken()}`);

    expect(guard.canActivate(createHttpContext({ request }))).toBe(true);
    expect(request.user).toEqual({ id: 'user-1', mobileNumber: '+919876543210' });
  });

  it.each([undefined, 'Basic abc', 'Bearer'])('rejects a missing or malformed header %p', (header) => {
    expect(() => guard.canActivate(createHttpContext({ request: requestWith(header) }))).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with another secret', () => {
    const forged = new JwtService({ secret: 'attacker' }).sign({ sub: 'u', mobileNumber: 'm', type: 'registration' });

    expect(() => guard.canActivate(createHttpContext({ request: requestWith(`Bearer ${forged}`) }))).toThrow(
      'Invalid or expired registration token',
    );
  });

  it('rejects an expired token', () => {
    const expired = jwtService.sign({ sub: 'u', mobileNumber: 'm', type: 'registration' }, { expiresIn: -10 });

    expect(() => guard.canActivate(createHttpContext({ request: requestWith(`Bearer ${expired}`) }))).toThrow(
      'Invalid or expired registration token',
    );
  });

  it('rejects an access token used for registration', () => {
    const request = requestWith(`Bearer ${registrationToken({ type: 'access' })}`);

    expect(() => guard.canActivate(createHttpContext({ request }))).toThrow('Token is not a registration token');
  });

  it('rejects a registration token without required claims', () => {
    const request = requestWith(`Bearer ${registrationToken({ mobileNumber: undefined })}`);

    expect(() => guard.canActivate(createHttpContext({ request }))).toThrow('Registration token is missing required claims');
  });
});
