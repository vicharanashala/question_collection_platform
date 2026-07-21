// Inversify DI adapter — placeholder for cross-cutting service bindings.
// TODO: install inversify and wire this file to NestJS.
// Until then, NestJS's built-in DI handles all service injection.

import { TYPES } from './types';

export { TYPES };

// ─── Container stub ──────────────────────────────────────────────────────────
// Replace with real Inversify Container once the library is installed:
//
//   import { Container } from 'inversify';
//   export const container = new Container({ defaultScope: 'Singleton' });
//   container.bind(TYPES.DATA_SOURCE).to(DataSource).inSingletonScope();

export const container: Map<string, unknown> = new Map();

export function loadModule(_services: Array<{ token: string; impl: unknown }>): void {
  // TODO: implement once Inversify is installed
}

export function createChildContainer(): Map<string, unknown> {
  return new Map();
}