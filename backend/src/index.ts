// src/index.ts — Application entry point barrel.
//
// This file re-exports the core bootstrap primitives so external consumers
// (tests, scripts, workers) can import from '@' instead of relative paths.
//
//   import { preloadServices } from '@/index';
//   import { setupWebSocket }  from '@/index';
//   import { MODULE_REGISTRY }  from '@/index';
//
// Note: main.ts is the actual runtime entry point (bootstraps NestJS).
// This file is for type/utility re-exports only.

export * from './bootstrap/loadModules';
export * from './bootstrap/websocket';
export * from './bootstrap/jobs';

export * from './container';
export * from './types';
export * from './instrument';
export * from './metaData';
export * from './shared';

export { AppModule } from './app.module';