import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Template tests run inside a scaffolded project (`npm test` there), not here.
  test: { include: ['src/**/*.test.ts'] },
});
