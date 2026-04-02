import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/js/utils/**', 'src/js/core/auth.js'],
      reporter: ['text', 'html'],
    },
  },
});
