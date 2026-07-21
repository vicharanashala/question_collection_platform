// Root DI container — placeholder for Inversify-based cross-cutting service registration.
// Feature modules will contribute their own container bindings.
// TODO: integrate with NestJS DI once Inversify wiring is complete.

import { TYPES } from './types';

export { TYPES };

// Singleton application container — initialised once at startup.
export const appContainer: Map<string, unknown> = new Map();

// Register a service by its type token.
export function register<T>(token: string, instance: T): void {
  appContainer.set(token, instance);
}

// Resolve a service by its type token.
export function resolve<T>(token: string): T {
  const instance = appContainer.get(token);
  if (!instance) {
    throw new Error(`Service not registered: ${token}`);
  }
  return instance as T;
}