import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/db/schema.ts',
        'src/lib/db/client.ts',
        'src/lib/github/api.ts',
        'src/lib/github/app.ts',
        'src/lib/supabase/**',
        'src/lib/llm/schemas.ts',
        'src/lib/xp/events.ts',
        'src/lib/utils.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 70,
        statements: 80,
      },
    },
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
