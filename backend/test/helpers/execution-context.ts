import type { ExecutionContext } from '@nestjs/common';

export interface HttpContextOptions {
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  handler?: () => void;
  controller?: new (...args: never[]) => unknown;
}

// Builds a minimal HTTP ExecutionContext for exercising guards and interceptors in isolation.
export function createHttpContext(options: HttpContextOptions = {}): ExecutionContext {
  // The caller's objects are used as is so tests can assert on mutations made by the code under test.
  const request = options.request ?? {};
  request.headers ??= {};
  const response = options.response ?? {};
  response.setHeader ??= jest.fn();
  const handler = options.handler ?? (() => undefined);
  const controller = options.controller ?? class TestController {};

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => jest.fn(),
    }),
    getHandler: () => handler,
    getClass: () => controller,
    getType: () => 'http',
    getArgs: () => [request, response],
    getArgByIndex: (index: number) => [request, response][index],
    switchToRpc: () => {
      throw new Error('RPC context is not supported in tests');
    },
    switchToWs: () => {
      throw new Error('WS context is not supported in tests');
    },
  } as unknown as ExecutionContext;
}
