import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from '../../../../src/shared/middleware/request-id.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  // Runs the middleware for the given incoming header and returns the resolved id.
  const run = (incoming?: string | string[]) => {
    const req = { headers: incoming === undefined ? {} : { 'x-request-id': incoming } } as unknown as Request & { id?: string };
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id);
    return req.id;
  };

  it('keeps a well formed incoming id so traces can be correlated', () => {
    expect(run('abc-123_DEF-456')).toBe('abc-123_DEF-456');
  });

  it('uses the first value when the header is repeated', () => {
    expect(run(['first-request-id', 'second-request-id'])).toBe('first-request-id');
  });

  it('generates a UUID when no id is sent', () => {
    expect(run()).toMatch(UUID);
  });

  it.each(['short', 'x'.repeat(65), 'has spaces in it', 'inject\r\nheader: value', '<script>alert(1)</script>'])(
    'replaces an unsafe or malformed id %p',
    (incoming) => {
      expect(run(incoming)).toMatch(UUID);
    },
  );
});
