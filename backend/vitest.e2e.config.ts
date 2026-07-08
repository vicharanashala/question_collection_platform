import { config as loadEnv } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

loadEnv({ path: '.env.test' });

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
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
