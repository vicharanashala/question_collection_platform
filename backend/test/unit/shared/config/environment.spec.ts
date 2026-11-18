import {
  getAppEnvironment,
  isDeployed,
  isDevelopment,
  isProduction,
  isStaging,
} from '../../../../src/config/environment';

describe('environment', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it.each([
    ['production', 'production'],
    ['PRODUCTION', 'production'],
    ['staging', 'staging'],
    ['development', 'development'],
    ['test', 'development'],
    ['anything-else', 'development'],
  ])('maps NODE_ENV=%p to %p', (value, expected) => {
    process.env.NODE_ENV = value;

    expect(getAppEnvironment()).toBe(expected);
  });

  it('defaults to development when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;

    expect(getAppEnvironment()).toBe('development');
  });

  it('treats staging as deployed, never as a developer machine', () => {
    process.env.NODE_ENV = 'staging';

    expect(isStaging()).toBe(true);
    expect(isDeployed()).toBe(true);
    expect(isDevelopment()).toBe(false);
    expect(isProduction()).toBe(false);
  });
});
