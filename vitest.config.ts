import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['scripts/test-researcher-trap-routing-e2e.test.ts'],
  },
});