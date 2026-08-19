/**
 * src/shared/middleware/spa-fallback.middleware.spec.ts
 *
 * Unit tests for the SPA fallback middleware.
 */
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { Request, Response, NextFunction } from 'express';
import { spaFallback } from './spa-fallback.middleware';

type MockRes = Response & {
  headers: Record<string, string>;
  sentFile?: string;
  statusCode: number;
  body?: unknown;
  setHeader: (name: string, value: string) => void;
  sendFile: jest.Mock;
};

function createMockReq(method: string, urlPath: string): Request {
  return { method, path: urlPath } as unknown as Request;
}

function createMockRes(): MockRes {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    sendFile: jest.fn((_path: string, cb?: (err?: Error) => void) => {
      cb?.();
      return res as unknown as Response;
    }),
  } as unknown as MockRes;
  return res;
}

describe('spaFallback', () => {
  let distDir: string;

  beforeAll(() => {
    distDir = join(tmpdir(), `spa-fallback-${Date.now()}`);
    mkdirSync(distDir, { recursive: true });
    writeFileSync(
      join(distDir, 'index.html'),
      '<!doctype html><html><body>SPAMATIC</body></html>',
    );
  });

  afterAll(() => {
    rmSync(distDir, { recursive: true, force: true });
  });

  const baseOptions = () => ({
    webDistPath: distDir,
    excludePrefixes: ['/api/v1', '/uploads', '/reference'],
  });

  it('serves index.html for the root path', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).toHaveBeenCalledTimes(1);
    expect(res.sendFile.mock.calls[0][0]).toBe(join(distDir, 'index.html'));
    expect(next).not.toHaveBeenCalled();
  });

  it('serves index.html for a SPA deep-link (e.g. /questions/42)', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/questions/42');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets no-cache headers on the served index.html by default', () => {
    const handler = spaFallback({ ...baseOptions(), noCacheIndexHtml: true });
    const res = createMockRes();
    handler(createMockReq('GET', '/'), res, jest.fn() as unknown as NextFunction);

    expect(res.headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    expect(res.headers['Pragma']).toBe('no-cache');
    expect(res.headers['Expires']).toBe('0');
  });

  it('does not set no-cache headers when noCacheIndexHtml is false', () => {
    const handler = spaFallback({ ...baseOptions(), noCacheIndexHtml: false });
    const res = createMockRes();
    handler(createMockReq('GET', '/'), res, jest.fn() as unknown as NextFunction);

    expect(res.headers['Cache-Control']).toBeUndefined();
  });

  it('skips paths under an excluded prefix (API)', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/api/v1/users');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('skips paths matching the excluded prefix exactly', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/uploads');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips paths with a file extension (real static assets)', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/assets/index-abc123.js');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips paths with an image extension', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/logo.png');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips non-GET, non-HEAD methods (POST/PUT/DELETE etc.)', () => {
    const handler = spaFallback(baseOptions());
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const req = createMockReq(method, '/');
      const res = createMockRes();
      const next = jest.fn() as unknown as NextFunction;

      handler(req, res, next);

      expect(res.sendFile).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('allows HEAD requests through to sendFile', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('HEAD', '/');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    handler(req, res, next);

    expect(res.sendFile).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards sendFile errors to next()', () => {
    const handler = spaFallback(baseOptions());
    const req = createMockReq('GET', '/');
    const res = createMockRes();
    const next = jest.fn() as unknown as NextFunction;

    res.sendFile.mockImplementationOnce(
      (_path: string, cb?: (err?: Error) => void) => {
        cb?.(new Error('boom'));
        return res as unknown as Response;
      },
    );

    handler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});