import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  test: {
    include: ['test/**/*.test.mjs'],
    // Every file rebuilds dist, so they must not run at the same time.
    fileParallelism: false,
  },
});
