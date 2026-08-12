import { config as loadEnv } from 'dotenv';
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'vitest/config';

loadEnv({ path: '.env.test' });

// Uses the real TypeScript compiler (not unplugin-swc) so that
// emitDecoratorMetadata behaves exactly like `nest build` in production.
// SWC's decorator-metadata emission doesn't do full checker-based type
// resolution: for a `@Prop({ enum: SomeStringEnum })` field it reflects
// the enum object itself as `design:type` instead of `String`, which
// crashes Mongoose's SchemaFactory. Real tsc reflects `String` correctly.
// See test_plan.md's "2026-08-12" section for the full investigation.
export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
    setupFiles: ['test/e2e/setup.ts'],
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        module: 'esnext',
        declaration: false,
        sourceMap: true,
        noEmitOnError: false,
      },
      exclude: ['node_modules/**'],
    }),
  ],
});
